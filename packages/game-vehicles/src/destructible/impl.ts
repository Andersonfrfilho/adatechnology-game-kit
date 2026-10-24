/**
 * `createVehicleDestructible`: a vehicle that follows the destruction contract of `@adatechnology/game-contracts` and brings its own rules.
 * Every damage zone and mechanical part is a part with a material, hits become events (dent, hole, crack, fracture, detach, leak, ignite,
 * melt, explode), joints come apart by wear, by a wrench or by breaking, and the hidden mechanics change how the vehicle drives.
 *
 * It depends on the contracts only (types) and on the kit it is given: not on the default destruction world.
 */
import type {
  AnimationClipSpec,
  DamageType,
  DestructibleImpl,
  DestructibleSpec,
  DestructionEvent,
  Hit,
  JointSpec,
  ObjectState,
  PartSpec,
  PartState,
  ToolKind,
  Vec3,
} from '@adatechnology/game-contracts'
import { ignitionChance, resolveIgnitionRules, sparkTargetFactor, type IgnitionRules } from '@adatechnology/game-contracts'
import type { VehicleContext, VehicleKit } from '../api'
import { clamp, rng, strHash } from '../util'
import { buildVehicleModel, kindOf, type JointDef, type PartDef, type PartRole, type VehicleModel } from './model'
import { VehicleVisuals } from './visual'
import { createVehicleClips } from './clips'

export interface VehicleDestructibleOptions {
  /** Object id the host gives (`DestructibleImpl.id`). Default: the vehicle key. */
  id?: string
  /** Display name. Default: the vehicle name. */
  name?: string
  /** Object whose space `describe()` answers in (the wrapper the host placed the vehicle in). Default: `c.root`. */
  frame?: any
  /** Tow hitch: the option wins over the spec flag, the spec flag over the seeded choice. */
  hitch?: boolean
  /** Do not create or move any mesh (logic only, for servers and tests that need no scene). */
  headless?: boolean
  /** Extra seed for the choices that are random in the real world (which way a broken steering pulls). */
  seed?: number
  /** How full the fuel tank starts, 0 to 1 (default 1). A nearly empty tank leaks little and lights easily (see `ignition`). */
  fuel?: number
  /**
   * What lights the fuel that leaks from a pierced tank: a plain bullet only leaks; a spark of a hard round on steel, an incendiary or tracer
   * round, a fire within `fireNear.radius` (a burning part or a burning fuel stain) or a blast lights it, and then the usual fire and explosion
   * follow. The chance of the round is in `Hit.ignition`; this is the target side (how full the tank is, what the wall is, the fire near).
   * Defaults and meaning of every number: `IgnitionRules` of `@adatechnology/game-contracts`.
   */
  ignition?: Partial<IgnitionRules>
}

/** What the vehicle can do now, from the state of its hidden mechanics. */
export interface VehicleStatus {
  /** Battery, alternator, engine and fuel are in order. */
  canStart: boolean
  /** Headlights and taillights are powered (battery and alternator in order). */
  lightsOn: boolean
  /** Engine runs and the gearbox transmits. */
  canDrive: boolean
  /** 1 is normal; worn or missing brakes make the stopping distance this many times longer. */
  brakeFactor: number
  /** -1..1: the sideways pull of a damaged steering or flat tyres (negative is left). */
  steerPull: number
  flatTyres: string[]
  detached: string[]
  leaking: string[]
  burning: string[]
  exploded: boolean
  fuelLiters: number
}

export interface VehicleDestructible extends DestructibleImpl {
  readonly vehicle: VehicleContext
  readonly model: VehicleModel
  /** Display name of a part (from the kit locale). */
  partName(partId: string): string
  status(): VehicleStatus
  /** Open and close clips for the doors, the hood and the trunk lid the vehicle has. */
  animations(): AnimationClipSpec[]
  /** World position of a part's centre. */
  partWorldCenter(partId: string): Vec3
  /** Rolls the vehicle over (the roof, the glass and the fluids are hurt when it lands). */
  rollover(side?: number): void
  /** Part ids that are no longer attached to the main body. */
  detachedParts(): string[]
}

interface PState {
  def: PartDef
  hp: number
  temp: number
  burning: boolean
  fuelKg: number
  burnRate: number
  char: number
  melt: number
  dents: PartState['dents']
  holes: PartState['holes']
  cracks: PartState['cracks']
  liters: number | undefined
  lost: boolean
  status: PartState['status']
  flat: boolean
  fireLoss: number
}

interface JState {
  def: JointDef
  hp: number
  progress: number
  open: boolean
  by?: 'break' | 'tool' | 'part_lost'
  reported: number
}

interface Leak {
  rate: number
  fluid: string
  pud: any
}

/** Joules a projectile needs to get through one layer of the material (before the role factor). */
const RESIST: Record<string, number> = { steel: 380, aluminium: 220, glass: 90, plastic: 70, rubber: 120 }
const ROLE_RESIST: Partial<Record<PartRole, number>> = {
  frame: 6,
  engine: 10,
  gearbox: 8,
  pillar: 4,
  fuel_tank: 0.4,
  radiator: 0.3,
  battery: 0.8,
  brakes: 5,
  steering: 4,
  shocks: 4,
  alternator: 3,
  oil_pan: 0.6,
  hitch: 5,
  rim: 4,
}
/** Scale of blunt damage by material. */
const BLUNT: Record<string, number> = { steel: 0.8, aluminium: 1, glass: 1.5, plastic: 1.2, rubber: 0.3 }
/** Parts inside the body take a fraction of an outside blow. */
const SHIELDED: ReadonlySet<PartRole> = new Set<PartRole>(['engine', 'gearbox', 'frame', 'radiator', 'fuel_tank', 'oil_pan', 'battery', 'alternator', 'brakes', 'steering', 'shocks'])
const AMBIENT = 20
const FLAME = 700

const FRACTURE: Record<string, 'shatter' | 'snap' | 'tear' | 'none'> = { glass: 'shatter', plastic: 'snap', rubber: 'tear', steel: 'none', aluminium: 'none' }

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const r3 = (v: Vec3): Vec3 => [Math.round(v[0] * 1e5) / 1e5, Math.round(v[1] * 1e5) / 1e5, Math.round(v[2] * 1e5) / 1e5]
const r2 = (n: number): number => Math.round(n * 1e4) / 1e4

