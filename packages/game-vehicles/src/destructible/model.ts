/**
 * Part and joint model of a vehicle for the destruction contract: every damage zone becomes a part with a material, the mechanical parts the
 * zones do not cover (battery, alternator, gearbox, brakes, steering, shock absorbers, tow hitch, tyres, mirrors, pillars...) are added from the
 * vehicle meta, and the joints (hinge, bolt, weld, glue, clip) say how each one is held.
 *
 * Everything here is pure data derived from the built vehicle: no meshes are created or touched.
 */
import type { JointKind, MaterialId, ToolKind, Vec3 } from '@adatechnology/game-contracts'
import type { VehicleContext, VehicleKit } from '../api'
import { clamp, strHash } from '../util'

/** What a part is, which decides its material, its joint and what happens when it comes off. */
export type PartRole =
  | 'frame'
  | 'panel'
  | 'fender'
  | 'door'
  | 'hood'
  | 'lid'
  | 'roof'
  | 'bumper'
  | 'glass'
  | 'light'
  | 'rim'
  | 'tyre'
  | 'mirror'
  | 'pillar'
  | 'engine'
  | 'radiator'
  | 'fuel_tank'
  | 'oil_pan'
  | 'battery'
  | 'alternator'
  | 'gearbox'
  | 'brakes'
  | 'steering'
  | 'shocks'
  | 'hitch'
  | 'other'

/** An axis-aligned box in `c.vehicle` coordinates (+x front, +y up, +z right). */
export interface LocalBox {
  center: Vec3
  size: Vec3
}

export interface PartDef {
  id: string
  role: PartRole
  /** Display name from the locale. */
  name: string
  material: MaterialId
  box: LocalBox
  mass: number
  /** Energy in joules that wrecks the part. */
  hp: number
  /** The damage zone this part is, when it is one. */
  zoneId?: string
  /** Fluid held, in litres. */
  contains?: { fluid: string; liters: number; pressurized?: boolean }
  explodes?: { energy: number; radius: number; atC: number }
  /** Temperature in Celsius at which the part catches fire (none: it does not burn). */
  ignitionC?: number
  /** Parts that can be seen coming off the vehicle (the others are logical: they keep state and effects only). */
  visual: boolean
  /** The part is one of the new mechanical parts (the ones the damage zones do not cover). */
  mechanical: boolean
  tags: string[]
}

export interface JointDef {
  id: string
  a: string
  b: string
  kind: JointKind
  strength: number
  tools: ToolKind[]
  seconds: number
}

export interface VehicleModel {
  parts: PartDef[]
  joints: JointDef[]
  /** The part every other part hangs from. */
  hub: string
  hitch: boolean
}

export interface ModelOptions {
  /** Fit a tow hitch. Default: the spec flag `hitch`, else a seeded choice by vehicle kind. */
  hitch?: boolean
}

/** Joint kinds as the vehicle uses them: strength in joules of wear, the tools that undo them and the seconds of work. */
export const JOINT_RULES: Record<'hinge' | 'bolt' | 'weld' | 'glue' | 'clip', { strength: number; tools: ToolKind[]; seconds: number }> = {
  hinge: { strength: 5000, tools: ['wrench', 'screwdriver'], seconds: 3 },
  bolt: { strength: 3000, tools: ['wrench'], seconds: 4 },
  weld: { strength: 30000, tools: ['cutting_torch', 'saw'], seconds: 10 },
  glue: { strength: 800, tools: ['pry_bar', 'knife'], seconds: 3 },
  clip: { strength: 500, tools: ['pry_bar', 'hand'], seconds: 1.5 },
}

type Kind = 'car' | 'bike' | 'quad' | 'tractor' | 'truck' | 'bus' | 'tank' | 'boat' | 'plane' | 'heli'

/** Which mechanical parts each vehicle kind has. */
const MECHANICS: Record<Kind, Array<'battery' | 'alternator' | 'gearbox' | 'brakes' | 'steering' | 'shocks' | 'oil_pan' | 'mirrors'>> = {
  car: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan', 'mirrors'],
  truck: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan', 'mirrors'],
  bus: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan', 'mirrors'],
  tractor: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan', 'mirrors'],
  quad: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan'],
  bike: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'shocks', 'oil_pan', 'mirrors'],
  tank: ['battery', 'alternator', 'gearbox', 'brakes', 'steering', 'oil_pan'],
  boat: ['battery', 'alternator', 'gearbox', 'steering'],
  plane: ['battery', 'alternator', 'brakes', 'steering', 'shocks'],
  heli: ['battery', 'alternator', 'gearbox'],
}

