/**
 * `createVehicleDestructible`: a vehicle that follows the destruction contract of `@adatechnology/game-contracts` and brings its own rules.
 * Every damage zone and mechanical part is a part with a material, hits become events (dent, hole, crack, fracture, detach, leak, ignite,
 * melt, explode), joints come apart by wear, by a wrench or by breaking, and the hidden mechanics change how the vehicle drives.
 *
 * It depends on the contracts only (types) and on the kit it is given: not on the default destruction world.
 */
import type { Matrix4, Object3D, Vector3 } from '../three-types'

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
import type { SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'
import { ARMOUR_LEVELS, armourLevelOf } from './armour'
import type { ArmourLevel, ArmourLevelId } from './armour'
import { ignitionChance, resolveIgnitionRules, sparkTargetFactor, type IgnitionRules } from '@adatechnology/game-contracts'
import type { VehicleContext, VehicleKit } from '../api'
import type { KitShared, SceneNode } from '../types'
import { clamp, rng, strHash } from '../util'
import { buildVehicleModel, kindOf, type JointDef, type PartDef, type PartRole, type VehicleModel } from './model'
import type { CreaseQueue } from './crease-queue'
import { VehicleVisuals } from './visual'
import { createVehicleClips } from './clips'

export interface VehicleDestructibleOptions {
  /** Object id the host gives (`DestructibleImpl.id`). Default: the vehicle key. */
  id?: string
  /** Display name. Default: the vehicle name. */
  name?: string
  /** Object whose space `describe()` answers in (the wrapper the host placed the vehicle in). Default: `c.root`. */
  frame?: unknown
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
  /** Armour level of this vehicle (`IIIA` civilian, `III` against rifles), or null for none. Default: its spec. */
  armour?: ArmourLevelId | null
  /** Replaces or extends the armour table. */
  armourLevels?: Partial<Record<ArmourLevelId, ArmourLevel>>
  /**
   * One queue that smooths the normals of cut panels for every vehicle that shares it (`createCreaseQueue()`), run by a frame budget. Without it, or while
   * nobody registered the queue with a budget, each vehicle smooths in its own `update` (2.5 ms a frame), as always.
   */
  creaseQueue?: CreaseQueue
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
  /** What the damage leaves for driving: each tyre's health where it stands, the brakes, the engine and the shocks (0 gone .. 1 whole). */
  driveReport(): DriveReport
  /**
   * The engine ran for `seconds` at `load` (0 idle .. 1 full throttle): without coolant it heats up, steams and seizes in a few minutes;
   * without oil it wears and seizes. Call it while the vehicle is driven. Answers the engine temperature, °C.
   */
  runEngine(seconds: number, load: number): number
  /**
   * The vehicle rolled `meters` at `speed` m/s: a flat tyre wears through and tears off (a run-flat insert on an armoured vehicle carries it far
   * at up to 80 km/h), then the bare rim grinds on the road throwing sparks. Answers how many rims are on the road.
   */
  rollFlat(meters: number, speed: number): number
  /** Pushes the drawn body in by `depth` metres around `point` (world), along `direction`: the crumple of a crash. Drawing only. */
  crumple(point: Vec3, direction: Vec3, depth: number): void
}

export type DriveReport = {
  /** `rim`: the tyre is torn off and the bare rim is on the road. */
  readonly tyres: ReadonlyArray<{ readonly x: number; readonly z: number; readonly health: number; readonly rim: boolean }>
  readonly brakes: number
  readonly engine: number
  readonly suspension: number
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
  /** Air left in a tyre, 0..1, and the share it loses per second through its holes. */
  air: number
  airLoss: number
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
  /** the puddle the leak feeds (`kit._.puddle`), null until it lands */
  pud: ReturnType<KitShared['puddle']> | null
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

/** Millimetres of RHA-equivalent steel by part (a car skin is under a millimetre; the engine block stops most rounds). */
const STEEL_MM: Record<string, number> = { panel: 0.8, door: 1.6, hood: 0.8, lid: 0.8, roof: 0.8, fender: 0.8, pillar: 2, frame: 4, rim: 3, engine: 40, gearbox: 25, fuel_tank: 1, radiator: 1, battery: 2, brakes: 10, steering: 8, shocks: 6, oil_pan: 2, alternator: 4, hitch: 8, other: 2 }
/** Armour plate of each level, millimetres of RHA in place of the 0.8 mm skin. */
const ARMOUR_STEEL_MM: Record<'IIIA' | 'III', number> = { IIIA: 4, III: 7 }
/** Below this piercing a round is soft lead (hollow point, slug, buckshot) and opens a wider hole. */
const SOFT_LEAD = 0.8
/** A flat tyre's health for driving (under the driver's flat limit). */
const TYRE_FLAT_HEALTH = 0.1
/** A round this strong or this wide bursts a tyre; a smaller hole leaks this share of the air per second per mm² of hole (a 9 mm hole: flat in about a minute). */
const TYRE_BURST_JOULES = 1500
const TYRE_BURST_CALIBER = 12
const TYRE_LEAK_PER_MM2 = 0.00026
/** A flat tyre driven on tears apart within this many metres at town speed, sooner the faster; a run-flat insert (armoured vehicles) carries it this far at up to 80 km/h, with this much grip. */
const FLAT_TYRE_LIFE_M = 1500
const FLAT_TYRE_TOWN_SPEED = 8
const RUN_FLAT_LIFE_M = 80000
const RUN_FLAT_SPEED = 22
const TYRE_RUNFLAT_HEALTH = 0.6
/** The kit's impact depth for a force: this much at none, this much more per unit of force, within these forces. */
const CRUMPLE_BASE_M = 0.04
const CRUMPLE_PER_FORCE_M = 0.15
const CRUMPLE_MIN_FORCE = 0.3
const CRUMPLE_MAX_FORCE = 1.4
/** A bare rim on the road: the grip it has left, and the share of its strength it grinds away per metre. */
const RIM_HEALTH = 0.05
const RIM_GRIND_PER_M = 0.0004
/** How far an empty tyre sags, and the air under which it is flat. */
const TYRE_FLAT_SAG = 0.24
const TYRE_FLAT_AIR = 0.2
/** Brake fluid under this share of the system's leaves the brakes weaker; with none left only this much (the handbrake, engine braking) remains. */
const BRAKE_FLUID_NEEDED = 0.6
const BRAKE_NO_FLUID = 0.15
/** An engine runs at this temperature; without coolant it climbs this many °C per second at full work, steams at, and seizes at. Under this share of oil it wears this share of its life per second. */
const ENGINE_WORKING_C = 90
const ENGINE_SETTLE_S = 30
const ENGINE_HEATING = 0.5
const ENGINE_STEAM_C = 120
const ENGINE_SEIZE_C = 150
const COOLANT_NEEDED = 0.4
const OIL_NEEDED = 0.3
const OIL_WEAR = 0.004
const ENGINE_SEIZE_HP = 0.2
const EXPANDED_HOLE = 1.6
/** A round going through anything spends at least this share of its energy. */
const MIN_SPENT = 0.08
/** Parts welded to the body shell. */
const WELDED = new Set<string>(['roof', 'pillar', 'frame', 'panel'])
/** Bolted or hinged sheet metal: a blow crumples it in place. */
const CRUMPLES = new Set<string>(['door', 'hood', 'lid', 'fender', 'bumper'])
const FRACTURE: Record<string, 'shatter' | 'snap' | 'tear' | 'none'> = { glass: 'shatter', plastic: 'snap', rubber: 'tear', steel: 'none', aluminium: 'none' }

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const r3 = (v: Vec3): Vec3 => [Math.round(v[0] * 1e5) / 1e5, Math.round(v[1] * 1e5) / 1e5, Math.round(v[2] * 1e5) / 1e5]
const r2 = (n: number): number => Math.round(n * 1e4) / 1e4

export function createVehicleDestructible(kit: VehicleKit, vehicleCtx: VehicleContext, options: VehicleDestructibleOptions = {}): VehicleDestructible {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = (kit as unknown as { _: KitShared })._
  let c = vehicleCtx
  const id = options.id ?? c.key
  const headless = !!options.headless
  const armourId = armourLevelOf(c.meta, options.armour)
  const armourLevel: ArmourLevel | null = armourId ? { ...ARMOUR_LEVELS[armourId], ...options.armourLevels?.[armourId] } : null
  const seedBase = strHash(`${c.key}|${id}|${options.seed ?? 0}`)
  let rand = rng(seedBase)
  const ignitionRules = resolveIgnitionRules(options.ignition)
  const fuelFraction = clamp(options.fuel ?? 1, 0, 1)
  // the rolls of ignition have their own stream so that a spark never changes what the other random choices of the vehicle give
  let igniteRand = rng(strHash(`${c.key}|${id}|ignition|${options.seed ?? 0}`))
  let clock = 0

  let model: VehicleModel
  let vis: VehicleVisuals | null = null
  let releaseCrease: (() => void) | undefined
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

  const frame = (): Object3D => (options.frame ?? c.root) as Object3D
  const sync = (): void => {
    c.root.updateWorldMatrix(true, true)
    frame().updateWorldMatrix(true, false)
  }
  const toFrameMatrix = (): Matrix4 => {
    sync()
    return new THREE.Matrix4().copy(frame().matrixWorld).invert().multiply(c.vehicle.matrixWorld)
  }
  const toWorld = (v: Vec3 | Vector3): Vec3 => {
    const p = Array.isArray(v) ? new V3(v[0], v[1], v[2]) : (v as Vector3).clone()
    const w = c.vehicle.localToWorld(p)
    return [w.x, w.y, w.z]
  }
  const toLocal = (w: Vec3): Vector3 => c.vehicle.worldToLocal(new V3(w[0], w[1], w[2]))
  const dirToLocal = (d: Vec3): Vector3 => {
    const inv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    return new V3(d[0], d[1], d[2]).transformDirection(inv)
  }
  const dirToWorld = (v: Vector3): Vec3 => {
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
    model = buildVehicleModel(kit, c, { hitch: options.hitch, armour: armourLevel })
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
        air: 1,
        airLoss: 0,
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
    releaseCrease?.()
    vis = headless ? null : new VehicleVisuals(kit, c, model)
    releaseCrease = vis && options.creaseQueue ? options.creaseQueue.track(vis) : undefined
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
    const z = kit.zonesOf(c).find((q) => q.id === zid)
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
          if (status === 'broken') vis.tyreTornOff(d)
          else vis.tyreFlat(d, 0.34)
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
    // the welded body (roof, pillars, frame, side panels) bends and tears but stays: it is never knocked off the car as a piece
    // sheet metal hit by a blow crumples and stays on: it only comes off when its hinges or bolts give way (`wear`)
    const crumples = dtype === 'blunt' && CRUMPLES.has(p.def.role) && (p.def.material === 'steel' || p.def.material === 'aluminium')
    p.hp = Math.max(WELDED.has(p.def.role) || crumples ? 1 : 0, p.hp - amount)
    out.push(ev({ type: 'damage', part: p.def.id, amount: r2(before - p.hp), hp: r2(p.hp), damageType: dtype, ...(source ? { source } : {}) }))
    wear(p, amount, out)
    syncZone(p)
    if (p.hp <= 0) lose(p, 'broken', out, cause)
    else if (p.def.role === 'light') vis?.crackLight(p.def, dtype === 'ballistic')
    if (p.def.role === 'tyre' && !p.flat && p.hp < p.def.hp * 0.6 && !p.lost) {
      p.flat = true
      vis?.tyreFlat(p.def, 0.24)
    }
  }

  // ---- geometry helpers ----------------------------------------------------------------------------------------------------------------
  const distToBox = (d: PartDef, v: Vector3): number => {
    const dx = Math.max(Math.abs(v.x - d.box.center[0]) - d.box.size[0] / 2, 0)
    const dy = Math.max(Math.abs(v.y - d.box.center[1]) - d.box.size[1] / 2, 0)
    const dz = Math.max(Math.abs(v.z - d.box.center[2]) - d.box.size[2] / 2, 0)
    return Math.hypot(dx, dy, dz)
  }
  const vol = (d: PartDef): number => d.box.size[0] * d.box.size[1] * d.box.size[2]
  const locate = (v: Vector3, tol: number, skip?: (p: PState) => boolean): PState | null => {
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
  const faceNormal = (d: PartDef, v: Vector3): Vector3 => {
    const rel = [(v.x - d.box.center[0]) / (d.box.size[0] / 2), (v.y - d.box.center[1]) / (d.box.size[1] / 2), (v.z - d.box.center[2]) / (d.box.size[2] / 2)]
    const k = rel.map(Math.abs).indexOf(Math.max(...rel.map(Math.abs)))
    const n = [0, 0, 0]
    n[k] = rel[k] >= 0 ? 1 : -1
    return new V3(n[0], n[1], n[2])
  }
  const fromVehicle = (v: Vector3, M: Matrix4): Vec3 => {
    const p = v.clone().applyMatrix4(M)
    return [p.x, p.y, p.z]
  }
  const armour = (): number => armourLevel?.steel ?? 1
  /** Steel a part puts in a round's way, millimetres of RHA: a skin is a sheet, an armoured car a plate, the engine a block. */
  const steelMm = (d: PartDef): number => {
    const base = STEEL_MM[d.role] ?? STEEL_MM.panel!
    return d.material === 'steel' || d.material === 'aluminium' ? base * (armourLevel ? ARMOUR_STEEL_MM[armourId === 'III' ? 'III' : 'IIIA'] / STEEL_MM.panel! : 1) : base
  }
  /** Does the round go through: by its penetration in steel when the weapon gives it (an AP core goes through more, soft lead less), else by its energy. */
  const goesThrough = (h: Hit, d: PartDef, p: PState, energy: number, res: number): boolean => {
    const piercing = h.piercing ?? 1
    const metal = d.material === 'steel' || d.material === 'aluminium'
    const mm = h.penetration?.steel
    if (metal && mm != null) return mm >= steelMm(d) * (p.dents.length > 3 ? 0.9 : 1)
    return energy * (metal || d.material === 'glass' ? piercing : 1) >= res
  }
  const resist = (d: PartDef, p: PState): number => {
    let base = RESIST[d.material] ?? 100
    if (d.material === 'glass' && d.hp > 1000) base = 120
    if (d.material === 'glass' && armourLevel) base = armourLevel.glassStops
    const k = ROLE_RESIST[d.role] ?? 1
    const arm = d.material === 'steel' || d.material === 'aluminium' ? armour() : 1
    return base * k * arm * (p.dents.length > 3 ? 0.9 : 1)
  }

  // ---- fluids --------------------------------------------------------------------------------------------------------------------------
  const fluidKind = (fluid: string): string => (fluid === 'fuel' ? (c.spec.fuel === 'diesel' ? 'diesel' : 'gasoline') : fluid)
  const startLeak = (p: PState, holePoint: Vector3, caliber: number, out: DestructionEvent[], dirLocal: Vector3): void => {
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
        // hot coolant also steams out of the front; every liquid runs down into a puddle of its own colour
        if (fluid === 'coolant') kit.addEmitter(c, new V3(d.box.center[0], d.box.center[1] + 0.2, d.box.center[2]), 'white', { rate: 5, s: 0.8 })
        if ((c.meta.kind ?? 'car') !== 'boat') l.pud = I.puddle(c, fluidKind(fluid), pos, fluid === 'oil' ? 0.8 : fluid === 'brake_fluid' ? 0.4 : 1.1)
      }
    }
    const out3 = dirToWorld(new V3(dirLocal.x * 0.5, dirLocal.y * 0.5 - 0.6, dirLocal.z * 0.5))
    out.push(ev({ type: 'leak', part: d.id, fluid, point: toWorld(holePoint), direction: r3(out3), rate: r2(rate), pressurized: !!d.contains.pressurized }))
  }

  // ---- fire ----------------------------------------------------------------------------------------------------------------------------
  const centreOf = (d: PartDef): Vector3 => new V3(d.box.center[0], d.box.center[1], d.box.center[2])
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
  const burningBlast = (centreLocal: Vector3, radius: number, energy: number, source: string | undefined, out: DestructionEvent[]): void => {
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
    out.push(ev({ type: 'explode', part: d.id, point: toWorld(d.box.center), energy: spec.energy, radius: spec.radius, ...('effect' in spec && spec.effect !== undefined ? { effect: spec.effect } : {}) }))
    tank.liters = 0
    leaks.delete(d.id)
    if (vis) kit.explode(c, { delay: 0.6 })
    else c.blast = c.blast ?? { phase: 'fire', t: 0, T: 0.6 }
    lose(tank, 'broken', out)
    burningBlast(centreOf(d), spec.radius, spec.energy, source, out)
    for (const q of ps.values()) if (!q.lost && q.def.ignitionC && q.def.role !== 'fuel_tank') q.temp = Math.max(q.temp, q.def.ignitionC)
  }
  const heat = (centreLocal: Vector3, radius: number, temp: number, dur: number, out: DestructionEvent[], falloff = 0.05): void => {
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
  const normalOf = (d: PartDef, v: Vector3): Vector3 => faceNormal(d, v)
  const ballistic = (h: Hit, out: DestructionEvent[]): void => {
    sync()
    const M = toFrameMatrix()
    const v = toLocal(h.point)
    const p = (h.part ? ps.get(h.part) : undefined) ?? locate(v, 0.2)
    if (!p) return
    const d = p.def
    const E = h.energy ?? 0
    const cal = h.caliber ?? 9
    const dir = dirToLocal(h.direction ?? [0, 0, -1]).normalize()
    const n = h.normal ? dirToLocal(h.normal).normalize() : normalOf(d, v)
    const res = resist(d, p)
    const through = goesThrough(h, d, p, E, res)
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
    // a hollow point or soft lead opens up in the panel: a wider hole than its calibre
    const opens = (h.piercing ?? 1) < SOFT_LEAD ? EXPANDED_HOLE : 1
    const holeDiam = Math.max(0.006, (cal / 1000) * (d.material === 'glass' ? 1.4 : 1) * opens)
    /** What a round keeps after going through: it spends on the part the share of its penetration the part's steel takes (a skin little, a door about half of a pistol round), else the part's resistance out of its energy. */
    const energyLeft = (): number => {
      const metal = d.material === 'steel' || d.material === 'aluminium'
      const mm = h.penetration?.steel
      const spent = metal && mm ? clamp(steelMm(d) / mm, MIN_SPENT, 1) : clamp(res / Math.max(E, 1), MIN_SPENT, 1)
      return E * (1 - spent)
    }
    const push = (hole: boolean): void => {
      if (!hole) return
      const hp: PartState['holes'][number] = { point: r3(fromVehicle(v, M)), normal: r3(fromVehicle(n, new THREE.Matrix4().extractRotation(M))), diameter: r2(holeDiam), through }
      p.holes.push(hp)
      out.push(ev({ type: 'hole', part: d.id, hole: hp, worldPoint, ...(through ? { energyLeft: r2(energyLeft()) } : {}), ...(through ? { exitPoint: add3(worldPoint, r3(dirToWorld(dir.clone().multiplyScalar(Math.max(0.02, Math.min(d.box.size[0], d.box.size[1], d.box.size[2])))))) } : {}) }))
      vis?.holeDecal([v.x, v.y, v.z], [n.x, n.y, n.z], holeDiam, d)
      if (d.role === 'mirror') vis?.shatterMirror(d.id)
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
          damage(p, E * (armourLevel && !through ? armourLevel.glassTakes : 0.5), 'ballistic', h.source, out, worldPoint)
        } else damage(p, laminated ? E * 0.5 : p.hp, 'ballistic', h.source, out, worldPoint)
        break
      }
      case 'rubber': {
        push(through)
        damage(p, E * 0.4, 'ballistic', h.source, out, worldPoint)
        if (through && !p.lost && !p.flat) {
          // a rifle round, a slug or a big tear bursts it at once; a small hole lets the air out over seconds to minutes
          if (E >= TYRE_BURST_JOULES || cal >= TYRE_BURST_CALIBER) deflate(p, 1)
          else p.airLoss += TYRE_LEAK_PER_MM2 * Math.PI * (cal / 2) ** 2
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
    const electric = c.spec.fuel === 'electric'
    const tank = tankPart()
    const fuel = tank ? (tank.liters ?? 0) : electric ? 1 : 1
    const engineOk = sound('engine') && !exploded && !seized && fuel > 0.05
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
      ;c.engineHealth = 0
    } else if (s.canStart && deadEngine) {
      deadEngine = false
      ;c.engineHealth = 1
    }
  }

  // ---- blast and rollover sync -----------------------------------------------------------------------------------------------------------
  const afterBlast = (out: DestructionEvent[]): void => {
    if (blastHandled || !c.exploded) return
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
    const left = new Set(c.wheels.filter((w) => w.parent))
    for (const p of ps.values()) {
      if (p.def.role !== 'rim' || p.lost) continue
      const z = kit.zonesOf(c).find((q) => q.id === p.def.zoneId)
      const ws: Object3D[] = z?.wheels ?? []
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
    if (rollHandled || !c.flipped) return
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
    specCache = { name: options.name ?? c.spec.name ?? c.key, parts, joints, tags: ['vehicle', kindOf(c)] }
    return specCache
  }

  const buildState = (): ObjectState => {
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
    return { id, name: options.name ?? c.spec.name ?? c.key, position: [0, 0, 0], rotation: [0, 0, 0, 1], parts, joints, groups: groupsCache.map((g) => [...g]), destroyed: parts.every((p) => p.status === 'broken' || p.status === 'melted' || p.status === 'ashes') }
  }

  // the host reads state() per part per frame; it only changes when a hit, a tool, a fire, a leak or a blast/roll happened
  let stateCache: ObjectState | undefined
  const state = (): ObjectState => (stateCache ??= buildState())
  const isSimulating = (): boolean => {
    if (leaks.size > 0) return true
    for (const p of ps.values()) if (!p.lost && (p.burning || p.temp > AMBIENT || (p.airLoss > 0 && p.air > 0))) return true
    return false
  }

  let engineHeat = ENGINE_WORKING_C
  let seized = false
  let steaming = false
  const surfaceRays = new THREE.Raycaster()
  // batched meshes leave the camera layer (createStaticBatcher), not the world: rays still find them
  surfaceRays.layers.enableAll()
  surfaceRays.camera = new THREE.PerspectiveCamera()
  let meshParts: Map<Object3D, string> | null = null
  const paneParts = (): Map<Object3D, string> => {
    if (meshParts) return meshParts
    meshParts = new Map()
    for (const d of model.parts) {
      if (d.role !== 'glass') continue
      const z = kit.zonesOf(c).find((q) => q.id === d.zoneId)
      for (const g of z?.glass ?? d.panes ?? []) meshParts.set(g, d.id)
    }
    return meshParts
  }
  const isDrawnSurface = (o: Object3D): boolean => {
    for (let q: Object3D | null = o; q && q !== c.vehicle; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost) return false
    return true
  }
  /** The part a drawn mesh belongs to: its pane, the door hanging it, the piece drawn for it, else the smallest box of bodywork at the point. */
  const partOfSurface = (o: Object3D, v: Vector3): PState | null => {
    const pane = paneParts().get(o)
    if (pane) return ps.get(pane) ?? null
    for (let q: Object3D | null = o; q && q !== c.vehicle; q = q.parent) {
      if (vis?.plateIdOf(q)) return ps.get(vis.plateIdOf(q)!) ?? null
      const piece = vis?.extraIdOf(q)
      if (piece) return ps.get(piece) ?? null
    }
    return locate(v, 0.08, (p) => p.def.role === 'glass')
  }
  /**
   * The meshes a ray can meet: drawn ones, pruned at the first hidden, decal or ghost node, and never a copy of the parts made for drawing
   * (`userData.noSurfaceRay`: the static batches of the vehicle LOD, one merged mesh per material over the same triangles). Testing those too
   * doubled the triangles a ray reads, and the room's aim reads it every frame (perf.mjs, 2026-11-03: up to 270 ms in a frame on software GL).
   */
  const surfaceMeshes: Object3D[] = []
  const collectSurfaces = (o: Object3D): void => {
    if (!o.visible || o.userData.decal || o.userData.ghost || o.userData.noSurfaceRay) return
    if ((o as SceneNode).isMesh) surfaceMeshes.push(o)
    for (const child of o.children) collectSurfaces(child)
  }
  const surfaceRay = (ray: SurfaceRay): SurfaceRayHit | null => {
    sync()
    surfaceRays.set(new V3(ray.origin[0], ray.origin[1], ray.origin[2]), new V3(ray.direction[0], ray.direction[1], ray.direction[2]))
    surfaceRays.far = ray.maxDistance
    surfaceMeshes.length = 0
    // the vehicle's own node is not checked for visibility (the LOD hides the full model above it; hit tests still read it)
    for (const child of c.vehicle.children) collectSurfaces(child)
    for (const h of surfaceRays.intersectObjects(surfaceMeshes, false)) {
      if (!h.face || !isDrawnSurface(h.object)) continue
      const p = partOfSurface(h.object, c.vehicle.worldToLocal(h.point.clone()))
      if (!p || p.lost || ray.ignored?.(p.def.id)) continue
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld)
      if (n.dot(surfaceRays.ray.direction) > 0) n.negate()
      return { part: p.def.id, point: [h.point.x, h.point.y, h.point.z], normal: [n.x, n.y, n.z], distance: h.distance, pathLen: 0.02 }
    }
    return null
  }

  const hit = (h: Hit): DestructionEvent[] => {
    stateCache = undefined
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

  const runFlat = armourId != null
  /** A tyre's grip for driving: whole by its wear and air; flat, it barely holds (a run-flat insert keeps most); torn off, the rim is on the road. */
  const tyreHealth = (p: PState): number => {
    if (p.lost) return RIM_HEALTH
    if (p.flat) return runFlat ? TYRE_RUNFLAT_HEALTH : TYRE_FLAT_HEALTH
    return Math.min(p.hp / p.def.hp, 0.2 + 0.8 * p.air)
  }
  /** The tyre on a rim: the nearest one. */
  const tyreOf = (rim: PState): PState | undefined => {
    let best: PState | undefined
    let bestD = Infinity
    for (const p of ps.values()) {
      if (p.def.role !== 'tyre') continue
      const d = Math.hypot(p.def.box.center[0] - rim.def.box.center[0], p.def.box.center[2] - rim.def.box.center[2])
      if (d < bestD) [best, bestD] = [p, d]
    }
    return best
  }
  /** Lets the air of a tyre out by `share`: it sags as it empties and is flat under the driver's limit. */
  const deflate = (p: PState, share: number): void => {
    p.air = Math.max(0, p.air - share)
    vis?.tyreFlat(p.def, TYRE_FLAT_SAG * (1 - p.air))
    if (p.air <= TYRE_FLAT_AIR) p.flat = true
  }
  const update = (dt: number): DestructionEvent[] => {
    for (const p of ps.values()) if (p.airLoss > 0 && p.air > 0 && !p.lost) deflate(p, p.airLoss * dt)
    clock += dt
    const out: DestructionEvent[] = queue
    queue = []
    const wasSimulating = isSimulating()
    const handledBefore = (blastHandled ? 1 : 0) + (rollHandled ? 2 : 0)
    // a clip that turns the hood drives it: the kit keeps what it is told
    const hood = c.hood
    if (hood) {
      const sign = hood.sign || 1
      const cur = hood.piv.rotation.z / sign
      if (Math.abs(cur - hood.ang) > 1e-4) {
        hood.ang = cur
        hood.target = cur
      }
    }
    if (vis) kit.tick(c, dt)
    else if (c.blast) I.tickBoom?.(c, dt)
    stepFire(dt, out)
    for (const [pid, l] of leaks) {
      const p = ps.get(pid)!
      p.liters = Math.max(0, (p.liters ?? 0) - l.rate * dt)
      if ((p.liters ?? 0) <= 0) leaks.delete(pid)
    }
    afterBlast(out)
    afterRoll(out)
    applyEffects()
    vis?.pump()
    if (wasSimulating || out.length > 0 || handledBefore !== (blastHandled ? 1 : 0) + (rollHandled ? 2 : 0)) stateCache = undefined
    return out
  }

  const disassemble = (jointId: string, tool: ToolKind, dt: number): number => {
    const j = js.find((x) => x.def.id === jointId)
    if (!j || !j.def.tools.includes(tool)) return -1
    if (j.open) return 1
    stateCache = undefined
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
    stateCache = undefined
    for (const p of ps.values()) {
      if (partId && p.def.id !== partId) continue
      if (p.burning) {
        p.burning = false
        queue.push(ev({ type: 'extinguish', part: p.def.id }))
      }
      p.temp = Math.min(p.temp, 120)
    }
    if (!partId) {
      c.emitters = c.emitters.filter((e) => e.kind !== 'fire' && e.kind !== 'black')
    }
  }

  const reset = (): void => {
    stateCache = undefined
    const old = c
    const parent = old.root.parent
    const next = kit.build(old.key, old.state, old.scenario != null ? { scenario: old.scenario } : undefined)
    if (parent) {
      next.root.position.copy(old.root.position)
      next.root.quaternion.copy(old.root.quaternion)
      next.root.scale.copy(old.root.scale)
      parent.add(next.root)
      parent.remove(old.root)
    }
    kit.dispose(old)
    c = next
    ;c.root.userData = { ...c.root.userData, ...old.root.userData }
    clock = 0
    setup()
  }

  const rollover = (side = 1): void => {
    stateCache = undefined
    if (kit.roll(c, side)) rolled = true
    void rolled
  }

  setup()

  const impl: VehicleDestructible = {
    id,
    name: options.name ?? c.spec.name,
    get vehicle() {
      return c
    },
    get model() {
      return model
    },
    describe,
    hit,
    surfaceRay,
    update,
    state,
    reset,
    dispose: () => {
      releaseCrease?.()
      releaseCrease = undefined
    },
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
    crumple: (point: Vec3, direction: Vec3, depth: number): void => {
      if (!vis || depth <= 0) return
      sync()
      const force = clamp((depth - CRUMPLE_BASE_M) / CRUMPLE_PER_FORCE_M, CRUMPLE_MIN_FORCE, CRUMPLE_MAX_FORCE)
      kit.impact(c, toLocal(point), dirToLocal(direction).normalize(), force, { maxDepth: depth })
      stateCache = undefined
    },
    rollFlat: (meters: number, speed: number): number => {
      for (const p of ps.values()) {
        if (p.def.role !== 'tyre' || !p.flat || p.lost) continue
        const life = runFlat ? RUN_FLAT_LIFE_M * Math.min(1, RUN_FLAT_SPEED / Math.max(speed, 1)) : FLAT_TYRE_LIFE_M * clamp(FLAT_TYRE_TOWN_SPEED / Math.max(speed, 1), 0.2, 1.5)
        p.hp = Math.max(0, p.hp - (p.def.hp * meters) / life)
        if (p.hp > 0) continue
        const at = toWorld(p.def.box.center)
        lose(p, 'broken', queue, at)
        queue.push(ev({ type: 'debris', part: p.def.id, kind: 'fibers', point: at, normal: [0, 1, 0], count: 12, speed: Math.max(2, speed * 0.5) }))
      }
      let grinding = 0
      for (const rim of ps.values()) {
        if (rim.def.role !== 'rim' || rim.lost || !tyreOf(rim)?.lost) continue
        grinding += 1
        rim.hp = Math.max(1, rim.hp - rim.def.hp * RIM_GRIND_PER_M * meters)
        const [x, y, z] = rim.def.box.center
        queue.push(ev({ type: 'debris', part: rim.def.id, kind: 'sparks', point: toWorld([x, y - rim.def.box.size[1] / 2, z]), normal: [0, 1, 0], count: Math.min(30, Math.ceil(4 + speed)), speed: Math.max(2, speed * 0.4) }))
      }
      stateCache = undefined
      return grinding
    },
    runEngine: (seconds: number, load: number): number => {
      const engine = [...ps.values()].find((p) => p.def.role === 'engine')
      if (!engine || engine.lost || seized) return engineHeat
      const share = (fluid: string): number => {
        const list = [...ps.values()].filter((p) => p.def.contains?.fluid === fluid)
        return list.length ? Math.min(...list.map((p) => (p.liters ?? 0) / p.def.contains!.liters)) : 1
      }
      const coolant = share('coolant')
      const oil = share('oil')
      const work = 0.4 + 0.6 * clamp(load, 0, 1)
      // the cooling holds the engine at its working temperature while there is coolant enough; below that it climbs with the load
      if (coolant < COOLANT_NEEDED) engineHeat += ((COOLANT_NEEDED - coolant) / COOLANT_NEEDED) * ENGINE_HEATING * work * seconds
      else engineHeat += (ENGINE_WORKING_C - engineHeat) * Math.min(1, seconds / ENGINE_SETTLE_S)
      // with no oil the bearings wear through
      if (oil < OIL_NEEDED) engine.hp = Math.max(0, engine.hp - engine.def.hp * OIL_WEAR * work * seconds * ((OIL_NEEDED - oil) / OIL_NEEDED))
      if (engineHeat >= ENGINE_STEAM_C && vis && !steaming) {
        steaming = true
        kit.addEmitter(c, new V3(engine.def.box.center[0], engine.def.box.center[1] + 0.4, 0), 'white', { rate: 8, s: 1 })
      }
      if (engineHeat >= ENGINE_SEIZE_C || engine.hp <= engine.def.hp * ENGINE_SEIZE_HP) {
        seized = true
        queue.push(ev({ type: 'damage', part: engine.def.id, amount: 0, hp: r2(engine.hp), damageType: 'heat' }))
      }
      stateCache = undefined
      return engineHeat
    },
    driveReport: (): DriveReport => {
      const health = (role: PartRole): number => {
        const list = [...ps.values()].filter((p) => p.def.role === role)
        if (!list.length) return 1
        return Math.min(...list.map((p) => (p.lost || !attached(p.def.id) ? 0 : p.hp / p.def.hp)))
      }
      const tyres = [...ps.values()]
        .filter((p) => p.def.role === 'tyre')
        .map((p) => ({ x: p.def.box.center[0], z: p.def.box.center[2], health: tyreHealth(p), rim: p.lost }))
      const status = computeStatus()
      // the brakes need their fluid: a leaking system loses pressure and the pedal sinks
      const brakeSystem = [...ps.values()].find((p) => p.def.role === 'brakes' && p.def.contains)
      const fluidLeft = brakeSystem ? clamp((brakeSystem.liters ?? 0) / brakeSystem.def.contains!.liters / BRAKE_FLUID_NEEDED, 0, 1) : 1
      return { tyres, brakes: Math.min(1, 1 / status.brakeFactor) * (BRAKE_NO_FLUID + (1 - BRAKE_NO_FLUID) * fluidLeft), engine: status.canStart ? health('engine') : 0, suspension: health('shocks') }
    },
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