export function createVehicleDestructible(kit: VehicleKit, vehicleCtx: VehicleContext, options: VehicleDestructibleOptions = {}): VehicleDestructible {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = (kit as any)._ as Record<string, any>
  let c = vehicleCtx
  const id = options.id ?? c.key
  const headless = !!options.headless
  const seedBase = strHash(`${c.key}|${id}|${options.seed ?? 0}`)
  let rand = rng(seedBase)
  const ignitionRules = resolveIgnitionRules(options.ignition)
  const fuelFraction = clamp(options.fuel ?? 1, 0, 1)
  // the rolls of ignition have their own stream so that a spark never changes what the other random choices of the vehicle give
  let igniteRand = rng(strHash(`${c.key}|${id}|ignition|${options.seed ?? 0}`))
  let clock = 0

  let model: VehicleModel
  let vis: VehicleVisuals | null = null
  const ps = new Map<string, PState>()
  let js: JState[] = []
  let leaks = new Map<string, Leak>()
  let queue: DestructionEvent[] = []
  let visualDone = new Set<string>()
  let exploded = false
  let blastHandled = false
  let rolled = false
  let rollHandled = false
  let groupsCache: string[][] = []
  let groupOf = new Map<string, number>()
  let wasLit = true
  let deadEngine = false
  let steerSign = 1
  let specCache: DestructibleSpec | null = null

  const frame = (): any => options.frame ?? c.root
  const sync = (): void => {
    c.root.updateWorldMatrix(true, true)
    frame().updateWorldMatrix(true, false)
  }
  const toFrameMatrix = (): any => {
    sync()
    return new THREE.Matrix4().copy(frame().matrixWorld).invert().multiply(c.vehicle.matrixWorld)
  }
  const toWorld = (v: Vec3 | any): Vec3 => {
    const p = Array.isArray(v) ? new V3(v[0], v[1], v[2]) : v.clone()
    const w = c.vehicle.localToWorld(p)
    return [w.x, w.y, w.z]
  }
  const toLocal = (w: Vec3): any => c.vehicle.worldToLocal(new V3(w[0], w[1], w[2]))
  const dirToLocal = (d: Vec3): any => {
    const inv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    return new V3(d[0], d[1], d[2]).transformDirection(inv)
  }
  const dirToWorld = (v: any): Vec3 => {
    const d = v.clone().transformDirection(c.vehicle.matrixWorld)
    return [d.x, d.y, d.z]
  }
  const ev = <T extends DestructionEvent['type']>(e: { type: T } & Record<string, unknown>): DestructionEvent => ({ ...e, object: id, time: r2(clock) }) as unknown as DestructionEvent

  // ---- setup ---------------------------------------------------------------------------------------------------------------------------
  const burnKg = (d: PartDef): number => {
    if (d.role === 'tyre') return d.mass * 0.6
    if (d.material === 'plastic') return d.mass * 0.8
    if (d.role === 'engine') return 4
    if (d.role === 'battery') return 1.5
    if (d.role === 'fuel_tank') return 0
    return d.ignitionC ? 1 : 0
  }
  const setup = (): void => {
    model = buildVehicleModel(kit, c, { hitch: options.hitch })
    ps.clear()
    for (const d of model.parts) {
      const kg = burnKg(d)
      ps.set(d.id, {
        def: d,
        hp: d.hp,
        temp: AMBIENT,
        burning: false,
        fuelKg: kg,
        burnRate: Math.max(0.05, kg / 25),
        char: 0,
        melt: 0,
        dents: [],
        holes: [],
        cracks: [],
        liters: d.contains ? (d.role === 'fuel_tank' ? d.contains.liters * fuelFraction : d.contains.liters) : undefined,
        lost: false,
        status: 'intact',
        flat: false,
        fireLoss: 0,
      })
    }
    js = model.joints.map((d) => ({ def: d, hp: d.strength, progress: 0, open: false, reported: 0 }))
    leaks = new Map()
    queue = []
    visualDone = new Set()
    exploded = false
    blastHandled = false
    rolled = false
    rollHandled = false
    wasLit = true
    deadEngine = false
    rand = rng(seedBase)
    igniteRand = rng(strHash(`${c.key}|${id}|ignition|${options.seed ?? 0}`))
    steerSign = rand() < 0.5 ? -1 : 1
    vis = headless ? null : new VehicleVisuals(kit, c, model)
    recomputeGroups()
  }

  // ---- groups and joints ---------------------------------------------------------------------------------------------------------------------
  const recomputeGroups = (): string[][] => {
    const live = model.parts.filter((p) => !ps.get(p.id)!.lost).map((p) => p.id)
    const parent = new Map<string, string>(live.map((p) => [p, p]))
    const find = (x: string): string => {
      let r = x
      while (parent.get(r) !== r) r = parent.get(r)!
      parent.set(x, r)
      return r
    }
    for (const j of js) if (!j.open && parent.has(j.def.a) && parent.has(j.def.b)) parent.set(find(j.def.a), find(j.def.b))
    const comps = new Map<string, string[]>()
    for (const p of live) {
      const r = find(p)
      if (!comps.has(r)) comps.set(r, [])
      comps.get(r)!.push(p)
    }
    const hubRoot = parent.has(model.hub) ? find(model.hub) : ''
    const list = [...comps.entries()].sort((a, b) => (a[0] === hubRoot ? -1 : b[0] === hubRoot ? 1 : 0))
    groupsCache = list.map(([, v]) => v)
    groupOf = new Map()
    groupsCache.forEach((g, i) => g.forEach((p) => groupOf.set(p, i)))
    return groupsCache
  }
  const attached = (partId: string): boolean => groupOf.get(partId) === 0

  const openJoint = (j: JState, by: 'break' | 'tool' | 'part_lost', out: DestructionEvent[]): void => {
    if (j.open) return
    j.open = true
    j.by = by
    j.progress = 1
    const before = new Set(groupsCache[0] ?? [])
    const groups = recomputeGroups()
    out.push(ev({ type: 'detach', joint: j.def.id, parts: [j.def.a, j.def.b], by, groups: groups.map((g) => [...g]) }))
    if (by === 'part_lost' || !vis) return
    for (const gid of before) {
      if (attached(gid) || ps.get(gid)!.lost || visualDone.has(gid)) continue
      const p = ps.get(gid)!.def
      if (!p.visual) continue
      visualDone.add(gid)
      vis.detach(p, { by: by === 'tool' ? 'tool' : 'break' })
    }
  }

  const wear = (p: PState, amount: number, out: DestructionEvent[]): void => {
    for (const j of js) {
      if (j.open || j.def.a !== p.def.id) continue
      j.hp -= amount * 0.25
      if (j.hp <= 0) openJoint(j, 'break', out)
    }
  }

  const syncZone = (p: PState): void => {
    const zid = p.def.zoneId
    if (!zid) return
    const z = (kit.zonesOf(c) as any[]).find((q) => q.id === zid)
    if (!z) return
    const h = Math.round(clamp((p.hp / p.def.hp) * 100, 0, 100))
    z.health = h
    z.band = kit.bandOf(h)
    if (c.zoneState) c.zoneState.health[zid] = h
  }

  const lose = (p: PState, status: 'broken' | 'melted' | 'ashes', out: DestructionEvent[], point?: Vec3): void => {
    if (p.lost) return
    p.lost = true
    p.status = status
    p.hp = 0
    const d = p.def
    const centre = toWorld(d.box.center)
    if (status === 'broken') {
      out.push(ev({ type: 'fracture', part: d.id, style: FRACTURE[d.material] ?? 'none', fragments: [], point: point ?? centre }))
    }
    syncZone(p)
    if (vis && !visualDone.has(d.id)) {
      visualDone.add(d.id)
      switch (d.role) {
        case 'glass':
          vis.glassBreak(d)
          break
        case 'light':
          vis.breakLight(d, true)
          break
        case 'tyre':
          vis.tyreFlat(d, 0.34)
          break
        case 'mirror':
        case 'bumper':
        case 'door':
        case 'hood':
        case 'lid':
        case 'fender':
        case 'battery':
        case 'hitch':
          if (!vis.detach(d, { by: 'break' }) && status !== 'melted' && d.zoneId && (d.role === 'bumper' || d.role === 'door' || d.role === 'fender')) vis.tearOff(d)
          break
        case 'rim':
          vis.detach(d, { by: 'break' })
          break
        case 'roof':
        case 'panel':
        case 'other':
          vis.tearOff(d)
          break
        default:
          break
      }
    }
    for (const j of js) if (!j.open && (j.def.a === d.id || j.def.b === d.id)) openJoint(j, 'part_lost', out)
    recomputeGroups()
  }

  const damage = (p: PState, amount: number, dtype: DamageType, source: string | undefined, out: DestructionEvent[], cause?: Vec3): void => {
    if (p.lost || !(amount > 0)) return
    const before = p.hp
    p.hp = Math.max(0, p.hp - amount)
    out.push(ev({ type: 'damage', part: p.def.id, amount: r2(before - p.hp), hp: r2(p.hp), damageType: dtype, ...(source ? { source } : {}) }))
    wear(p, amount, out)
    syncZone(p)
    if (p.hp <= 0) lose(p, 'broken', out, cause)
    if (p.def.role === 'tyre' && !p.flat && p.hp < p.def.hp * 0.6 && !p.lost) {
      p.flat = true
      vis?.tyreFlat(p.def, 0.24)
    }
  }

  // ---- geometry helpers ----------------------------------------------------------------------------------------------------------------
  const distToBox = (d: PartDef, v: any): number => {
    const dx = Math.max(Math.abs(v.x - d.box.center[0]) - d.box.size[0] / 2, 0)
    const dy = Math.max(Math.abs(v.y - d.box.center[1]) - d.box.size[1] / 2, 0)
    const dz = Math.max(Math.abs(v.z - d.box.center[2]) - d.box.size[2] / 2, 0)
    return Math.hypot(dx, dy, dz)
  }
  const vol = (d: PartDef): number => d.box.size[0] * d.box.size[1] * d.box.size[2]
  const locate = (v: any, tol: number, skip?: (p: PState) => boolean): PState | null => {
    let best: PState | null = null
    let bd = Infinity
    for (const d of model.parts) {
      const p = ps.get(d.id)!
      if (p.lost || (skip && skip(p))) continue
      const dist = distToBox(d, v)
      if (dist > tol) continue
      if (dist < bd - 1e-6 || (Math.abs(dist - bd) <= 1e-6 && best && vol(d) < vol(best.def))) {
        best = p
        bd = dist
      }
    }
    return best
  }
  const faceNormal = (d: PartDef, v: any): any => {
    const rel = [(v.x - d.box.center[0]) / (d.box.size[0] / 2), (v.y - d.box.center[1]) / (d.box.size[1] / 2), (v.z - d.box.center[2]) / (d.box.size[2] / 2)]
    const k = rel.map(Math.abs).indexOf(Math.max(...rel.map(Math.abs)))
    const n = [0, 0, 0]
    n[k] = rel[k] >= 0 ? 1 : -1
    return new V3(n[0], n[1], n[2])
  }
  const fromVehicle = (v: any, M: any): Vec3 => {
    const p = v.clone().applyMatrix4(M)
    return [p.x, p.y, p.z]
  }
  const armour = (): number => (c.meta.armored || c.meta.bullet ? 30 : 1)
  const resist = (d: PartDef, p: PState): number => {
    let base = RESIST[d.material] ?? 100
    if (d.material === 'glass' && d.hp > 1000) base = 120
    if (d.material === 'glass' && c.meta.bullet) base *= 30
    const k = ROLE_RESIST[d.role] ?? 1
    const arm = d.material === 'steel' || d.material === 'aluminium' ? armour() : 1
    return base * k * arm * (p.dents.length > 3 ? 0.9 : 1)
  }

  // ---- fluids --------------------------------------------------------------------------------------------------------------------------
  const fluidKind = (fluid: string): string => (fluid === 'fuel' ? ((c.spec as any).fuel === 'diesel' ? 'diesel' : 'gasoline') : fluid)
  const startLeak = (p: PState, holePoint: any, caliber: number, out: DestructionEvent[], dirLocal: any): void => {
    const d = p.def
    if (!d.contains || (p.liters ?? 0) <= 0) return
    const cap = d.contains.liters
    const level = d.box.center[1] - d.box.size[1] / 2 + d.box.size[1] * clamp((p.liters ?? 0) / cap, 0.05, 1)
    if (holePoint.y > level + 0.03) return
    const head = clamp((level - holePoint.y) / Math.max(0.05, d.box.size[1]), 0, 1)
    const rate = (d.contains.pressurized ? 0.25 : 0.04 + 0.08 * head) * Math.pow(Math.max(caliber, 3) / 9, 2)
    const cur = leaks.get(d.id)
    const fluid = d.contains.fluid
    if (cur) cur.rate += rate
    else {
      const l: Leak = { rate, fluid, pud: null }
      leaks.set(d.id, l)
      if (vis) {
        const pos = new V3(d.box.center[0], Math.max(0.2, (c.meta.clearance ?? 0.3) * 0.8), d.box.center[2])
        if (fluid === 'coolant') kit.addEmitter(c, new V3(d.box.center[0], d.box.center[1] + 0.2, d.box.center[2]), 'white', { rate: 5, s: 0.8 })
        else if ((c.meta.kind ?? 'car') !== 'boat') l.pud = I.puddle(c, fluidKind(fluid), pos, fluid === 'oil' ? 0.8 : 1.1)
      }
    }
    const out3 = dirToWorld(new V3(dirLocal.x * 0.5, dirLocal.y * 0.5 - 0.6, dirLocal.z * 0.5))
    out.push(ev({ type: 'leak', part: d.id, fluid, point: toWorld(holePoint), direction: r3(out3), rate: r2(rate), pressurized: !!d.contains.pressurized }))
  }

  // ---- fire ----------------------------------------------------------------------------------------------------------------------------
  const centreOf = (d: PartDef): any => new V3(d.box.center[0], d.box.center[1], d.box.center[2])
  const ignite = (p: PState, out: DestructionEvent[]): void => {
    if (p.burning || p.lost) return
    const d = p.def
    p.burning = true
    out.push(ev({ type: 'ignite', part: d.id, point: toWorld(d.box.center) }))
    if (!vis) return
    const cen = centreOf(d)
    kit.addEmitter(c, cen.clone().add(new V3(0, 0.1, 0)), 'fire', { rate: d.role === 'tyre' ? 7 : 10, s: d.role === 'tyre' ? 0.6 : 0.9 })
    kit.addEmitter(c, cen.clone().add(new V3(0, 0.6, 0)), 'black', { rate: 4, s: 1.1 })
    if (d.role === 'fuel_tank' || d.role === 'engine') {
      const l = leaks.get('fuel_tank')
      if (l?.pud && l.fluid === 'fuel') I.igniteFuel(c, l.pud)
    }
  }
  const burningBlast = (centreLocal: any, radius: number, energy: number, source: string | undefined, out: DestructionEvent[]): void => {
    for (const d of model.parts) {
      const p = ps.get(d.id)!
      if (p.lost) continue
      const dist = distToBox(d, centreLocal)
      if (dist > radius) continue
      const base = energy / (1 + dist * dist * 4)
      const shield = SHIELDED.has(d.role) ? 0.25 : 1
      damage(p, base * (BLUNT[d.material] ?? 1) * shield * 0.04, 'explosive', source, out)
    }
  }
  const explode = (tank: PState, source: string | undefined, out: DestructionEvent[]): void => {
    if (exploded) return
    exploded = true
    const d = tank.def
    const spec = d.explodes ?? { energy: 8e5, radius: 5, atC: 320 }
    out.push(ev({ type: 'explode', part: d.id, point: toWorld(d.box.center), energy: spec.energy, radius: spec.radius }))
    tank.liters = 0
    leaks.delete(d.id)
    if (vis) kit.explode(c, { delay: 0.6 })
    else (c as any).blast = (c as any).blast ?? { phase: 'fire', t: 0, T: 0.6 }
    lose(tank, 'broken', out)
    burningBlast(centreOf(d), spec.radius, spec.energy, source, out)
    for (const q of ps.values()) if (!q.lost && q.def.ignitionC && q.def.role !== 'fuel_tank') q.temp = Math.max(q.temp, q.def.ignitionC)
  }
  const heat = (centreLocal: any, radius: number, temp: number, dur: number, out: DestructionEvent[], falloff = 0.05): void => {
    for (const d of model.parts) {
      const p = ps.get(d.id)!
      if (p.lost) continue
      const dist = distToBox(d, centreLocal)
      if (dist > radius + falloff) continue
      const f = 1 - dist / (radius + falloff)
      const k = 1.2 / (1 + d.mass / 10)
      p.temp += (temp - p.temp) * Math.min(1, k * dur * f * 2)
    }
    void out
  }
  const thermal = (out: DestructionEvent[]): void => {
    for (const p of ps.values()) {
      const d = p.def
      if (p.lost) continue
      const fuelTank = d.role === 'fuel_tank'
      const flammable = !!d.ignitionC && (fuelTank ? (p.liters ?? 0) > 0.5 : p.fuelKg > 0)
      if (!p.burning && flammable && p.temp >= (d.ignitionC as number)) ignite(p, out)
      if (fuelTank && d.explodes && p.temp >= d.explodes.atC && (p.liters ?? 0) > 1) explode(p, undefined, out)
    }
  }
  const stepFire = (dt: number, out: DestructionEvent[]): void => {
    const flames: PState[] = []
    for (const p of ps.values()) {
      if (p.lost) continue
      const d = p.def
      if (p.burning) {
        flames.push(p)
        p.temp += (FLAME - p.temp) * Math.min(1, dt * 0.4)
        p.char = Math.min(1, p.char + dt * 0.02)
        if (d.role === 'fuel_tank') {
          if ((p.liters ?? 0) > 0) p.liters = Math.max(0, (p.liters ?? 0) - dt * 0.6)
          if ((p.liters ?? 0) <= 0.01) p.burning = false
        } else {
          p.fuelKg = Math.max(0, p.fuelKg - p.burnRate * dt)
          if (p.fuelKg <= 0) {
            p.burning = false
            out.push(ev({ type: 'burnout', part: d.id, point: toWorld(d.box.center) }))
          }
        }
        p.fireLoss += dt
        if (p.fireLoss >= 0.5) {
          const amount = p.def.hp * 0.012 * p.fireLoss
          p.fireLoss = 0
          damage(p, amount, 'fire', undefined, out)
        }
        // rubber and plastic sag as they burn
        if (!p.lost && (d.material === 'rubber' || d.material === 'plastic')) {
          const before = Math.floor(p.melt * 4)
          p.melt = Math.min(1, p.melt + dt / 12)
          if (Math.floor(p.melt * 4) > before || p.melt >= 1) {
            out.push(ev({ type: 'melt', part: d.id, melt: r2(p.melt) }))
            if (d.role === 'tyre') vis?.tyreMelt(d, p.melt)
          }
          if (p.melt >= 1) lose(p, 'melted', out)
        }
      } else if (d.material === 'plastic' && p.temp > 200) {
        const before = Math.floor(p.melt * 4)
        p.melt = Math.min(1, p.melt + (dt * (p.temp - 200)) / 4000)
        if (Math.floor(p.melt * 4) > before) out.push(ev({ type: 'melt', part: d.id, melt: r2(p.melt) }))
        if (p.melt >= 1) lose(p, 'melted', out)
      }
      if (!p.burning && p.temp > AMBIENT) p.temp = Math.max(AMBIENT, p.temp - dt * 6)
    }
    for (const f of flames) heat(centreOf(f.def), 0.8, 500, dt * 0.5, out, 0)
    fireNearLeak(flames, dt, out)
    thermal(out)
  }
  /** A leaking tank with a burning part (or its own fuel stain on fire) within reach lights: the vapour of the leak meets the flame. */
  const fireNearLeak = (flames: PState[], dt: number, out: DestructionEvent[]): void => {
    const tank = tankPart()
    const leak = tank ? leaks.get(tank.def.id) : undefined
    if (!tank || !leak || tank.lost || tank.burning || exploded || (leak.fluid !== 'fuel' && leak.fluid !== 'diesel')) return
    if (leak.pud?.fire) return light(tank, out)
    const { radius, chancePerSecond } = ignitionRules.fireNear
    if (chancePerSecond <= 0) return
    const near = flames.some((f) => f !== tank && distToBox(tank.def, centreOf(f.def)) - Math.max(...f.def.box.size) / 2 <= radius)
    if (near && igniteRand() < 1 - Math.exp(-chancePerSecond * dt)) light(tank, out)
  }

  // ---- hits ----------------------------------------------------------------------------------------------------------------------------
  const normalOf = (d: PartDef, v: any): any => faceNormal(d, v)
  const ballistic = (h: Hit, out: DestructionEvent[]): void => {
    sync()
    const M = toFrameMatrix()
    const v = toLocal(h.point)
    const p = locate(v, 0.2)
    if (!p) return
    const d = p.def
    const E = h.energy ?? 0
    const cal = h.caliber ?? 9
    const dir = dirToLocal(h.direction ?? [0, 0, -1]).normalize()
    const n = normalOf(d, v)
    const res = resist(d, p)
    const through = E >= res
    const cosInc = Math.abs(dir.dot(n))
    const metal = d.material === 'steel' || d.material === 'aluminium'
    const worldPoint = toWorld(v)
    if (metal && !through && cosInc < 0.3 && E > 40) {
      const refl = dir.clone().addScaledVector(n, -2 * dir.dot(n))
      out.push(ev({ type: 'ricochet', part: d.id, point: worldPoint, direction: r3(dirToWorld(refl)), energy: r2(E * 0.4) }))
      damage(p, E * 0.05, 'ballistic', h.source, out, worldPoint)
      vis?.spark([v.x, v.y, v.z], [refl.x, refl.y, refl.z], 6)
      return
    }
    const holeDiam = Math.max(0.006, (cal / 1000) * (d.material === 'glass' ? 1.4 : 1))
    const push = (hole: boolean): void => {
      if (!hole) return
      const hp: PartState['holes'][number] = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, new THREE.Matrix4().extractRotation(M))), diameter: r2(holeDiam), through }
      p.holes.push(hp)
      out.push(ev({ type: 'hole', part: d.id, hole: hp, worldPoint, ...(through ? { exitPoint: add3(worldPoint, r3(dirToWorld(dir.clone().multiplyScalar(Math.max(0.02, Math.min(d.box.size[0], d.box.size[1], d.box.size[2])))))) } : {}) }))
      vis?.holeDecal([v.x, v.y, v.z], [n.x, n.y, n.z], holeDiam)
      startLeak(p, v, cal, out, dir)
    }
    switch (d.material) {
      case 'glass': {
        const laminated = d.hp > 1000
        const force = clamp(E / 800, 0.3, 1.2)
        const broke = vis ? vis.hitGlass(d, [v.x, v.y, v.z], [dir.x, dir.y, dir.z], force) : !laminated
        if (through || !laminated) push(true)
        if (laminated && !broke) {
          const crack = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, new THREE.Matrix4().extractRotation(M))), length: r2(0.15 + force * 0.35), rays: 6 + Math.round(force * 6) }
          p.cracks.push(crack)
          out.push(ev({ type: 'crack', part: d.id, crack, worldPoint }))
          damage(p, E * 0.5, 'ballistic', h.source, out, worldPoint)
        } else damage(p, laminated ? E * 0.5 : p.hp, 'ballistic', h.source, out, worldPoint)
        break
      }
      case 'rubber': {
        push(through)
        damage(p, E * 0.4, 'ballistic', h.source, out, worldPoint)
        if (through && !p.lost && !p.flat) {
          p.flat = true
          vis?.tyreFlat(d, 0.24)
        }
        break
      }
      default: {
        push(through)
        if (!through && E > 50) {
          const dent: PartState['dents'][number] = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, new THREE.Matrix4().extractRotation(M))), radius: r2(Math.max(0.02, holeDiam * 2)), depth: r2(Math.min(0.03, E / 60000 + 0.002)) }
          p.dents.push(dent)
          out.push(ev({ type: 'dent', part: d.id, dent, worldPoint }))
        }
        vis?.spark([v.x, v.y, v.z], [dir.x, dir.y, dir.z], through ? 4 : 8)
        let amount = through ? E * 0.6 : E * 0.25
        // a pierced battery or alternator is finished
        if (through && (d.role === 'battery' || d.role === 'alternator')) amount = Math.max(amount, p.hp * 0.65)
        damage(p, amount, 'ballistic', h.source, out, worldPoint)
        if (through && d.role === 'fuel_tank') rollIgnition(p, h, metal, out)
      }
    }
  }

  /** The tank is lit: it burns now, and the usual fire (the flames heat it to its explosion point, then the blast of a petrol tank) takes over. */
  const light = (tank: PState, out: DestructionEvent[]): void => {
    tank.temp = Math.max(tank.temp, (tank.def.ignitionC ?? 260) + 1)
    if ((tank.liters ?? 0) > 0.5) ignite(tank, out)
  }
  /**
   * A round went through the wall of the tank: does the fuel that leaks catch? Only if the round carries a spark that works on this wall or a flame,
   * weighed by how full the tank is (a full tank leaks, a nearly empty one lights). A plain bullet only leaks.
   */
  const rollIgnition = (tank: PState, h: Hit, metal: boolean, out: DestructionEvent[]): void => {
    const d = tank.def
    if (!d.contains || tank.burning || (tank.liters ?? 0) <= 0.05) return
    const fill = d.contains.liters > 0 ? (tank.liters ?? 0) / d.contains.liters : 0
    const chance = ignitionChance(h, { sparkTarget: sparkTargetFactor(d.material, metal, ignitionRules), fill, fluid: d.contains.fluid }, ignitionRules)
    if (chance > 0 && igniteRand() < chance) light(tank, out)
  }

  const blunt = (h: Hit, out: DestructionEvent[]): void => {
    sync()
    const M = toFrameMatrix()
    const v = toLocal(h.point)
    const E = h.energy ?? 0
    const first = locate(v, 0.3)
    if (!first) return
    const big = E >= 4000
    const dirv = h.direction ? dirToLocal(h.direction).normalize() : new V3(((c.meta.front ?? 1) + (c.meta.rear ?? -1)) / 2 - v.x, 0, -v.z).normalize()
    const force = clamp(0.3 + E / 70000, 0.3, 1.4)
    if (big && vis) kit.impact(c, v, dirv, force)
    const reach = big ? 0.55 + 0.45 * force : Math.max(h.radius ?? 0.03, 0.05) + 0.08
    const rot = new THREE.Matrix4().extractRotation(M)
    for (const d of model.parts) {
      const p = ps.get(d.id)!
      if (p.lost) continue
      const dist = distToBox(d, v)
      if (dist > reach) continue
      const w = (1 - dist / reach) ** 2
      const shield = SHIELDED.has(d.role) && !big ? 0 : SHIELDED.has(d.role) ? 0.3 : 1
      const amount = E * w * (BLUNT[d.material] ?? 1) * shield
      if (amount <= 0.5) continue
      const n = normalOf(d, v)
      const worldPoint = toWorld(v)
      if (d.material === 'glass') {
        if (amount < d.hp) {
          const crack = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, rot)), length: r2(0.2 + Math.min(0.8, amount / d.hp)), rays: 8 }
          p.cracks.push(crack)
          out.push(ev({ type: 'crack', part: d.id, crack, worldPoint }))
        }
        if (vis && amount >= d.hp * 0.5) vis.hitGlass(d, [v.x, v.y, v.z], [dirv.x, dirv.y, dirv.z], clamp(amount / d.hp, 0.3, 1.2))
      } else if (d.material !== 'rubber' && amount > d.hp * 0.01) {
        const dent: PartState['dents'][number] = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, rot)), radius: r2(reach * 0.6), depth: r2(clamp((0.35 * amount) / d.hp, 0.003, 0.28)) }
        p.dents.push(dent)
        out.push(ev({ type: 'dent', part: d.id, dent, worldPoint }))
      }
      damage(p, amount, 'blunt', h.source, out, worldPoint)
    }
    if (big && !exploded) {
      const tank = [...ps.values()].find((q) => q.def.role === 'fuel_tank' && !q.lost)
      if (tank && distToBox(tank.def, v) <= reach && E > 30000) startLeak(tank, centreOf(tank.def).setY(tank.def.box.center[1] - tank.def.box.size[1] / 2 + 0.05), 12, out, dirv)
    }
  }

  const explosive = (h: Hit, out: DestructionEvent[]): void => {
    sync()
    const v = toLocal(h.point)
    const E = h.energy ?? 0
    const radius = h.radius ?? 3
    const centre = new V3(((c.meta.front ?? 1) + (c.meta.rear ?? -1)) / 2, 0.6, 0)
    const away = centre.clone().sub(v)
    away.y = Math.max(away.y, 0)
    const dir = away.lengthSq() > 1e-6 ? away.normalize() : new V3(0, 1, 0)
    const nearest = Math.min(...model.parts.map((d) => distToBox(d, v)))
    if (nearest > radius) return
    if (vis && E >= 3000) kit.impact(c, v.clone().addScaledVector(dir, -0.1).setY(clamp(v.y, 0.3, 1.2)), dir, clamp(0.4 + E / 60000, 0.4, 1.4), { noStain: true })
    burningBlast(v, radius, E, h.source, out)
    const tank = [...ps.values()].find((q) => q.def.role === 'fuel_tank' && !q.lost)
    if (tank && !exploded) {
      const dist = distToBox(tank.def, v)
      if (dist <= radius) {
        const verdict = kit.blastDamage(c, E / (1 + dist * dist * 4) / 50)
        if (verdict === 'explosion') explode(tank, h.source, out)
        else if (verdict === 'fire') {
          light(tank, out)
          startLeak(tank, centreOf(tank.def).setY(tank.def.box.center[1] - tank.def.box.size[1] / 2 + 0.05), 12, out, dir)
        }
      }
    }
    // heat of the blast ignites tyres and plastics nearby
    heat(v, radius * 0.5, 450, 1, out)
  }

  const fireHit = (h: Hit, out: DestructionEvent[]): void => {
    sync()
    const v = toLocal(h.point)
    heat(v, h.radius ?? 0.4, h.temperature ?? FLAME, h.duration ?? 0.016, out)
    thermal(out)
  }

  // ---- mechanical status ---------------------------------------------------------------------------------------------------------------
  const sound = (role: PartRole): boolean => {
    const list = [...ps.values()].filter((p) => p.def.role === role)
    if (!list.length) return true
    return list.every((p) => !p.lost && attached(p.def.id) && p.hp >= p.def.hp * 0.5)
  }
  const tankPart = (): PState | undefined => [...ps.values()].find((p) => p.def.role === 'fuel_tank' && p.def.contains)
  const computeStatus = (): VehicleStatus => {
    const electric = (c.spec as any).fuel === 'electric'
    const tank = tankPart()
    const fuel = tank ? (tank.liters ?? 0) : electric ? 1 : 1
    const engineOk = sound('engine') && !exploded && fuel > 0.05
    const powered = sound('battery') && sound('alternator')
    const gearOk = sound('gearbox')
    const brakes = [...ps.values()].find((p) => p.def.role === 'brakes')
    const flat = [...ps.values()].filter((p) => p.def.role === 'tyre' && (p.flat || p.lost) && !p.burning).map((p) => p.def.id)
    const brakeLost = brakes ? brakes.lost || !attached(brakes.def.id) : false
    const brakeWorn = brakes ? brakes.hp < brakes.def.hp * 0.5 : false
    const brakeFactor = (brakeLost ? 3.5 : brakeWorn ? 1.8 : 1) * (1 + 0.15 * flat.length)
    const st = [...ps.values()].find((p) => p.def.role === 'steering')
    const stBad = st ? st.lost || !attached(st.def.id) : false
    const stWorn = st ? st.hp < st.def.hp * 0.5 : false
    const flatSide = flat.reduce((s, tid) => s + (ps.get(tid)!.def.box.center[2] < 0 ? -1 : 1), 0)
    const pull = clamp((stBad ? 0.6 : stWorn ? 0.25 : 0) * steerSign + flatSide * 0.12, -1, 1)
    const canStart = powered && engineOk
    return {
      canStart,
      lightsOn: powered,
      canDrive: canStart && gearOk,
      brakeFactor: r2(brakeFactor),
      steerPull: r2(pull),
      flatTyres: flat,
      detached: [...ps.values()].filter((p) => !p.lost && !attached(p.def.id)).map((p) => p.def.id),
      leaking: [...leaks.keys()],
      burning: [...ps.values()].filter((p) => p.burning).map((p) => p.def.id),
      exploded,
      fuelLiters: r2(tank ? (tank.liters ?? 0) : 0),
    } as VehicleStatus
  }
  const applyEffects = (): void => {
    const s = computeStatus()
    if (s.lightsOn !== wasLit) {
      wasLit = s.lightsOn
      vis?.setLights(s.lightsOn)
    }
    if (!s.canStart && !deadEngine) {
      deadEngine = true
      ;(c as any).engineHealth = 0
    } else if (s.canStart && deadEngine) {
      deadEngine = false
      ;(c as any).engineHealth = 1
    }
  }

  // ---- blast and rollover sync -----------------------------------------------------------------------------------------------------------
  const afterBlast = (out: DestructionEvent[]): void => {
    if (blastHandled || !(c as any).exploded) return
    blastHandled = true
    // the kit threw the hood, the doors, the rear bumper and one wheel
    const hood = ps.get(vis?.hood?.id ?? '')
    if (hood && !hood.lost) hood.status = 'damaged'
    for (const p of ps.values()) {
      if (p.lost) continue
      const d = p.def
      if (d.role === 'hood' || d.role === 'door' || (d.role === 'bumper' && d.box.center[0] < 0)) {
        visualDone.add(d.id)
        for (const j of js) if (!j.open && j.def.a === d.id) openJoint(j, 'break', out)
      }
    }
    const left = new Set((c.wheels as any[]).filter((w) => w.parent))
    for (const p of ps.values()) {
      if (p.def.role !== 'rim' || p.lost) continue
      const z = (kit.zonesOf(c) as any[]).find((q) => q.id === p.def.zoneId)
      const ws = (z?.wheels ?? []) as any[]
      if (ws.length && ws.every((w) => !left.has(w))) {
        visualDone.add(p.def.id)
        for (const j of js) if (!j.open && j.def.a === p.def.id) openJoint(j, 'break', out)
      }
    }
    for (const p of ps.values()) {
      if (p.lost) continue
      if (p.def.role === 'tyre' || p.def.material === 'plastic') p.temp = Math.max(p.temp, p.def.ignitionC ?? 0)
      if (p.def.role === 'glass' || p.def.role === 'light') lose(p, 'broken', out)
    }
  }
  const afterRoll = (out: DestructionEvent[]): void => {
    if (rollHandled || !(c as any).flipped) return
    rollHandled = true
    const M = toFrameMatrix()
    const rot = new THREE.Matrix4().extractRotation(M)
    for (const p of ps.values()) {
      if (p.lost) continue
      const d = p.def
      if (d.role === 'roof') {
        const dent: PartState['dents'][number] = { point: r3(fromVehicle(centreOf(d), M)), normal: r3(fromVehicle(new V3(0, 1, 0), rot)), radius: r2(Math.max(d.box.size[0], d.box.size[2]) * 0.4), depth: 0.14 }
        p.dents.push(dent)
        out.push(ev({ type: 'dent', part: d.id, dent, worldPoint: toWorld(d.box.center) }))
        damage(p, d.hp * 0.6, 'blunt', 'rollover', out)
      } else if (d.role === 'pillar') damage(p, d.hp * 0.5, 'blunt', 'rollover', out)
      else if (d.role === 'glass') damage(p, d.material === 'glass' && d.hp > 1000 ? d.hp * 0.55 : d.hp, 'blunt', 'rollover', out)
      else if (d.role === 'mirror') damage(p, d.hp, 'blunt', 'rollover', out)
    }
    for (const tid of ['oil_pan', 'fuel_tank']) {
      const p = ps.get(tid)
      if (p && !p.lost && p.def.contains) {
        damage(p, p.def.hp * 0.2, 'blunt', 'rollover', out)
        startLeak(p, centreOf(p.def).setY(p.def.box.center[1] - p.def.box.size[1] / 2), 16, out, new V3(0, -1, 0))
      }
    }
  }

  // ---- the contract --------------------------------------------------------------------------------------------------------------------
  const describe = (): DestructibleSpec => {
    if (specCache) return specCache
    const M = toFrameMatrix()
    const parts: PartSpec[] = model.parts.map((d) => {
      const bb = new THREE.Box3(new V3(d.box.center[0] - d.box.size[0] / 2, d.box.center[1] - d.box.size[1] / 2, d.box.center[2] - d.box.size[2] / 2), new V3(d.box.center[0] + d.box.size[0] / 2, d.box.center[1] + d.box.size[1] / 2, d.box.center[2] + d.box.size[2] / 2)).applyMatrix4(M)
      const size = bb.getSize(new V3())
      const cen = bb.getCenter(new V3())
      return {
        id: d.id,
        material: d.material,
        shape: { kind: 'box', size: r3([Math.max(0.02, size.x), Math.max(0.02, size.y), Math.max(0.02, size.z)]) },
        position: r3([cen.x, cen.y, cen.z]),
        mass: r2(d.mass),
        hp: d.hp,
        ...(d.contains ? { contains: { fluid: d.contains.fluid, liters: d.contains.liters, ...(d.contains.pressurized ? { pressurized: true } : {}) } } : {}),
        ...(d.explodes ? { explodes: { ...d.explodes } } : {}),
        tags: [...d.tags, d.role],
      }
    })
    const joints: JointSpec[] = model.joints.map((j) => ({ id: j.id, a: j.a, b: j.b, kind: j.kind, strength: j.strength, tools: [...j.tools], seconds: j.seconds }))
    specCache = { name: options.name ?? (c.spec as any).name ?? c.key, parts, joints, tags: ['vehicle', kindOf(c)] }
    return specCache
  }

  const state = (): ObjectState => {
    const parts: PartState[] = model.parts.map((d) => {
      const p = ps.get(d.id)!
      const marked = p.dents.length > 0 || p.holes.length > 0 || p.cracks.length > 0
      const status = p.lost ? p.status : p.hp < p.def.hp || marked ? 'damaged' : 'intact'
      return {
        id: d.id,
        material: d.material,
        status,
        hp: r2(p.hp),
        maxHp: d.hp,
        mass: r2(d.mass * (1 - p.char * 0.2 * (p.def.material === 'plastic' || p.def.role === 'tyre' ? 1 : 0))),
        temperature: r2(p.temp),
        burning: p.burning,
        fuel: r2(p.fuelKg),
        char: r2(p.char),
        melt: r2(p.melt),
        dents: p.dents.map((x) => ({ ...x })),
        holes: p.holes.map((x) => ({ ...x })),
        cracks: p.cracks.map((x) => ({ ...x })),
        ...(p.liters !== undefined ? { liters: r2(p.liters) } : {}),
        group: p.lost ? -1 : (groupOf.get(d.id) ?? -1),
      }
    })
    const joints = js.map((j) => ({
      id: j.def.id,
      a: j.def.a,
      b: j.def.b,
      kind: j.def.kind,
      hp: r2(Math.max(0, j.hp)),
      maxHp: j.def.strength,
      progress: r2(j.progress),
      open: j.open,
      ...(j.open && j.by ? { openedBy: j.by } : {}),
    }))
    return { id, name: options.name ?? (c.spec as any).name ?? c.key, position: [0, 0, 0], rotation: [0, 0, 0, 1], parts, joints, groups: groupsCache.map((g) => [...g]), destroyed: parts.every((p) => p.status === 'broken' || p.status === 'melted' || p.status === 'ashes') }
  }

  const hit = (h: Hit): DestructionEvent[] => {
    const out: DestructionEvent[] = []
    const hh: Hit = h.space === 'local' ? { ...h, space: 'world', point: toWorld(h.point as Vec3) } : h
    if (hh.space === 'local' || !hh.point) return out
    switch (hh.type) {
      case 'ballistic':
        ballistic(hh, out)
        break
      case 'blunt':
      case 'slash':
        blunt(hh, out)
        break
      case 'explosive':
        explosive(hh, out)
        break
      case 'fire':
      case 'heat':
        fireHit(hh, out)
        break
    }
    applyEffects()
    return out
  }

  const update = (dt: number): DestructionEvent[] => {
    clock += dt
    const out: DestructionEvent[] = queue
    queue = []
    // a clip that turns the hood drives it: the kit keeps what it is told
    const hood = (c as any).hood
    if (hood) {
      const sign = hood.sign || 1
      const cur = hood.piv.rotation.z / sign
      if (Math.abs(cur - hood.ang) > 1e-4) {
        hood.ang = cur
        hood.target = cur
      }
    }
    if (vis) kit.tick(c, dt)
    else if ((c as any).blast) I.tickBoom?.(c, dt)
    stepFire(dt, out)
    for (const [pid, l] of leaks) {
      const p = ps.get(pid)!
      p.liters = Math.max(0, (p.liters ?? 0) - l.rate * dt)
      if ((p.liters ?? 0) <= 0) leaks.delete(pid)
    }
    afterBlast(out)
    afterRoll(out)
    applyEffects()
    return out
  }

  const disassemble = (jointId: string, tool: ToolKind, dt: number): number => {
    const j = js.find((x) => x.def.id === jointId)
    if (!j || !j.def.tools.includes(tool)) return -1
    if (j.open) return 1
    j.progress = Math.min(1, j.progress + dt / j.def.seconds)
    const step = Math.floor(j.progress * 4) / 4
    if (step > j.reported && j.progress < 1) {
      j.reported = step
      queue.push(ev({ type: 'disassemble_progress', joint: j.def.id, tool, progress: r2(j.progress) }))
    }
    if (j.progress >= 1) {
      const out: DestructionEvent[] = []
      openJoint(j, 'tool', out)
      queue.push(...out)
      applyEffects()
    }
    return j.progress
  }

  const extinguish = (partId?: string): void => {
    for (const p of ps.values()) {
      if (partId && p.def.id !== partId) continue
      if (p.burning) {
        p.burning = false
        queue.push(ev({ type: 'extinguish', part: p.def.id }))
      }
      p.temp = Math.min(p.temp, 120)
    }
    if (!partId) {
      c.emitters = (c.emitters as any[]).filter((e) => e.kind !== 'fire' && e.kind !== 'black')
    }
  }

  const reset = (): void => {
    const old = c
    const parent = old.root.parent
    const next = kit.build(old.key, old.state)
    if (parent) {
      next.root.position.copy(old.root.position)
      next.root.quaternion.copy(old.root.quaternion)
      next.root.scale.copy(old.root.scale)
      parent.add(next.root)
      parent.remove(old.root)
    }
    kit.dispose(old)
    c = next
    ;(c.root as any).userData = { ...(c.root as any).userData, ...(old.root as any).userData }
    clock = 0
    setup()
  }

  const rollover = (side = 1): void => {
    if (kit.roll(c, side)) rolled = true
    void rolled
  }

  setup()

  const impl: VehicleDestructible = {
    id,
    name: options.name ?? (c.spec as any).name,
    get vehicle() {
      return c
    },
    get model() {
      return model
    },
    describe,
    hit,
    update,
    state,
    reset,
    disassemble,
    extinguish,
    serialize: () => ({
      clock,
      parts: [...ps.entries()].map(([k, p]) => [k, p.hp, p.liters, p.lost, p.status, p.flat]),
      joints: js.map((j) => [j.def.id, j.hp, j.progress, j.open, j.by ?? null]),
    }),
    partName: (pid) => ps.get(pid)?.def.name ?? pid,
    status: computeStatus,
    animations: () => createVehicleClips(model, vis, kit, c),
    partWorldCenter: (pid) => {
      sync()
      const d = ps.get(pid)?.def
      return d ? toWorld(d.box.center) : [0, 0, 0]
    },
    rollover,
    detachedParts: () =>
      [...ps.values()]
        .filter((p) => (!p.lost && !attached(p.def.id)) || (p.lost && p.def.visual && js.some((j) => j.open && j.def.a === p.def.id)))
        .map((p) => p.def.id),
  }
  return impl
}