/** Chance (percent) that a vehicle of the kind has a tow hitch when neither the spec nor the options say. */
const HITCH_CHANCE: Record<Kind, number> = { car: 30, truck: 60, bus: 0, tractor: 100, quad: 40, bike: 0, tank: 0, boat: 0, plane: 0, heli: 0 }

const STEEL_KG_M2 = 7
const ALU_KG_M2 = 3.2

export const kindOf = (c: VehicleContext): Kind => {
  const k = c.meta.kind
  return (k && k in MECHANICS ? k : 'car') as Kind
}

const side = (v: number): 'left' | 'right' => (v < 0 ? 'left' : 'right')

/** Rough mass of the vehicle in kilograms from its size. */
export const vehicleMass = (c: VehicleContext): number => {
  const m = c.meta
  const L = m.length ?? 4
  const W = m.width ?? 1.7
  const H = m.bodyHeight ?? 0.7
  return clamp(L * W * H * 320, 90, 60000)
}

const areaOf = (size: Vec3): number => {
  const s = [...size].sort((a, b) => b - a)
  return s[0] * s[1]
}

const boxOf = (z: { box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } }): LocalBox => ({
  center: [(z.box.x0 + z.box.x1) / 2, (z.box.y0 + z.box.y1) / 2, (z.box.z0 + z.box.z1) / 2],
  size: [Math.max(0.02, z.box.x1 - z.box.x0), Math.max(0.02, z.box.y1 - z.box.y0), Math.max(0.02, z.box.z1 - z.box.z0)],
})

/** Panel material by vehicle kind: aircraft and boats are aluminium, the rest steel. */
const skinOf = (kind: Kind): MaterialId => (kind === 'plane' || kind === 'heli' || kind === 'boat' ? 'aluminium' : 'steel')

/** The zone is a fender (a front or rear wing, not a door or a side panel). */
const isFender = (id: string): boolean => /^fender/.test(id)

const roleOfZone = (z: { id: string; type: string; sub?: string; fxKey?: string }): PartRole => {
  const sub = String(z.sub ?? z.id)
  if (z.type === 'part' || z.type === 'internal') {
    if (/^engine/.test(sub)) return 'engine'
    if (sub === 'radiator') return 'radiator'
    if (/fuel_tank/.test(sub)) return 'fuel_tank'
    if (sub === 'battery') return 'battery'
  }
  switch (z.type) {
    case 'door':
      return 'door'
    case 'hood':
      return 'hood'
    case 'lid':
      return 'lid'
    case 'roof':
      return 'roof'
    case 'bumper':
      return 'bumper'
    case 'glass':
      return 'glass'
    case 'light':
      return 'light'
    case 'wheel':
      return 'rim'
    case 'internal':
      if (/^engine/.test(sub)) return 'engine'
      if (sub === 'radiator') return 'radiator'
      if (/fuel_tank/.test(sub) || sub === 'tank') return 'fuel_tank'
      if (sub === 'battery') return 'battery'
      return 'frame'
    case 'panel':
      return isFender(z.id) ? 'fender' : 'panel'
    default:
      return 'other'
  }
}

/** Builds the part and joint model of a built vehicle. */
export function buildVehicleModel(kit: VehicleKit, c: VehicleContext, options: ModelOptions = {}): VehicleModel {
  const kind = kindOf(c)
  const m = c.meta
  const spec = c.spec as { fuel?: string; hitch?: boolean }
  const t = kit.t
  const skin = skinOf(kind)
  const armour = m.armored || m.armor || m.bullet ? 12 : 1
  const mass = vehicleMass(c)
  const W = m.width ?? 1.7
  const F = m.front ?? 2
  const R = m.rear ?? -2
  const L = m.length ?? F - R
  const clearance = m.clearance ?? 0.3
  const belt = m.belt ?? clearance + (m.bodyHeight ?? 0.6)
  const electric = spec.fuel === 'electric'
  const fuelless = electric || spec.fuel === 'none'
  const parts: PartDef[] = []
  const joints: JointDef[] = []
  const ids = new Set<string>()

  const add = (p: Omit<PartDef, 'tags' | 'mechanical'> & { tags?: string[]; mechanical?: boolean }): PartDef => {
    let id = p.id
    for (let n = 2; ids.has(id); n++) id = `${p.id}_${n}`
    ids.add(id)
    const part: PartDef = { ...p, id, tags: p.tags ?? [], mechanical: p.mechanical ?? false }
    parts.push(part)
    return part
  }
  const join = (a: string, b: string, jk: keyof typeof JOINT_RULES, scale = 1): void => {
    const rule = JOINT_RULES[jk]
    joints.push({ id: `${a}~${b}`, a, b, kind: jk, strength: rule.strength * scale, tools: [...rule.tools], seconds: rule.seconds })
  }

  // ---- zones ------------------------------------------------------------------------------------------------------------------------------
  const zones = kit.zonesOf(c) as Array<any>
  const zoneOf = new Map<string, any>()
  for (const z of zones) zoneOf.set(z.id, z)

  const hasTankZone = zones.some((z) => roleOfZone(z) === 'fuel_tank')
  const hasRadiatorZone = zones.some((z) => roleOfZone(z) === 'radiator')
  const hubZone = zones.find((z) => z.id === 'underbody') ?? zones.find((z) => z.id === 'chassis')

  // the hub every joint hangs from: the underbody or chassis zone, else a frame part spanning the body
  const hubId = hubZone ? hubZone.id : 'chassis'

  for (const z of zones) {
    let role = roleOfZone(z)
    if (z === hubZone) role = 'frame'
    const box = boxOf(z)
    const area = areaOf(box.size)
    const id = z.id as string
    const label = String(z.name ?? id)
    const tags: string[] = [...(z.tags ?? [])]
    if (role === 'rim') {
      const wheels = (z.wheels ?? []) as any[]
      const r = Math.max(0.2, ...wheels.map((w) => w.userData?.r ?? 0.3))
      // the rim is the inner, smaller part of the wheel box: the tyre wraps it and the bolts are on the body side
      const sz = Math.sign(box.center[2]) || 1
      const rimBox: LocalBox = { center: [box.center[0], box.center[1], box.center[2] - sz * box.size[2] * 0.25], size: [box.size[0] * 0.7, box.size[1] * 0.7, box.size[2] * 0.5] }
      add({ id, role, name: label, material: kind === 'plane' || kind === 'heli' ? 'aluminium' : 'steel', box: rimBox, mass: 22 * r * Math.max(1, wheels.length), hp: 12000 * armour, zoneId: id, visual: kind !== 'plane' && !/landing/.test(id), tags: ['wheel', ...tags] })
      const tyreId = id.replace(/^wheels?/, 'tyre').replace(/^(?!tyre)/, 'tyre_')
      const tyreBox: LocalBox = { center: box.center, size: [box.size[0] * 0.98, box.size[1] * 0.98, box.size[2]] }
      add({
        id: tyreId,
        role: 'tyre',
        name: t('mechanics.tyre', { zone: label }),
        material: 'rubber',
        box: tyreBox,
        mass: 38 * r * Math.max(1, wheels.length),
        hp: 6000,
        ignitionC: 350,
        visual: wheels.length > 0 && !/landing/.test(id),
        mechanical: true,
        tags: ['tyre', 'wheel'],
        zoneId: id,
      })
      continue
    }
    if (role === 'glass') {
      const glass = (z.glass ?? [])[0]
      const laminated = glass?.userData?.glass?.type === 'laminated' || m.bullet
      add({ id, role, name: label, material: 'glass', box, mass: 10 * area, hp: laminated ? 4000 : 450, zoneId: id, visual: false, tags: ['glass', ...tags] })
      continue
    }
    if (role === 'light') {
      add({ id, role, name: label, material: 'glass', box, mass: 1.2 + 4 * area, hp: 320, zoneId: id, visual: true, tags: ['light', ...tags] })
      continue
    }
    if (role === 'bumper') {
      add({ id, role, name: label, material: 'plastic', box, mass: 6 + 5 * area, hp: 9000, ignitionC: 400, zoneId: id, visual: true, tags: ['bumper', ...tags] })
      continue
    }
    if (role === 'engine') {
      const kg = { bike: 55, quad: 90, car: 150, tractor: 450, truck: 600, bus: 450, tank: 900, boat: 90, plane: 160, heli: 150 }[kind]
      add({ id, role, name: label, material: kind === 'plane' || kind === 'heli' ? 'aluminium' : 'steel', box, mass: kg, hp: 60000 * armour, ignitionC: 260, zoneId: id, visual: false, tags: ['engine', ...tags] })
      continue
    }
    if (role === 'radiator') {
      add({ id, role, name: label, material: 'aluminium', box, mass: 8, hp: 3000, zoneId: id, visual: false, contains: { fluid: 'coolant', liters: kind === 'truck' || kind === 'bus' ? 18 : 7, pressurized: true }, tags: ['radiator', ...tags] })
      continue
    }
    if (role === 'fuel_tank') {
      if (fuelless) {
        add({ id, role: 'other', name: label, material: 'steel', box, mass: 20, hp: 25000, zoneId: id, visual: false, tags })
        continue
      }
      const liters = { bike: 14, quad: 16, car: 55, tractor: 150, truck: 300, bus: 200, tank: 600, boat: 90, plane: 120, heli: 300 }[kind]
      const diesel = spec.fuel === 'diesel'
      add({
        id,
        role,
        name: label,
        material: 'steel',
        box,
        mass: 14 + liters * 0.8,
        hp: 25000 * armour,
        zoneId: id,
        visual: false,
        contains: { fluid: diesel ? 'diesel' : 'fuel', liters },
        explodes: diesel ? undefined : { energy: 1.2e6 * (liters / 55), radius: 5 + liters / 30, atC: 320 },
        ignitionC: diesel ? 330 : 260,
        tags: ['fuel_tank', ...tags],
      })
      continue
    }
    if (role === 'battery') {
      add({ id, role, name: label, material: 'plastic', box, mass: 14, hp: 1500, zoneId: id, visual: true, ignitionC: 200, tags: ['battery', ...tags] })
      continue
    }
    if (role === 'frame') {
      add({ id, role, name: label, material: 'steel', box, mass: mass * 0.25, hp: 150000 * armour, zoneId: id, visual: false, tags: ['frame', ...tags] })
      continue
    }
    const roofLike = role === 'roof'
    const kg = (skin === 'steel' ? STEEL_KG_M2 : ALU_KG_M2) * area * (role === 'door' ? 1.6 : 1)
    add({
      id,
      role,
      name: label,
      material: skin,
      box,
      mass: Math.max(2, kg),
      hp: (roofLike ? 30000 : 20000) * armour,
      zoneId: id,
      visual: role === 'door' || role === 'hood' || role === 'lid' || role === 'fender',
      tags: [role, ...tags],
    })
  }

  // the hub is a synthetic frame part when the vehicle has no underbody or chassis zone
  if (!hubZone) {
    const h = Math.max(0.15, belt - clearance)
    add({
      id: hubId,
      role: 'frame',
      name: t('mechanics.chassis'),
      material: 'steel',
      box: { center: [(F + R) / 2, clearance + h * 0.45, 0], size: [Math.max(0.4, L * 0.8), h * 0.7, Math.max(0.2, W * 0.6)] },
      mass: mass * 0.25,
      hp: 150000 * armour,
      visual: false,
      mechanical: true,
      tags: ['frame'],
    })
  }

  // ---- mechanical parts the zones do not cover ---------------------------------------------------------------------------------------------
  const mech = new Set(MECHANICS[kind])
  const wheelParts = parts.filter((p) => p.role === 'rim')
  const frontX = wheelParts.length ? Math.max(...wheelParts.map((p) => p.box.center[0])) : F - L * 0.2
  const rearX = wheelParts.length ? Math.min(...wheelParts.map((p) => p.box.center[0])) : R + L * 0.2
  const wheelR = wheelParts.length ? Math.max(...wheelParts.map((p) => p.box.size[1] / 2)) : 0.3
  const heightCenter = (F + R) / 2

  // engine (some vehicles have no engine zone: bus, tank)
  let engine = parts.find((p) => p.role === 'engine')
  if (!engine && !electric && kind !== 'bike') {
    const ex = kind === 'bus' ? frontX + 0.4 : kind === 'tank' ? R + L * 0.15 : F - L * 0.2
    engine = add({
      id: 'engine',
      role: 'engine',
      name: t('mechanics.engine'),
      material: skin,
      box: { center: [ex, clearance + 0.4, 0], size: [Math.min(1.1, L * 0.2), 0.6, Math.min(0.9, W * 0.45)] },
      mass: 300,
      hp: 60000 * armour,
      ignitionC: 260,
      visual: false,
      mechanical: true,
      tags: ['engine'],
    })
  }
  const ec = engine ? engine.box.center : ([F - L * 0.2, clearance + 0.4, 0] as Vec3)
  const es = engine ? engine.box.size : ([0.8, 0.5, 0.6] as Vec3)

  if (!hasTankZone && !fuelless && kind !== 'bike') {
    const liters = { bike: 14, quad: 16, car: 55, tractor: 150, truck: 300, bus: 200, tank: 600, boat: 90, plane: 120, heli: 300 }[kind]
    const diesel = spec.fuel === 'diesel'
    add({
      id: 'fuel_tank',
      role: 'fuel_tank',
      name: t('mechanics.fuel_tank'),
      material: 'steel',
      box: { center: [R + L * 0.25, clearance + 0.12, W * 0.15], size: [Math.min(1, L * 0.2), 0.3, Math.min(0.6, W * 0.35)] },
      mass: 14 + liters * 0.8,
      hp: 25000 * armour,
      visual: false,
      mechanical: true,
      contains: { fluid: diesel ? 'diesel' : 'fuel', liters },
      explodes: diesel ? undefined : { energy: 1.2e6 * (liters / 55), radius: 5 + liters / 30, atC: 320 },
      ignitionC: diesel ? 330 : 260,
      tags: ['fuel_tank'],
    })
  }
  if (!hasRadiatorZone && engine && (kind === 'car' || kind === 'truck' || kind === 'bus' || kind === 'tractor' || kind === 'tank')) {
    add({
      id: 'radiator',
      role: 'radiator',
      name: t('mechanics.radiator'),
      material: 'aluminium',
      box: { center: [ec[0] + es[0] / 2 + 0.06, ec[1], 0], size: [0.1, Math.max(0.2, es[1] * 0.8), Math.max(0.3, es[2] * 1.1)] },
      mass: 8,
      hp: 3000,
      visual: false,
      mechanical: true,
      contains: { fluid: 'coolant', liters: 7, pressurized: true },
      tags: ['radiator'],
    })
  }
  if (mech.has('oil_pan') && !fuelless && kind !== 'bike' && engine) {
    add({
      id: 'oil_pan',
      role: 'oil_pan',
      name: t('mechanics.oil_pan'),
      material: 'aluminium',
      box: { center: [ec[0], Math.max(clearance * 0.5, ec[1] - es[1] / 2 - 0.02), ec[2]], size: [es[0] * 0.8, 0.1, es[2] * 0.8] },
      mass: 5,
      hp: 3000,
      visual: false,
      mechanical: true,
      contains: { fluid: 'oil', liters: kind === 'truck' || kind === 'bus' || kind === 'tank' ? 30 : 4.5 },
      tags: ['oil_pan'],
    })
  } else if (mech.has('oil_pan') && !fuelless && kind === 'bike') {
    add({
      id: 'oil_pan',
      role: 'oil_pan',
      name: t('mechanics.oil_pan'),
      material: 'aluminium',
      box: { center: [ec[0], Math.max(0.12, clearance * 0.5), 0], size: [0.3, 0.08, 0.2] },
      mass: 2,
      hp: 2000,
      visual: false,
      mechanical: true,
      contains: { fluid: 'oil', liters: 1.8 },
      tags: ['oil_pan'],
    })
  }
  const hasBatteryZone = parts.some((p) => p.role === 'battery')
  if (mech.has('battery') && !hasBatteryZone) {
    // under the hood at the corner of the engine bay; vehicles without a hood carry it on the frame
    const big = electric ? 1 : 0
    add({
      id: 'battery',
      role: 'battery',
      name: t('mechanics.battery'),
      material: 'plastic',
      box: { center: [ec[0] + es[0] * 0.3, ec[1] + es[1] * 0.3, Math.min(W * 0.28, ec[2] + es[2] * 0.6)], size: big ? [1.2, 0.18, 0.7] : [0.26, 0.2, 0.17] },
      mass: big ? 300 : 14,
      hp: big ? 6000 : 1500,
      ignitionC: 200,
      visual: !big,
      mechanical: true,
      tags: ['battery'],
    })
  }
  if (mech.has('alternator')) {
    add({
      id: 'alternator',
      role: 'alternator',
      name: t('mechanics.alternator'),
      material: 'aluminium',
      box: { center: [ec[0] + es[0] * 0.3, ec[1] - es[1] * 0.2, ec[2] - es[2] * 0.55], size: [0.16, 0.16, 0.16] },
      mass: 6,
      hp: 3000,
      visual: false,
      mechanical: true,
      tags: ['alternator'],
    })
  }
  if (mech.has('gearbox')) {
    add({
      id: 'gearbox',
      role: 'gearbox',
      name: t('mechanics.gearbox'),
      material: skin,
      box: { center: [ec[0] - es[0] / 2 - 0.3, ec[1] - es[1] * 0.2, ec[2]], size: [kind === 'bike' ? 0.3 : 0.6, 0.32, kind === 'bike' ? 0.22 : 0.36] },
      mass: kind === 'bike' ? 18 : 60,
      hp: 20000 * armour,
      visual: false,
      mechanical: true,
      tags: ['gearbox'],
    })
  }
  if (mech.has('brakes')) {
    add({
      id: 'brakes',
      role: 'brakes',
      name: t('mechanics.brakes'),
      material: 'steel',
      box: { center: [frontX, wheelR * 0.9, 0], size: [0.22, 0.2, Math.max(0.2, W * 0.78)] },
      mass: 14,
      hp: 8000,
      visual: false,
      mechanical: true,
      tags: ['brakes'],
    })
  }
  if (mech.has('steering')) {
    add({
      id: 'steering',
      role: 'steering',
      name: t('mechanics.steering'),
      material: 'steel',
      box: { center: [frontX - 0.2, wheelR * 1.15, 0], size: [0.14, 0.14, Math.max(0.2, W * 0.5)] },
      mass: 12,
      hp: 8000,
      visual: false,
      mechanical: true,
      tags: ['steering'],
    })
  }
  if (mech.has('shocks')) {
    add({
      id: 'shock_absorbers',
      role: 'shocks',
      name: t('mechanics.shock_absorbers'),
      material: 'steel',
      box: { center: [rearX + 0.1, wheelR * 1.1, 0], size: [0.18, 0.3, Math.max(0.2, W * 0.8)] },
      mass: 14,
      hp: 8000,
      visual: false,
      mechanical: true,
      tags: ['suspension'],
    })
  }
  // tow hitch: the spec flag, else the option, else a seeded choice by kind
  const chance = HITCH_CHANCE[kind]
  const seeded = strHash(`${c.seedKey ?? c.key}|hitch`) % 100 < chance
  const hitch = options.hitch ?? (typeof spec.hitch === 'boolean' ? spec.hitch : seeded)
  if (hitch && chance > 0) {
    add({
      id: 'tow_hitch',
      role: 'hitch',
      name: t('mechanics.tow_hitch'),
      material: 'steel',
      box: { center: [R - 0.14, clearance + 0.16, 0], size: [0.34, 0.12, 0.16] },
      mass: 9,
      hp: 6000,
      visual: true,
      mechanical: true,
      tags: ['hitch'],
    })
  }
  // mirrors: the housing and the arm seen on the front door, or generated on the glasshouse
  if (mech.has('mirrors')) {
    const gh = m.glasshouse as { fb?: number } | undefined
    const mx = gh?.fb != null ? gh.fb - 0.3 : kind === 'bike' ? F - L * 0.3 : F - L * 0.28
    const half = kind === 'bike' || kind === 'quad' ? 0.28 : W / 2 + 0.1
    const my = kind === 'bike' || kind === 'quad' ? (m.top ?? belt + 0.25) - 0.1 : belt + 0.12
    for (const s of [-1, 1] as const) {
      const door = zones.find((z) => z.type === 'door' && z.side === s && (z.mirrors ?? []).length)
      let box: LocalBox = { center: [mx, my, s * half], size: [0.14, 0.12, 0.2] }
      if (door) {
        // the objects of the vehicle: use the box that wraps them
        const bb = (door.mirrors as any[]).reduce(
          (acc: [number, number, number, number, number, number] | null, o: any) => {
            const w = new (kit.THREE.Box3 as any)().setFromObject(o)
            const inv = new (kit.THREE.Matrix4 as any)().copy(c.vehicle.matrixWorld).invert()
            w.applyMatrix4(inv)
            const cur: [number, number, number, number, number, number] = [w.min.x, w.max.x, w.min.y, w.max.y, w.min.z, w.max.z]
            if (!acc) return cur
            return [Math.min(acc[0], cur[0]), Math.max(acc[1], cur[1]), Math.min(acc[2], cur[2]), Math.max(acc[3], cur[3]), Math.min(acc[4], cur[4]), Math.max(acc[5], cur[5])]
          },
          null,
        )
        if (bb) box = { center: [(bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2, (bb[4] + bb[5]) / 2], size: [Math.max(0.06, bb[1] - bb[0]), Math.max(0.06, bb[3] - bb[2]), Math.max(0.06, bb[5] - bb[4])] }
      }
      add({
        id: `mirror_${side(s)}`,
        role: 'mirror',
        name: t('mechanics.mirror', { side: t(`sides.${side(s)}`), sideM: t(`sides.${side(s)}M`) }),
        material: 'plastic',
        box,
        mass: 1.1,
        hp: 1500,
        ignitionC: 400,
        visual: true,
        mechanical: true,
        tags: ['mirror', side(s)],
      })
    }
  }
  // pillars of a car: welded to the frame and to the roof
  const gh = m.glasshouse as { fb?: number; rb?: number; roof?: number; belt?: number; Wg?: number } | undefined
  if (kind === 'car' && gh && gh.fb != null && gh.rb != null && gh.roof != null && zones.some((z) => z.type === 'roof')) {
    const b0 = gh.belt ?? belt
    const hw = (gh.Wg ?? W * 0.9) / 2
    for (const [name, x] of [
      ['pillar_a', gh.fb - 0.12],
      ['pillar_c', gh.rb + 0.12],
    ] as const) {
      for (const s of [-1, 1] as const) {
        add({
          id: `${name}_${side(s)}`,
          role: 'pillar',
          name: t(`mechanics.${name}`, { side: t(`sides.${side(s)}`), sideM: t(`sides.${side(s)}M`) }),
          material: 'steel',
          box: { center: [x, (b0 + gh.roof) / 2, s * (hw - 0.04)], size: [0.07, Math.max(0.2, gh.roof - b0), 0.07] },
          mass: 7,
          hp: 40000 * armour,
          visual: false,
          mechanical: true,
          tags: ['pillar', side(s)],
        })
      }
    }
  }
  void heightCenter

  // ---- joints --------------------------------------------------------------------------------------------------------------------------------
  const has = (id: string): boolean => ids.has(id)
  const roofPart = parts.find((p) => p.role === 'roof')
  for (const p of parts) {
    if (p.id === hubId) continue
    switch (p.role) {
      case 'door':
      case 'hood':
      case 'lid':
        join(p.id, hubId, 'hinge')
        break
      case 'fender':
        join(p.id, hubId, 'bolt')
        break
      case 'bumper':
      case 'light':
      case 'battery':
      case 'hitch':
      case 'steering':
      case 'shocks':
      case 'engine':
      case 'radiator':
      case 'fuel_tank':
      case 'brakes':
        join(p.id, hubId, 'bolt')
        break
      case 'rim':
        join(p.id, hubId, 'bolt')
        break
      case 'glass':
        join(p.id, hubId, 'glue')
        break
      case 'tyre': {
        const rim = parts.find((q) => q.role === 'rim' && q.zoneId === p.zoneId)
        if (rim) join(p.id, rim.id, 'clip')
        break
      }
      case 'mirror': {
        const door = parts.find((q) => q.role === 'door' && q.tags.includes(p.tags[1] ?? ''))
        join(p.id, door ? door.id : hubId, 'bolt', 0.4)
        break
      }
      case 'alternator':
      case 'gearbox':
      case 'oil_pan':
        join(p.id, engine ? engine.id : hubId, 'bolt')
        break
      case 'pillar':
        join(p.id, hubId, 'weld')
        if (roofPart) join(roofPart.id, p.id, 'weld')
        break
      case 'roof':
        if (!parts.some((q) => q.role === 'pillar')) join(p.id, hubId, 'weld')
        break
      case 'panel':
      case 'other':
        join(p.id, hubId, p.tags.includes('left') || p.tags.includes('right') ? 'weld' : 'bolt')
        break
      default:
        break
    }
  }
  void has
  return { parts, joints, hub: hubId, hitch }
}
