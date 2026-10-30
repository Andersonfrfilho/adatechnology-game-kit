import { chainDelayOf, drawChainDelay, FIRE_PRIME_C, shotDamageFractionOf } from './chain'
import type { ChainTrigger } from './chain'
import { planFragments } from './fracture'
import type { PlannedFragment } from './fracture'
import { cellsOutside, cellsWithin, marksInBox, planeAxes, unitGrid } from './breach'
import type { LocalHole, UnitCell } from './breach'
import { layersEnergy, layersThickness, MAX_SPALLS, outerLayer, resolveLayer, thinAxisOf } from './layers'
import type { LayerRT } from './layers'
import { clipBarsToDisc, rebarBars, rebarMass } from './rebar'
import {
  GRAVITY, bendGeometry, blastImpulse, isReinforced, elasticEnergy, impulseEnergy, isFlexural, lineLoad, momentOfEnergy, resolveFlexure, resolveMasonry, sectionMoments, sectionWidth,
  spanMoment, spanOf, tensionSteel,
} from './flexure'
import type { BendGeometry } from './flexure'
import { footingSoil, pileCapacity, pileStiffness, profileOf, resolveSoil, soilAt, solveFoundation, stiffnessCentre, subgradeModulus, yieldSprings } from './soil'
import type { SoilSpring } from './soil'
import { analyzeWind, damperTuning, exposureOf, gustAt, makeGust, meanHeightFactor, resolveWind, shapeAt, stepSway, tensionCapacity } from './wind'
import type { Gust, ResolvedWind, SwayState, SwaySystem, WindAnalysis, WindCase, WindPartInput } from './wind'
import { JOINT_DEFAULTS, inferJoints, MATERIALS, partCapacity, partMass, partThickness, partVolume, fragility } from './materials'
import { aabbOf, createRng, distanceToShape, quat, quatFromEuler, rayShape, rotateVec, shapeArea, shapeBound, shapeDims, surfacePoint, toLocal, toWorld, vec } from './math'
import type { DestructibleImpl } from './contracts'
import type {
  AddOptions, Crack, DamageType, DebrisKind, DestructibleSpec, Dent, DestructionEvent, DestructionEventType, DestructionOptions, DestructionSnapshot,
  DamageStage, DestructionWorld, Fragment, FractureStyle, Hit, HitResult, Hole, JointSpec, JointState, MaterialDef, MaterialId, ObjectRuntime, ObjectState, PartRuntime, PartSpec,
  PartState, Quat, RayHit, ToolKind, Vec3, SoilProfile, SoilState, WindOptions, WindState,
  BlastOptions, BlastReport, ConfinementOptions, FragmentHitOptions, ShelterOptions,
  BallisticExtras,
} from './types'
import { ignitionChance, resolveIgnitionRules, sparkTargetFactor } from '@adatechnology/game-contracts'

/** Hit points removed per joule (before the material's `damageScale`). */
/** Metres: a ductile part this thin or thinner dishes around a bullet hole. */
const THIN_SHEET_DISHING = 0.005
const DMG_PER_J = 0.02
/** Fraction of a blast's energy that reaches a part at distance 0. */
const BLAST_COUPLING = 0.1
/**
 * Blast options (all off until asked for). Shelter: a part the line from the blast to the target crosses lets through `exp(-r / k)`, `r` being the
 * hit points of the slab it crosses per square metre (`hpPerKg * density * path * damageScale.shelter`). Fragment hits: up to 24 fragments, half their
 * kinetic energy lands as a blunt hit, thrown at most 6 m (and `speed * 0.4 s`) within 10 degrees of their aim. Confinement: 26 rays reaching
 * `1.5 * radius`, multiplier `1 + 1.5 * closedShare^2 * clamp(radius / meanDistance, 0, 2)` up to 3.
 */
export const SHELTER_DEFAULTS: Required<ShelterOptions> = { k: 2800, brokenTransmission: 0.5, minPath: 0.005 }
export const FRAGMENT_HIT_DEFAULTS: Required<FragmentHitOptions> = { max: 24, energyFactor: 0.5, hitType: 'blunt', range: 6, flightTime: 0.4, spread: 10, aim: 40 }
export const CONFINEMENT_DEFAULTS: Required<ConfinementOptions> = { rays: 26, reach: 1.5, gain: 1.5, power: 2, max: 3 }
const FLAMMABLE_FLUIDS = ['gas', 'fuel']
/** Diameter in metres of the opening `vent` makes when none is given: a cylinder valve (about 8 mm). */
const VENT_DIAMETER = 0.008
/** A flame lights a flammable leak when it reaches this temperature (the auto-ignition of propane in air is about 470 °C; a lighter flame is above 1000 °C). */
const FLAME_LIGHTS_LEAK_C = 470
/** Staged parts: default breach radius (m), blast multiplier on the breach area, area a part must lose to open (m²), and the share of capacity the bare cage keeps. */
const BREACH_RADIUS = 0.55
const BREACH_BLAST_FACTOR = 6
const BREACH_AREA = 0.25
/** Metres of reach per cube root of kilojoule for a blast to open a breach. */
const BREACH_BLAST_REACH = 0.12
const RESIDUAL_CAPACITY = 0.15
/** Long wooden parts break where they are hit: band length along the part (m) and how much longer than wide a part must be. */
const SEVER_BAND = 0.1
const SEVER_ASPECT = 3
/** A round that goes through wood tears its exit out in splinters: its damage counts this many times over in the band it crosses. */
const SEVER_BALLISTIC = 2
/** Joules per piece a blow tears out of a material that tears (`MaterialHit.tearJoules` default): a round leaving wood tears 2 to 7 splinters. */
const TEAR_JOULES = 150
/** Running number of the torn pieces (their ids). */
let tears = 0
/** Metres two parts may be apart and still rest on each other, for the span of a beam or a slab. */
const SUPPORT_TOLERANCE = 0.05
/** Unit-sized fragments of a whole wall: at most this many times `maxFragments`. A breach picks its units from a grid of up to `BREACH_GRID_CAP`. */
const UNIT_FRAGMENT_FACTOR = 4
const BREACH_GRID_CAP = 4096
/** Joules per kilogram of a masonry unit that knock it out of its wall (a 4 kg brick: two 9 mm rounds, one rifle round). */
const CHIP_ENERGY = 200
/** Share of a hit's energy the units next to the one hit take, at the edge of the unit hit (falls to 0 at the hit's radius). */
const CHIP_SPLASH = 0.5

/** A cut only goes through a slice of the part, so a part longer than `CUT_SLICE` costs no more to cut than a 1 m piece of the same section. */
const CUT_SLICE = 1
const cutFactorOf = (shape: PartSpec['shape']): number => clamp(Math.max(...shapeDims(shape)) / CUT_SLICE, 1, 50)

interface PartRT {
  spec: PartSpec
  mat: MaterialDef
  st: PartState
  q: Quat
  /** Current object-local position (the spec's, unless moved by `setPartPose`). */
  pos: Vec3
  mass0: number
  fuel0: number
  area: number
  thickness: number
  /** Slash damage multiplier: longest dimension / 1 m (1..50). */
  cutFactor: number
  dims: Vec3
  bound: number
  rt: PartRuntime
  /** Structural role other than `none`. */
  structural: boolean
  anchored: boolean
  cap: number
  /** Structural part that never had a support path (the spec itself leaves it floating): it is held by its joints like a non-structural part and does not collapse by itself. */
  orphan: boolean
  /** The part has layers, units, reinforcement or a breach: it goes through damage stages. */
  staged: boolean
  /** Axis the part is thinnest along (the wall's depth). */
  thin: number
  layers: LayerRT[]
  /** Bending geometry, for parts in the bending model (`structure.flexure`). */
  bend?: BendGeometry
  /** Span in metres between the supports it rests on now (0: it rests along its whole length, or on nothing). */
  span: number
  /** Supports the span was measured for (indices joined), to measure it again only when they change. */
  spanKey: string
  /** Moment at rest in N m of the section that bends under its weight. */
  restMoment: number
  /** Load in kg that bends it: its own mass and what rests on it away from its supports. */
  bendLoad: number
  /** Overloaded in bending without steel that holds: when it fails it snaps in two instead of crumbling. */
  snap: boolean
}

interface JointRT {
  spec: Required<JointSpec>
  st: JointState
  ia: number
  ib: number
  bears: boolean | 'a_on_b' | 'b_on_a'
  /** Object-local position. */
  pos: Vec3
  step: number
}

interface ObjRT {
  id: string
  spec: DestructibleSpec
  st: ObjectState
  parts: PartRT[]
  byId: Map<string, PartRT>
  idx: Map<string, number>
  joints: JointRT[]
  jointMap: Map<string, JointRT>
  byPart: Map<string, JointRT[]>
  /** Local bounding sphere. */
  bc: Vec3
  br: number
  active: boolean
  tmp: number[]
  hasStructure: boolean
  /** Set only while `build` solves the structure for the first time. */
  seeding?: boolean
  dirty: boolean
  maxStress: number
  collapsed: Set<string>
  /** Structural parts with no support path to an anchored part (they fall). */
  unsup: boolean[]
  anyAnchor: boolean
  /** Creation order of the object in this world: breaks ties between parts that go off at the same time. */
  order: number
  /** The pose the host gave (`add`, `setTransform`); `st.position`/`st.rotation` are this with the soil's settlement and tilt on top. */
  base: { pos: Vec3; rot: Quat }
  /** The ground under the object (`DestructibleSpec.soil`), when it has foundations on it. */
  soil?: SoilRT
  /** The wind on the object (`DestructionOptions.wind`), when the world has wind and the object is a structure. */
  wind?: WindRT
}

interface WindRT {
  /** The wind of the world with this object's `DestructibleSpec.wind` over it, as of the last analysis. */
  cfg: ResolvedWind
  gust: Gust
  /** What the gust was made for (speed, terrain), to make it again when the wind changes. */
  gustKey: string
  analysis: WindAnalysis | null
  /** Parts of the object that went into the analysis, by input index. */
  parts: number[]
  sys: SwaySystem | null
  /** Mass ratio of the damper and its modal weight in the system (0 without one). */
  mu: number
  dyn: SwayState & { peak: number }
  /** Tension capacity of each wall and column, by part index. */
  tension: Map<number, number>
  /** Time and values of the last `sway` event. */
  emitted: { t: number; peak: number; status: WindState['status'] }
}

interface SoilRT {
  profile: SoilProfile
  s: number
  a: number
  b: number
  /** Out-of-plumb of the building, as slopes along x and z. */
  imp: [number, number]
  /** Pivot of the tilt: the centre of stiffness at the level of the base, object-local. */
  pivot: Vec3
  /** The structure changed since the soil was last solved. */
  dirty: boolean
  /** Permanent settlement of the soil under each spring (by `SoilSpring` key) from yielding. */
  sets: Map<string, number>
  /** Time and values of the last `settle` event. */
  emitted: { t: number; s: number; tilt: number; status: SoilState['status'] }
}

interface Carry {
  parts: Map<string, { st: PartState; rt: PartRuntime }>
  joints: Map<string, { st: JointState; step: number }>
  collapsed?: string[]
  soil?: SoilState
  soilSets?: Record<string, number>
  wind?: [number, number, number, number, number]
}


interface Loc {
  p: PartRT
  point: Vec3
  normal: Vec3
  dir: Vec3
  pathLen: number
}

interface ImplRT {
  impl: DestructibleImpl
  position: Vec3
  rotation: Quat
  /** Part pose overrides set by `setPartPose` (object-local). */
  poses: Map<string, { pos: Vec3; q: Quat }>
}

interface Blast {
  point: Vec3
  energy: number
  radius: number
  lethalRadius?: number
  source?: string
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Millimetres of this material a round goes through: the entry of `Hit.penetration` for its `penetrationClass` (else its id) times the material's `penetrationScale`; undefined when the round has none. */
const penetrationOf = (mat: MaterialDef, table: Readonly<Record<string, number>> | undefined): number | undefined => {
  if (!table) return undefined
  const v = table[mat.penetrationClass ?? mat.id] ?? table[mat.id]
  return v === undefined ? undefined : v * (mat.penetrationScale ?? 1)
}
/** Share of its capacity a structural part still has: a bare rebar cage keeps the reinforcement's residual, a breached part loses what left it. */
const capacityScale = (p: PartRT): number => {
  if (p.st.stripped) return p.spec.reinforcement?.residualCapacity ?? RESIDUAL_CAPACITY
  return p.rt.removed ? Math.max(0.05, 1 - p.rt.removed / p.mass0) : 1
}
const isLost = (p: PartRT) => p.st.status === 'broken' || p.st.status === 'melted' || p.st.status === 'ashes'
const clone = <T>(v: T): T => structuredClone(v)
/**
 * Fraction of a structural part's hit points lost per second while its stress is above 1. A floor of 0.12 makes even a barely overloaded part
 * give way in about 8 s (a rate proportional to the excess alone never finishes: stress 1.02 would take two minutes), then it grows with the
 * excess and tops out at 0.6: stress 1.1 fails in ~4.5 s, 1.5 in ~1.9 s and anything above 1.7 in ~1.7 s. Deterministic: depends only on stress.
 */
const overloadRate = (stress: number) => Math.min(0.6, 0.12 + 0.8 * (stress - 1))
const updateBound = (o: ObjRT) => {
  if (!o.parts.length) return
  const c: Vec3 = [0, 0, 0]
  for (const p of o.parts) for (let k = 0; k < 3; k++) c[k] += p.pos[k] / o.parts.length
  let r = 0
  for (const p of o.parts) r = Math.max(r, vec.distance(c, p.pos) + p.bound)
  o.bc = c
  o.br = r
}
const AXIS = { x: 0, y: 1, z: 2 } as const

export const createDestruction = (options: DestructionOptions = {}): DestructionWorld => {
  const materials = new Map<MaterialId, MaterialDef>()
  for (const m of MATERIALS) materials.set(m.id, m)
  for (const m of options.materials ?? []) materials.set(m.id, m)
  const ambient = options.ambientC ?? 20
  const maxFragments = options.maxFragments ?? 24
  const maxDents = options.maxDents ?? 24
  const maxHoles = options.maxHoles ?? 32
  const fireSpread = options.fireSpread ?? 0.6
  const breachRadius = options.breach?.radius ?? BREACH_RADIUS
  const structureSafety = options.structure?.safetyFactor ?? 1
  const flexure = resolveFlexure(options.structure?.flexure)
  const masonry = resolveMasonry(options.structure?.masonry)
  const soilCfg = resolveSoil(options.soil)
  let windOpts: WindOptions | undefined = options.wind
  let windCfg: ResolvedWind | null = windOpts ? resolveWind(windOpts) : null
  const ignitionRules = resolveIgnitionRules(options.ignition)
  const breachBlastFactor = options.breach?.blastFactor ?? BREACH_BLAST_FACTOR
  const chipEnergy = options.breach?.chipEnergy ?? CHIP_ENERGY
  const rng = createRng(options.seed ?? 1)
  const rnd = () => rng.next()

  let time = 0
  let counter = 0
  const objects = new Map<string, ObjRT>()
  const listeners = new Map<string, Set<(e: DestructionEvent) => void>>()
  let cur: DestructionEvent[] = []
  const blasts: Blast[] = []
  /** Glass the blast front has not reached yet: the damage lands when it does (`blastFrontSpeed`). */
  const frontQueue: Array<{ o: ObjRT; p: PartRT; due: number; amount: number; fragEnergy: number; point: Vec3; src?: string }> = []
  const blastFrontSpeed = options.blastFrontSpeed ?? 0
  /** Explosive parts that were primed and wait for their delay. */
  const primed = new Map<PartRT, ObjRT>()
  let orderCounter = 0
  const impls = new Map<string, ImplRT>()
  const taken = (id: string) => objects.has(id) || impls.has(id)

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const emit = (e: DestructionEvent) => {
    cur.push(e)
    options.onEvent?.(e)
    const all = listeners.get('*')
    if (all) for (const fn of [...all]) fn(e)
    const typed = listeners.get(e.type)
    if (typed) for (const fn of [...typed]) fn(e)
  }
  const base = (o: ObjRT, source?: string): { object: string; time: number; source?: string } =>
    source === undefined ? { object: o.id, time } : { object: o.id, time, source }

  const pendingCollapse = new Map<ObjRT, string | undefined>()
  let runDepth = 0

  /** Blasts queued by parts that exploded; each can prime or set off more parts. It ends: a part goes off once and is primed once, so the queue only grows by parts not yet lost. */
  const drainBlasts = () => {
    for (let blast = blasts.shift(); blast; blast = blasts.shift()) blastWorld(blast.point, blast.energy, blast.radius, blast.source, undefined, undefined, blast.lethalRadius)
  }

  const run = <T>(fn: () => T): { value: T; events: DestructionEvent[] } => {
    const prev = cur
    const mine: DestructionEvent[] = []
    cur = mine
    runDepth++
    try {
      const value = fn()
      drainBlasts()
      if (runDepth === 1) flushCollapse()
      return { value, events: mine }
    } finally {
      runDepth--
      cur = prev
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Building objects
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const nextId = () => {
    let id: string
    do id = `obj_${++counter}`
    while (taken(id))
    return id
  }

  const freshRuntime = (): PartRuntime => ({ meltEmitted: 0, dripT: 0, prevTemp: ambient, shockT: 0, jet: false })

  const resolveSpec = (spec: DestructibleSpec): DestructibleSpec => {
    const out = clone(spec)
    const joints = out.joints ?? inferJoints(out.parts, 0.01, materials)
    const structural = (id: string) => {
      const role = out.parts.find((p) => p.id === id)?.structure?.role
      return role !== undefined && role !== 'none'
    }
    out.joints = joints.map((j) => {
      const def = JOINT_DEFAULTS[j.kind]
      return {
        id: j.id ?? `${j.a}~${j.b}`, a: j.a, b: j.b, kind: j.kind, strength: j.strength ?? def.strength, tools: j.tools ?? [...def.tools], seconds: j.seconds ?? def.seconds,
        bears: j.bears ?? (structural(j.a) && structural(j.b)),
      }
    })
    return out
  }

  const build = (spec: DestructibleSpec, id: string, pos: Vec3, rot: Quat, carry?: Carry): ObjRT => {
    const st: ObjectState = { id, position: [pos[0], pos[1], pos[2]], rotation: [rot[0], rot[1], rot[2], rot[3]], parts: [], joints: [], groups: [], destroyed: false }
    if (spec.name !== undefined) st.name = spec.name
    const o: ObjRT = {
      id, spec, st, parts: [], byId: new Map(), idx: new Map(), joints: [], jointMap: new Map(), byPart: new Map(), bc: [0, 0, 0], br: 0, active: false, tmp: [], hasStructure: false, dirty: false, maxStress: 0, collapsed: new Set(carry?.collapsed ?? []), unsup: [], anyAnchor: false, order: ++orderCounter,
      base: { pos: [pos[0], pos[1], pos[2]], rot: [rot[0], rot[1], rot[2], rot[3]] },
    }
    for (const ps of spec.parts) {
      if (o.byId.has(ps.id)) throw new Error(`duplicate part id "${ps.id}"`)
      const mat = materials.get(ps.material)
      if (!mat) throw new Error(`unknown material "${ps.material}" on part "${ps.id}"`)
      const mass0 = partMass(ps, mat)
      const maxHp = Math.max(1, ps.hp ?? mass0 * mat.hpPerKg)
      const fuel0 = mat.thermal.ignitionC !== undefined ? mass0 * (mat.thermal.fuelFraction ?? 0) : 0
      const c = carry?.parts.get(ps.id)
      const staged = !!(ps.layers?.length || ps.reinforcement || ps.units || ps.breach)
      const layers = (ps.layers ?? []).map((l, i) => {
        const lm = materials.get(l.material)
        if (!lm) throw new Error(`unknown material "${l.material}" on layer ${i} of part "${ps.id}"`)
        return resolveLayer(l, i, lm)
      })
      if (ps.reinforcement && !materials.has(ps.reinforcement.material)) throw new Error(`unknown material "${ps.reinforcement.material}" on the reinforcement of part "${ps.id}"`)
      const pst: PartState = c?.st ?? {
        id: ps.id, material: ps.material, status: 'intact', hp: maxHp, maxHp, mass: mass0, temperature: ambient, burning: false, fuel: fuel0, char: 0, melt: 0,
        dents: [], holes: [], cracks: [], group: 0, ...(staged ? { stage: 0 as DamageStage } : {}),
      }
      if (!c && ps.contains) pst.liters = ps.contains.liters
      const p: PartRT = {
        spec: ps, mat, st: pst, q: quatFromEuler(...(ps.rotation ?? [0, 0, 0])), pos: [ps.position[0], ps.position[1], ps.position[2]], mass0, fuel0, area: shapeArea(ps.shape), thickness: partThickness(ps), cutFactor: cutFactorOf(ps.shape),
        dims: shapeDims(ps.shape), bound: shapeBound(ps.shape), rt: c?.rt ?? { ...freshRuntime(), prevTemp: pst.temperature },
        structural: !!ps.structure && ps.structure.role !== 'none', anchored: !!ps.anchored || ps.structure?.role === 'foundation', cap: ps.structure ? partCapacity(ps, mat, { masonry, flexure }) : 0, orphan: false,
        staged, thin: thinAxisOf(shapeDims(ps.shape)), layers, span: 0, spanKey: '', restMoment: 0, bendLoad: 0, snap: false,
        ...(ps.shape.kind === 'box' && isFlexural(ps, mat, flexure) ? { bend: bendGeometry(ps) } : {}),
      }
      if (p.structural) o.hasStructure = true
      if (p.rt.chainDue !== undefined && !isLost(p)) primed.set(p, o)
      o.idx.set(ps.id, o.parts.length)
      o.parts.push(p)
      o.byId.set(ps.id, p)
      o.st.parts.push(pst)
      o.byPart.set(ps.id, [])
    }
    for (const js of spec.joints ?? []) {
      const r = js as Required<JointSpec>
      const ia = o.idx.get(r.a), ib = o.idx.get(r.b)
      if (ia === undefined || ib === undefined) throw new Error(`joint "${r.id}" references an unknown part`)
      if (o.jointMap.has(r.id)) throw new Error(`duplicate joint id "${r.id}"`)
      const pa = o.parts[ia], pb = o.parts[ib]
      const A = aabbOf(pa.spec.shape, pa.spec.position, pa.q)
      const B = aabbOf(pb.spec.shape, pb.spec.position, pb.q)
      const pos: Vec3 = [0, 0, 0]
      for (let k = 0; k < 3; k++) pos[k] = (Math.max(A.min[k], B.min[k]) + Math.min(A.max[k], B.max[k])) / 2
      const bears: JointRT['bears'] = r.bears ?? (pa.structural && pb.structural)
      const c = carry?.joints.get(r.id)
      const jst: JointState = c?.st ?? { id: r.id, a: r.a, b: r.b, kind: r.kind, hp: r.strength, maxHp: r.strength, progress: 0, open: false }
      const j: JointRT = { spec: r, st: jst, ia, ib, bears, pos, step: c?.step ?? 0 }
      o.joints.push(j)
      o.jointMap.set(r.id, j)
      o.byPart.get(r.a)!.push(j)
      o.byPart.get(r.b)!.push(j)
      o.st.joints.push(jst)
    }
    // open joints whose parts are no longer both here (left behind by `splitGroup`) stay listed, inert, so callers still see them open
    for (const [jid, c] of carry?.joints ?? []) if (c.st.open && !o.jointMap.has(jid)) o.st.joints.push(c.st)
    updateBound(o)
    o.anyAnchor = o.parts.some((p) => p.anchored)
    o.unsup = o.parts.map(() => false)
    if (windCfg && o.hasStructure && spec.wind !== false) o.wind = newWind(o, carry?.wind)
    const ground = spec.soil ?? soilCfg.site
    if (ground !== undefined && o.parts.some((p) => p.spec.structure?.role === 'foundation')) initSoil(o, profileOf(ground), carry?.soil, carry?.soilSets)
    o.seeding = true
    solveStructure(o)
    o.seeding = false
    if (o.soil && !carry?.soil) settleSoil(o, 0)
    if (o.soil) o.soil.dirty = false
    recomputeGroups(o)
    o.st.destroyed = o.parts.length > 0 && o.parts.every(isLost)
    o.active = o.maxStress > 0.8 || o.parts.some((p) => p.st.burning || p.st.temperature > ambient + 0.5 || (p.st.liters ?? 0) > 0)
    return o
  }

  const recomputeGroups = (o: ObjRT) => {
    const n = o.parts.length
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]]
        i = parent[i]
      }
      return i
    }
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b)
    }
    const live = (j: JointRT) => !j.st.open && !isLost(o.parts[j.ia]) && !isLost(o.parts[j.ib])
    if (o.unsup.some(Boolean)) {
      // parts that lost every support fall: cut them from the supported pieces; loose non-structural parts follow the part they hang on
      for (const j of o.joints) if (live(j) && !o.unsup[j.ia] && !o.unsup[j.ib]) union(j.ia, j.ib)
      const supported = new Set<number>()
      for (let i = 0; i < n; i++) if (!isLost(o.parts[i]) && !o.unsup[i] && (o.parts[i].structural || o.parts[i].anchored)) supported.add(find(i))
      for (const j of o.joints) {
        if (!live(j) || !(o.unsup[j.ia] || o.unsup[j.ib])) continue
        if (o.unsup[j.ia] && o.unsup[j.ib]) union(j.ia, j.ib)
        else {
          const u = o.unsup[j.ia] ? j.ia : j.ib
          const other = u === j.ia ? j.ib : j.ia
          if (!o.parts[other].structural && !supported.has(find(other))) union(u, other)
        }
      }
    } else for (const j of o.joints) if (live(j)) union(j.ia, j.ib)
    const comps = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      if (isLost(o.parts[i])) continue
      const r = find(i)
      const l = comps.get(r)
      if (l) l.push(i)
      else comps.set(r, [i])
    }
    const list = [...comps.values()].map((ix) => ({
      ix,
      anchored: ix.some((i) => o.parts[i].anchored),
      mass: ix.reduce((s, i) => s + o.parts[i].st.mass, 0),
    }))
    list.sort((a, b) => (a.anchored === b.anchored ? (b.mass - a.mass) || (a.ix[0] - b.ix[0]) : a.anchored ? -1 : 1))
    o.st.groups = list.map((g) => g.ix.map((i) => o.parts[i].spec.id))
    for (const p of o.parts) if (isLost(p)) p.st.group = -1
    list.forEach((g, gi) => g.ix.forEach((i) => (o.parts[i].st.group = gi)))
  }

  /**
   * Which part `r` rests on over joint `j` (index), or -1 when the joint does not let `r` rest on its other end. A `tie` is a rope: it only pulls,
   * so it holds `r` up only when `r` hangs below the part it is tied to (a lamp from a ceiling), never when that part is beside or under it
   * (a guy rope to a stake in the ground).
   */
  const restsOn = (o: ObjRT, j: JointRT, r: number): number => {
    const b = j.bears
    if (!b) return -1
    const k = b === true ? (j.ia === r ? j.ib : j.ia) : b === 'a_on_b' ? (j.ia === r ? j.ib : -1) : j.ib === r ? j.ia : -1
    if (k < 0 || j.spec.kind !== 'tie') return k
    return partXf(o, o.parts[k]).c[1] > partXf(o, o.parts[r]).c[1] + 1e-6 ? k : -1
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Bending (`structure.flexure`): span from the supports, moment at rest, blast impulse on the span
  // -------------------------------------------------------------------------------------------------------------------------------------------

  /** Where `p` touches `support`, as a box in `p`'s own axes. */
  const contactBox = (p: PartRT, support: PartRT): [Vec3, Vec3] => {
    const A = aabbOf(p.spec.shape, p.pos, p.q), B = aabbOf(support.spec.shape, support.pos, support.q)
    const lo: Vec3 = [0, 0, 0], hi: Vec3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) {
      const a = Math.max(A.min[k], B.min[k]) - SUPPORT_TOLERANCE, b = Math.min(A.max[k], B.max[k]) + SUPPORT_TOLERANCE
      lo[k] = Math.min(a, b)
      hi[k] = Math.max(a, b)
    }
    const out: [Vec3, Vec3] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]]
    for (let c = 0; c < 8; c++) {
      const l = toLocal(p.pos, p.q, [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]])
      for (let k = 0; k < 3; k++) {
        out[0][k] = Math.min(out[0][k], l[k])
        out[1][k] = Math.max(out[1][k], l[k])
      }
    }
    return out
  }

  /** The centre of where `above` touches `p`, in object space. */
  const contactCentre = (p: PartRT, above: PartRT): Vec3 => {
    const [lo, hi] = contactBox(p, above)
    return toWorld(p.pos, p.q, [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2])
  }

  /**
   * The support of `p` (index into the object's parts, among `lower`) that a load standing at `at` (object space) is over: within one depth of `p` of
   * where `p` rests on it, so the load goes straight down by a strut instead of bending `p` (a load that near a support is not carried in bending,
   * EN 1992-1-1 6.2.2(6)). -1 when it is over none.
   */
  const overSupportAt = (o: ObjRT, p: PartRT, at: Vec3, lower: readonly number[]): number => {
    const g = p.bend!
    const local = toLocal(p.pos, p.q, at)
    const depth = g.gravity >= 0 ? g.dims[g.gravity] : Math.min(...g.depthAxes.map((a) => g.dims[a]))
    let best = -1
    let bestGap = depth
    for (const k of lower) {
      const [a, b] = contactBox(p, o.parts[k])
      let gap = 0
      for (const ax of g.spanAxes) gap = Math.max(gap, a[ax] - local[ax], local[ax] - b[ax])
      if (gap <= bestGap) {
        best = k
        bestGap = gap - 1e-9
      }
    }
    return best
  }

  /** The section of `p` that bends along `axis`, with its tension steel and moments (a bare cage keeps only the steel's residual). */
  const sectionOf = (p: PartRT, axis: number) => {
    const g = p.bend!
    const section = { b: sectionWidth(g, axis), h: g.dims[axis] }
    const rebar = tensionSteel(p.spec, g.dims, section, flexure)
    return { section, rebar, ...sectionMoments(p.mat, section, rebar, flexure) }
  }

  /** Moment at rest over the moment the section holds, for the supports `lower` (indices) `p` rests on now. Sets `p.span` and `p.restMoment`. */
  const restFlexure = (o: ObjRT, p: PartRT, lower: readonly number[]): number => {
    const g = p.bend!
    const key = lower.join(',')
    if (key !== p.spanKey) {
      p.spanKey = key
      p.span = spanOf(g, lower.map((k) => contactBox(p, o.parts[k])))
    }
    p.restMoment = 0
    if (g.gravity < 0 || p.span <= 0) return 0
    const sec = sectionOf(p, g.gravity)
    p.restMoment = spanMoment(lineLoad(g, p.bendLoad) * Math.abs(g.up[g.gravity]), p.span)
    // once the tension face has cracked only the steel holds; a bare cage keeps its residual share
    const holds = (p.st.cracked ? sec.steel : sec.ultimate) * capacityScale(p)
    return (p.restMoment * structureSafety) / Math.max(holds, 1)
  }

  /**
   * A blast bends a beam or a slab: the reflected impulse over the span (`blastImpulse`, averaged over points of the face that takes it) gives the
   * span kinetic energy (`impulseEnergy`), which it takes as strain energy up to a peak moment (`momentOfEnergy`), added to or taken from the moment at
   * rest when the blast pushes along the weight. Past the cracking moment the tension face cracks; a section whose steel does not hold more than that
   * snaps; a reinforced one yields and fails when its plastic rotation (`(U(M) - U(Mu)) / (2 Mu)` per blast, added up) reaches `failRotationDeg`.
   */
  const bendByBlast = (o: ObjRT, p: PartRT, point: Vec3, energy: number, radius: number, reach: number, src?: string) => {
    const g = p.bend
    if (!g || p.span <= 0 || isLost(p) || p.st.stripped || reach <= 0) return
    const s = p.mat.strength!
    if (!s.elasticGPa) return
    const { c, q } = partXf(o, p)
    const near = surfacePoint(p.spec.shape, toLocal(c, q, point))
    const local = toLocal(c, q, point)
    const away = vec.normalize(vec.sub(near.point, local), vec.scale(near.normal, -1))
    let axis = g.depthAxes[0]!
    for (const a of g.depthAxes) if (Math.abs(away[a]) > Math.abs(away[axis])) axis = a
    const cos = Math.abs(away[axis])
    if (cos < 1e-3) return
    const tnt = energy / flexure.tntJoules
    const L = p.span
    const offsets = g.member ? [[-0.5], [-0.25], [0], [0.25], [0.5]] : [[0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]]
    const face = -Math.sign(away[axis]) * g.dims[axis] / 2
    let sum = 0
    for (const off of offsets) {
      const sp: Vec3 = [near.point[0], near.point[1], near.point[2]]
      g.spanAxes.forEach((a, k) => (sp[a] = Math.max(-g.dims[a] / 2, Math.min(g.dims[a] / 2, sp[a] + off[k]! * L))))
      sp[axis] = face
      const r = vec.distance(toWorld(c, q, sp), point)
      if (r < radius) sum += blastImpulse(tnt, r, flexure)
    }
    const width = sectionWidth(g, axis)
    const impulse = (sum / offsets.length) * cos * reach * width * L
    const weight = axis === g.gravity ? p.bendLoad : p.st.mass
    const kinetic = impulseEnergy(impulse, (lineLoad(g, weight) / GRAVITY) * L, flexure)
    const sec = sectionOf(p, axis)
    const EI = (s.elasticGPa * 1e9 * sec.section.b * sec.section.h ** 3) / 12
    const along = axis === g.gravity ? -Math.sign(away[axis] * g.up[axis]) : 0
    const dynamic = momentOfEnergy(kinetic, L, EI, flexure.loadFactor)
    const peak = Math.abs(dynamic + along * p.restMoment)
    if (peak <= sec.cracking) return
    if (!p.st.cracked) {
      p.st.cracked = true
      const tension: Vec3 = [near.point[0], near.point[1], near.point[2]]
      tension[axis] = dynamic + along * p.restMoment >= 0 ? -face : face
      const n: Vec3 = [0, 0, 0]
      n[axis] = Math.sign(tension[axis]) || 1
      addCrack(o, p, toWorld(c, q, tension), rotateVec(q, n), sec.section.b, src)
    }
    if (!sec.reinforced) {
      p.snap = true
      failPart(o, p, point, away, kinetic, 12, src, 'snap')
      return
    }
    // a lightly reinforced section (its steel holds less than the concrete did) now carries only what the steel gives
    solveStructure(o)
    if (peak <= sec.steel) return
    const rotation = (elasticEnergy(peak, L, EI, flexure.loadFactor) - elasticEnergy(sec.steel, L, EI, flexure.loadFactor)) / (2 * sec.steel)
    p.rt.hinge = (p.rt.hinge ?? 0) + rotation
    markDamaged(p)
    if (p.rt.hinge >= (flexure.failRotationDeg * Math.PI) / 180) hingeDrop(o, p, src)
  }

  /** Span a part is left with on `supports` along its longest axis: twice the farthest any point of it is from a support (a cantilever's is twice its overhang). */
  const freeSpan = (p: PartRT, supports: readonly PartRT[]): number => {
    if (supports.length === 0) return Infinity
    const d = p.dims
    const L = [0, 1, 2].sort((a, b) => d[b] - d[a])[0]
    const spans = supports.map((k) => contactBox(p, k)).map(([lo, hi]) => [lo[L], hi[L]] as const)
    let far = 0
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16 - 0.5) * d[L]
      let near = Infinity
      for (const [lo, hi] of spans) near = Math.min(near, Math.max(lo - x, x - hi, 0))
      far = Math.max(far, near)
    }
    return 2 * far
  }

  /** Distribute own mass plus carried load down the bearing graph to the anchored parts; mark parts without any support path. */
  const solveStructure = (o: ObjRT) => {
    o.maxStress = 0
    if (!o.hasStructure) return
    const parts = o.parts
    const n = parts.length
    const dist = new Array<number>(n).fill(-1)
    const ok = (i: number) => parts[i].structural && !isLost(parts[i])
    const isPartition = (i: number) => parts[i].spec.structure?.role === 'partition'
    // a part whose supports leave it a longer span than it holds (`structure.maxSpan`) is out, and so is what stood on it only through it
    const out = new Set<number>()
    let queue: number[] = []
    let lowerOf = new Map<number, number[]>()
    for (;;) {
      dist.fill(-1)
      queue = []
      for (let i = 0; i < n; i++) if (ok(i) && !out.has(i) && parts[i].anchored) {
        dist[i] = 0
        queue.push(i)
      }
      for (let h = 0; h < queue.length; h++) {
        const s = queue[h]
        if (isPartition(s)) continue
        for (const j of o.byPart.get(parts[s].spec.id)!) {
          if (j.st.open || !j.bears) continue
          const r = j.ia === s ? j.ib : j.ia
          if (dist[r] >= 0 || !ok(r) || out.has(r) || restsOn(o, j, r) !== s) continue
          dist[r] = dist[s] + 1
          queue.push(r)
        }
      }
      lowerOf = new Map<number, number[]>()
      let dropped = false
      for (const i of queue) {
        const lower: number[] = []
        for (const j of o.byPart.get(parts[i].spec.id)!) {
          if (j.st.open || !j.bears) continue
          const k = restsOn(o, j, i)
          if (k >= 0 && dist[k] >= 0 && dist[k] < dist[i] && !isPartition(k)) lower.push(k)
        }
        lowerOf.set(i, lower)
        const max = parts[i].spec.structure?.maxSpan
        if (max !== undefined && !parts[i].anchored && freeSpan(parts[i], lower.map((k) => parts[k])) > max) {
          out.add(i)
          dropped = true
        }
      }
      if (!dropped) break
    }
    const incoming = new Array<number>(n).fill(0)
    // the part of the load that bends a beam or a slab: what rests on it away from its supports. A load that stands over a support (a column
    // standing on a slab right over the beam below, a wall right over the wall below) goes straight down to that support with where it stands,
    // and bends that one only if it is away from its own supports
    const bending = new Array<number>(n).fill(0)
    const through: Array<Array<{ at: Vec3; mass: number; over: number }>> = parts.map(() => [])
    const pass = (k: number, at: Vec3, mass: number) => {
      const over = overSupportAt(o, parts[k], at, lowerOf.get(k) ?? [])
      if (over < 0) bending[k] += mass
      else through[k].push({ at, mass, over })
    }
    for (let h = queue.length - 1; h >= 0; h--) {
      const i = queue[h]
      const total = parts[i].st.mass + incoming[i]
      parts[i].st.load = total
      const lower = lowerOf.get(i)!
      for (const k of lower) incoming[k] += total / lower.length
      if (lower.length === 0) continue
      const bulk = parts[i].bend ? parts[i].st.mass + bending[i] : total
      for (const k of lower) if (parts[k].bend) pass(k, contactCentre(parts[k], parts[i]), bulk / lower.length)
      if (parts[i].bend) for (const item of through[i]) if (parts[item.over]?.bend) pass(item.over, item.at, item.mass)
    }
    for (let i = 0; i < n; i++) {
      const p = parts[i]
      o.unsup[i] = false
      if (!p.structural) continue
      if (dist[i] < 0 || isLost(p)) {
        p.st.load = p.st.mass
        p.st.stress = 0
        if (o.seeding && !p.anchored && !isLost(p) && p.st.status !== 'collapsed' && !o.collapsed.has(p.spec.id)) p.orphan = true
        o.unsup[i] = o.anyAnchor && !isLost(p) && !p.orphan
        continue
      }
      p.st.stress = (p.st.load! * structureSafety) / (p.cap * capacityScale(p))
      if (p.bend) {
        p.bendLoad = p.st.mass + bending[i]
        const bent = restFlexure(o, p, lowerOf.get(i) ?? [])
        p.st.flexure = bent
        p.snap = bent > 1 && !p.st.stripped && !sectionOf(p, p.bend.gravity).reinforced
        // a beam or slab carries its load in bending: the load the solver routes through it is not a compression it takes, unless a designer gave
        // it a capacity (`structure.capacity`, `sizeStructure`), which then holds as well
        if (p.spec.structure?.capacity === undefined || bent > p.st.stress) p.st.stress = bent
      }
      if (p.st.stress > o.maxStress) o.maxStress = p.st.stress
    }
    if (o.wind) applyWind(o)
    if (o.maxStress > 0.8) o.active = true
    if (o.soil) o.soil.dirty = true
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Wind (`DestructionOptions.wind`): lateral load that grows with height, the walls and frame that resist it, the sway of the top
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const newWind = (o: ObjRT, carried?: [number, number, number, number, number]): WindRT => {
    const cfg = exposureOf(windCfg!, o.spec.wind)
    const [x = 0, v = 0, y = 0, w = 0, peak = 0] = carried ?? []
    return {
      cfg, gust: { freq: [], amp: [], phase: [] }, gustKey: '', analysis: null, parts: [], sys: null, mu: 0, dyn: { x, v, y, w, peak }, tension: new Map(),
      emitted: { t: -Infinity, peak: 0, status: 'ok' },
    }
  }

  /** The wind direction in the object's own axes: the horizontal unit vector `[x, z]`. */
  const windDirection = (o: ObjRT, cfg: ResolvedWind): [number, number] => {
    const d = rotateVec(quat.conjugate(o.base.rot), cfg.direction)
    const h = Math.hypot(d[0], d[2])
    return h > 1e-9 ? [d[0] / h, d[2] / h] : [1, 0]
  }

  /** Axial force the wind adds to the walls and columns, the design drift and the first mode of the object as it stands now. */
  const applyWind = (o: ObjRT) => {
    const w = o.wind!
    const cfg = (w.cfg = exposureOf(windCfg!, o.spec.wind))
    const terrain = cfg.terrains.get(cfg.terrain)
    if (!terrain) throw new Error(`unknown wind terrain "${cfg.terrain}"`)
    const inputs: WindPartInput[] = []
    const at = new Map<number, number>()
    const keep: number[] = []
    let ground = Infinity, foundationTop = -Infinity
    o.parts.forEach((p, i) => {
      if (isLost(p) || isTerrain(p) || o.collapsed.has(p.spec.id) || o.unsup[i]) return
      const box = aabbOf(p.spec.shape, p.pos, p.q)
      const role = p.spec.structure?.role
      const e = p.mat.strength?.elasticGPa
      const kind: WindPartInput['kind'] = role === 'wall' ? 'wall' : role === 'column' ? 'column' : role === 'beam' ? 'beam' : role === 'foundation' ? 'foundation' : 'other'
      at.set(i, inputs.length)
      keep.push(i)
      ground = Math.min(ground, box.min[1])
      if (kind === 'foundation') foundationTop = Math.max(foundationTop, box.max[1])
      inputs.push({ min: box.min, max: box.max, kind, ...(e ? { elasticPa: e * 1e9 } : {}), mass: p.st.mass, ...(p.spec.damper ? { damper: true } : {}) })
    })
    keep.forEach((i, k) => {
      if (inputs[k].kind !== 'column') return
      const beams: number[] = []
      for (const j of o.byPart.get(o.parts[i].spec.id)!) {
        if (j.st.open) continue
        const b = at.get(j.ia === i ? j.ib : j.ia)
        if (b !== undefined && inputs[b].kind === 'beam') beams.push(b)
      }
      inputs[k].beams = beams
    })
    // a slab that rests on a beam works with it as a flange
    keep.forEach((i, k) => {
      if (inputs[k].kind !== 'beam') return
      for (const j of o.byPart.get(o.parts[i].spec.id)!) {
        if (j.st.open) continue
        const q = o.parts[j.ia === i ? j.ib : j.ia]
        const role = q.spec.structure?.role
        if ((role === 'slab' || role === 'roof') && !isLost(q) && q.spec.shape.kind === 'box') {
          inputs[k].slab = q.dims[1]
          break
        }
      }
    })
    const c: WindCase = {
      speed: cfg.speed, direction: windDirection(o, cfg), terrain, cls: cfg.class, topography: cfg.topography, statistical: cfg.statistical, drag: cfg.drag, damping: cfg.damping,
      airDensity: cfg.airDensity, minHeight: cfg.minHeight, bandHeight: cfg.bandHeight, stiffnessFactor: cfg.stiffnessFactor, beamFactor: cfg.beamFactor, loadFactor: cfg.loadFactor,
      chord: cfg.chord, meanRatio: cfg.meanRatio, gustFactor: cfg.gustFactor, flange: cfg.flange,
    }
    const a = inputs.length && cfg.speed > 0 ? analyzeWind(inputs, c, foundationTop > -Infinity ? foundationTop : ground) : null
    w.analysis = a
    w.parts = keep
    for (const p of o.parts) delete p.st.wind
    if (!a) {
      w.sys = null
      delete o.st.wind
      return
    }
    // the load on the walls and columns: compression adds to their load, tension takes from it (and pulls on the part when it passes the dead load)
    keep.forEach((i, k) => {
      const N = a.axial[k]
      const p = o.parts[i]
      if (!N || !p.structural || o.unsup[i]) return
      p.st.wind = N
      const dead = p.st.load ?? p.st.mass
      const force = N * cfg.loadFactor
      let stress = 0
      if (force >= 0) stress = (dead * structureSafety + force / GRAVITY) / (p.cap * capacityScale(p))
      else if (dead + force / GRAVITY < 0) {
        let cap = w.tension.get(i)
        if (cap === undefined) {
          const r = p.spec.reinforcement
          const ratio = p.spec.structure?.rebar?.ratio
          cap = tensionCapacity(p.dims, {
            ...(r ? { reinforcement: r } : {}), ...(ratio ? { ratio } : {}), yieldMPa: flexure.rebarYieldMPa,
            ...(p.mat.strength?.tensileMPa !== undefined ? { tensileMPa: p.mat.strength.tensileMPa } : {}),
          })
          w.tension.set(i, cap)
        }
        stress = Math.min(10, (-(dead + force / GRAVITY) * GRAVITY) / Math.max(cap * capacityScale(p), 1))
      }
      if (stress > (p.st.stress ?? 0)) p.st.stress = stress
      if ((p.st.stress ?? 0) > o.maxStress) o.maxStress = p.st.stress ?? 0
    })
    // the first mode, with the tuned mass damper if there is one
    const key = `${cfg.speed}|${cfg.terrain}|${cfg.topography}|${cfg.statistical}|${cfg.meanRatio}|${cfg.gust.components}|${cfg.gust.maxHz}|${cfg.gust.scale}|${cfg.gust.seed}`
    if (key !== w.gustKey) {
      w.gustKey = key
      const v10 = cfg.speed * cfg.topography * cfg.statistical * meanHeightFactor(10, terrain, a.cls, { meanRatio: cfg.meanRatio, minHeight: cfg.minHeight })
      w.gust = makeGust(v10, cfg.gust)
    }
    let md = 0, spec: PartSpec['damper'] | undefined
    for (const i of keep) {
      const p = o.parts[i]
      if (!p.spec.damper) continue
      const phi = shapeAt(a, p.pos[1] - (foundationTop > -Infinity ? foundationTop : ground))
      md += p.st.mass * phi * phi
      spec ??= p.spec.damper
    }
    const sys: SwaySystem = { M: a.modalMass, K: a.modalStiffness, C: 2 * cfg.damping * a.omega * a.modalMass }
    w.mu = 0
    if (md > 0 && a.modalMass > 0) {
      w.mu = md / a.modalMass
      const tuned = damperTuning(w.mu, cfg.tuning)
      const f = spec?.frequency ?? tuned.frequency * a.frequency
      const zeta = spec?.damping ?? tuned.damping
      sys.damper = { m: md, k: md * (2 * Math.PI * f) ** 2, c: 2 * zeta * md * 2 * Math.PI * f }
    }
    w.sys = a.modalMass > 0 && a.omega > 0 ? sys : null
    const st: WindState = {
      speed: cfg.speed, pressure: a.pressure, shear: a.shear, moment: a.moment, deflection: a.deflection, drift: a.drift, limit: cfg.driftLimit, overturn: Math.min(a.overturn, 1000),
      frequency: a.frequency, lean: a.lean, sway: w.dyn.x, peak: w.dyn.peak, status: a.overturn > 1 ? 'overturn' : a.drift > cfg.driftLimit ? 'drift' : 'ok',
    }
    if (sys.damper) st.damper = { ratio: w.mu, travel: w.dyn.y - w.dyn.x }
    o.st.wind = st
  }

  /** Moves the top of the building with the gust (the first mode and the damper, integrated together) and reports `sway` when it changes. */
  const stepWind = (o: ObjRT, dt: number) => {
    const w = o.wind!
    const a = w.analysis
    const st = o.st.wind
    if (!a || !st || !w.sys) return
    const gust = w.gust
    const I = a.intensity
    const force = (t: number) => {
      const n = gustAt(gust, t)
      return a.modalForce * (2 * I * n + I * I * (n * n - 1))
    }
    const wn = Math.max(a.omega, w.sys.damper ? Math.sqrt(w.sys.damper.k / w.sys.damper.m) : 0)
    stepSway(w.dyn, w.sys, time - dt, dt, force, (2 * Math.PI) / wn / 20)
    const d = w.dyn
    d.peak = Math.max(Math.abs(d.x), d.peak * Math.exp(-dt / w.cfg.peakDecay))
    st.sway = d.x
    st.peak = d.peak
    if (st.damper) st.damper.travel = d.y - d.x
    const e = w.emitted
    if (d.peak < e.peak * 0.8) e.peak = d.peak
    if (st.status !== e.status || (time - e.t >= 0.5 && d.peak > e.peak * 1.05 + 1e-3)) {
      w.emitted = { t: time, peak: d.peak, status: st.status }
      const dir = windDirection(o, w.cfg)
      const world = rotateVec(o.base.rot, [dir[0], 0, dir[1]])
      emit({ ...base(o), type: 'sway', sway: d.x, peak: d.peak, drift: st.drift, overturn: st.overturn, frequency: st.frequency, direction: world, status: st.status })
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Soil (`DestructibleSpec.soil`): footings and piles on the ground, settlement, tilt and tipping over
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const isTerrain = (p: PartRT) => !!p.spec.tags?.includes('terrain')
  const isFoundation = (p: PartRT) => p.spec.structure?.role === 'foundation' && !isLost(p)
  const slopeTilt = (a: number, b: number) => Math.atan(Math.hypot(a, b))

  /** The springs the object stands on: a grid of cells under each footing, one per pile, and a footing under each part that rests on the terrain. */
  const soilSprings = (o: ObjRT, profile: SoilProfile): { springs: Array<SoilSpring & { key: string }>; baseY: number } => {
    const found = o.parts.filter(isFoundation)
    const box = (p: PartRT) => aabbOf(p.spec.shape, p.pos, p.q)
    const surface = profile.surface ?? Math.max(...found.map((p) => box(p).max[1]))
    const prints: Array<{ x0: number; x1: number; z0: number; z1: number; bottom: number; part: PartRT }> = []
    for (const f of found) {
      const b = box(f)
      if (!isTerrain(f)) {
        prints.push({ x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2], bottom: b.min[1], part: f })
        continue
      }
      // the ground itself: each structural part that rests on it gets a footing at least `footingWidth` wide (a strip under a wall, a pad under a pillar)
      const fi = o.idx.get(f.spec.id)!
      const width = profile.footingWidth ?? soilCfg.footingWidth
      for (const j of o.byPart.get(f.spec.id)!) {
        if (j.st.open || !j.bears) continue
        const r = j.ia === fi ? j.ib : j.ia
        const q = o.parts[r]
        if (!q.structural || isLost(q) || restsOn(o, j, r) !== fi) continue
        const c = box(q)
        const x0 = Math.max(c.min[0], b.min[0]), x1 = Math.min(c.max[0], b.max[0]), z0 = Math.max(c.min[2], b.min[2]), z1 = Math.min(c.max[2], b.max[2])
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
        const wx = Math.max(width, x1 - x0), wz = Math.max(width, z1 - z0)
        prints.push({ x0: cx - wx / 2, x1: cx + wx / 2, z0: cz - wz / 2, z1: cz + wz / 2, bottom: c.min[1], part: q })
      }
    }
    const springs: Array<SoilSpring & { key: string }> = []
    for (const fp of prints) {
      const wx = Math.max(0.01, fp.x1 - fp.x0), wz = Math.max(0.01, fp.z1 - fp.z0)
      const depth = Math.max(0, surface - fp.bottom)
      const pile = fp.part.spec.structure?.role === 'foundation' ? fp.part.spec.structure.pile : undefined
      if (pile) {
        const count = Math.max(1, Math.round(pile.count ?? 1))
        const nx = Math.ceil(Math.sqrt(count)), nz = Math.ceil(count / nx)
        const cap = pileCapacity(profile, pile, depth, soilCfg.byId).ultimate
        const tip = soilAt(profile, depth + pile.length, soilCfg.byId)
        const k = pileStiffness(pile, fp.part.mat.strength?.elasticGPa ?? soilCfg.pileElasticGPa, tip.elasticMPa, tip.poisson)
        for (let i = 0; i < count; i++) {
          const col = i % nx, row = Math.floor(i / nx)
          springs.push({ key: `${fp.part.spec.id}#${i}`, x: fp.x0 + ((col + 0.5) * wx) / nx, z: fp.z0 + ((row + 0.5) * wz) / nz, hx: wx / (2 * nx), hz: wz / (2 * nz), k, cap })
        }
        continue
      }
      const B = Math.min(wx, wz)
      const g = footingSoil(profile, depth, B, soilCfg.byId, soilCfg.influence)
      const ks = subgradeModulus(g.elasticMPa, g.poisson, B, soilCfg.rigidity)
      const size = Math.max(wx, wz) / Math.max(1, soilCfg.cells)
      const nx = Math.max(1, Math.round(wx / size)), nz = Math.max(1, Math.round(wz / size))
      const area = (wx * wz) / (nx * nz)
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          springs.push({ key: `${fp.part.spec.id}#${i}.${k}`, x: fp.x0 + ((i + 0.5) * wx) / nx, z: fp.z0 + ((k + 0.5) * wz) / nz, hx: wx / (2 * nx), hz: wz / (2 * nz), k: ks * area, cap: soilCfg.safety * g.allowableKPa * 1000 * area })
        }
      }
    }
    return { springs, baseY: prints.length ? Math.min(...prints.map((fp) => fp.bottom)) : 0 }
  }

  /** Weight (N) and centre of mass of what stands on the ground: every part left that is not the terrain and has not fallen. */
  const soilWeight = (o: ObjRT): { w: number; c: Vec3 } => {
    let m = 0
    const c: Vec3 = [0, 0, 0]
    for (const p of o.parts) {
      if (isLost(p) || isTerrain(p) || o.collapsed.has(p.spec.id) || o.unsup[o.idx.get(p.spec.id)!]) continue
      m += p.st.mass
      for (let k = 0; k < 3; k++) c[k] += p.st.mass * p.pos[k]
    }
    return { w: m * GRAVITY, c: m > 0 ? [c[0] / m, c[1] / m, c[2] / m] : c }
  }

  const initSoil = (o: ObjRT, profile: SoilProfile, carried?: SoilState, carrySets?: Record<string, number>) => {
    const so: SoilRT = { profile, s: 0, a: 0, b: 0, imp: [0, 0], pivot: [0, 0, 0], dirty: true, sets: new Map(), emitted: { t: -Infinity, s: 0, tilt: 0, status: 'stable' } }
    const { springs, baseY } = soilSprings(o, profile)
    if (!springs.length) return
    const [x0, z0] = stiffnessCentre(springs)
    so.pivot = [x0, baseY, z0]
    // the out-of-plumb is taken the unfavourable way: about the axis the foundations are weakest in, toward the side the weight already leans to
    let ix = 0, iz = 0
    for (const sp of springs) {
      ix += sp.k * (sp.x - x0) ** 2
      iz += sp.k * (sp.z - z0) ** 2
    }
    const { c } = soilWeight(o)
    const along = ix <= iz ? 0 : 1
    const off = along === 0 ? c[0] - x0 : c[2] - z0
    const sign = Math.abs(off) > 1e-6 ? Math.sign(off) : 1
    so.imp = along === 0 ? [sign * soilCfg.imperfection, 0] : [0, sign * soilCfg.imperfection]
    if (carried) {
      const t = Math.tan((carried.tilt * Math.PI) / 180)
      so.s = carried.settlement
      so.a = t * carried.direction[0]
      so.b = t * carried.direction[2]
      so.emitted = { t: -Infinity, s: carried.settlement, tilt: carried.tilt, status: carried.status }
      o.st.soil = clone(carried)
      for (const [k, v] of Object.entries(carrySets ?? {})) so.sets.set(k, v)
      if (carried.status === 'toppled') for (const p of o.parts) p.anchored = false
    }
    o.soil = so
    applySoilPose(o)
  }

  /** The settled pose: tilted about the pivot by the slopes of the base, then down by the settlement; `st.position`/`rotation` follow. */
  const applySoilPose = (o: ObjRT) => {
    const so = o.soil
    if (!so) {
      o.st.position = [o.base.pos[0], o.base.pos[1], o.base.pos[2]]
      o.st.rotation = [o.base.rot[0], o.base.rot[1], o.base.rot[2], o.base.rot[3]]
      return
    }
    const angle = slopeTilt(so.a, so.b)
    // the side that goes down `a` per metre of x turns +x toward -y: a rotation about (b, 0, -a)
    const R = angle > 1e-12 ? quat.fromAxisAngle(vec.normalize([so.b, 0, -so.a]), angle) : quat.identity()
    const t = vec.sub(vec.sub(so.pivot, rotateVec(R, so.pivot)), [0, so.s, 0])
    o.st.rotation = quat.normalize(quat.mul(o.base.rot, R))
    o.st.position = vec.add(o.base.pos, rotateVec(o.base.rot, t))
    const lean = Math.hypot(so.a, so.b)
    const st: SoilState = o.st.soil ?? { settlement: 0, tilt: 0, direction: [0, 0, 0], bearing: 0, edge: 0, status: 'stable', offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] } }
    st.settlement = so.s
    st.tilt = (angle * 180) / Math.PI
    st.direction = lean > 1e-12 ? [so.a / lean, 0, so.b / lean] : [0, 0, 0]
    st.offset = { position: t, rotation: R }
    o.st.soil = st
  }

  /** The object tipped over: nothing holds it to the ground any more, everything falls. */
  const topple = (o: ObjRT, src?: string) => {
    for (const p of o.parts) p.anchored = false
    solveStructure(o)
    recomputeGroups(o)
    if (!pendingCollapse.has(o)) pendingCollapse.set(o, src)
  }

  /**
   * Solve the ground under the object and move it toward the equilibrium. `dt` 0 (the object is placed): it takes the equilibrium at once, as a
   * building that has stood there. In `update` an elastic change is taken at once and a yielding soil moves the object at `sinkRate`/`tiltRate`;
   * with no stable equilibrium it keeps sinking and leaning until its centre of mass passes the edge of its foundations and it tips over.
   */
  const settleSoil = (o: ObjRT, dt: number) => {
    const so = o.soil!
    const st = o.st.soil
    if (st?.status === 'toppled') return
    const { springs } = soilSprings(o, so.profile)
    for (const sp of springs) sp.set = so.sets.get(sp.key) ?? 0
    const { w, c } = soilWeight(o)
    if (!springs.length || w <= 0) {
      if (springs.length === 0 && w > 0) {
        so.s += soilCfg.sinkRate * dt
        applySoilPose(o)
        o.st.soil!.status = 'yielding'
      }
      return
    }
    const height = Math.max(0, c[1] - so.pivot[1])
    // the wind overturns the building as if its centre of mass stood `M / W` further downwind
    const wa = o.wind?.analysis
    const push = wa ? windDirection(o, o.wind!.cfg) : [0, 0]
    const shift = wa ? wa.moment / w : 0
    const r = solveFoundation(springs, w, c[0] + shift * push[0], c[2] + shift * push[1], height, so.imp, { s: so.s, a: so.a, b: so.b })
    let status: SoilState['status'] = 'stable'
    const sinkStep = soilCfg.sinkRate * dt
    const tiltStep = Math.tan((soilCfg.tiltRate * Math.PI) / 180) * dt
    if (r.stable && (!r.yielded || dt === 0)) {
      so.s = r.s
      so.a = r.a
      so.b = r.b
    } else if (r.stable) {
      const ds = r.s - so.s, da = r.a - so.a, db = r.b - so.b
      const fs = Math.abs(ds) > sinkStep ? sinkStep / Math.abs(ds) : 1
      const lean = Math.hypot(da, db)
      const ft = lean > tiltStep ? tiltStep / lean : 1
      so.s += ds * fs
      so.a += da * ft
      so.b += db * ft
      if (fs < 1 || ft < 1) status = 'yielding'
    } else {
      status = 'yielding'
      if (dt === 0) {
        // placed where the ground cannot hold it: it starts from the elastic settlement and moves from there in `update`
        so.s = w / springs.reduce((sum, sp) => sum + sp.k, 0)
      } else {
        so.s += sinkStep * (r.bearing >= 1 ? 1 : 0.25)
        const lean = Math.hypot(so.a, so.b)
        const ux = lean > 1e-9 ? so.a / lean : Math.sign(so.imp[0]), uz = lean > 1e-9 ? so.b / lean : Math.sign(so.imp[1])
        so.a += ux * tiltStep
        so.b += uz * tiltStep
      }
    }
    if (so.s !== 0 || so.a !== 0 || so.b !== 0) {
      const sets = yieldSprings(springs, so.s, so.a, so.b)
      springs.forEach((sp, i) => {
        if (sets[i] > 0) so.sets.set(sp.key, sets[i])
      })
    }
    applySoilPose(o)
    const out = o.st.soil!
    out.bearing = r.bearing
    out.edge = r.edge
    out.status = status
    // tipped over: the centre of mass, moved over by the lean, passed the edge of the foundations in the direction it leans
    const lean = Math.hypot(so.a, so.b)
    if (lean > 1e-9) {
      const [x0, z0] = [so.pivot[0], so.pivot[2]]
      const ux = so.a / lean, uz = so.b / lean
      const e = (c[0] - x0 + height * (so.a + so.imp[0])) * ux + (c[2] - z0 + height * (so.b + so.imp[1])) * uz
      let edge = 0
      for (const sp of springs) edge = Math.max(edge, (sp.x - x0) * ux + (sp.z - z0) * uz + sp.hx * Math.abs(ux) + sp.hz * Math.abs(uz))
      if (e > edge || slopeTilt(so.a, so.b) > Math.PI / 3) out.status = 'toppled'
    }
  }

  const stepSoil = (o: ObjRT, dt: number) => {
    const so = o.soil!
    if (o.st.soil?.status === 'toppled') return
    if (!so.dirty && o.st.soil?.status !== 'yielding') return
    so.dirty = false
    settleSoil(o, dt)
    const st = o.st.soil!
    const e = so.emitted
    const changed = st.status !== e.status || ((time - e.t >= 0.5 || e.t === -Infinity) && (Math.abs(st.tilt - e.tilt) > 0.01 || Math.abs(st.settlement - e.s) > 0.002))
    if (changed) {
      so.emitted = { t: time, s: st.settlement, tilt: st.tilt, status: st.status }
      emit({ ...base(o), type: 'settle', settlement: st.settlement, tilt: st.tilt, direction: rotateVec(o.base.rot, st.direction), bearing: st.bearing, status: st.status })
    }
    if (st.status === 'toppled') topple(o)
  }

  /**
   * Ask for a collapse report. It is not computed right away: a blow can break several parts in one go (a column and the roof's supports, or a
   * column whose joint opens just before the column itself fractures), so the groups are examined once, after every loss of the operation.
   */
  const collapseCheck = (o: ObjRT, src?: string) => {
    if (!o.hasStructure || !o.parts.some((p) => p.anchored)) return
    if (!pendingCollapse.has(o)) pendingCollapse.set(o, src)
  }

  /** Report the groups of remaining structural parts that lost every anchor (each part is reported once). */
  const flushCollapse = () => {
    for (const [o, src] of [...pendingCollapse]) {
      pendingCollapse.delete(o)
      if (!objects.has(o.id) || objects.get(o.id) !== o) continue
      for (const g of o.st.groups) {
        const ps = g.map((id) => o.byId.get(id)!).filter((p) => !isLost(p) && !o.collapsed.has(p.spec.id))
        if (ps.length === 0 || g.some((id) => o.byId.get(id)!.anchored) || !ps.some((p) => p.structural)) continue
        for (const p of ps) {
          o.collapsed.add(p.spec.id)
          p.st.status = 'collapsed'
          setStage(o, p, 3, {}, src)
        }
        emit({ ...base(o, src), type: 'collapse', parts: ps.map((p) => p.spec.id), mass: ps.reduce((sum, p) => sum + p.st.mass, 0) })
      }
    }
  }

  const getObj = (id: string): ObjRT => {
    const o = objects.get(id)
    if (!o) throw new Error(`unknown object "${id}"`)
    return o
  }
  const getPart = (o: ObjRT, id: string): PartRT => {
    const p = o.byId.get(id)
    if (!p) throw new Error(`unknown part "${id}" in object "${o.id}"`)
    return p
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Geometry in world space
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const partXf = (o: ObjRT, p: PartRT): { c: Vec3; q: Quat } => ({ c: toWorld(o.st.position, o.st.rotation, p.pos), q: quat.mul(o.st.rotation, p.q) })
  const objLocal = (o: ObjRT, w: Vec3) => toLocal(o.st.position, o.st.rotation, w)
  const objLocalDir = (o: ObjRT, w: Vec3) => rotateVec(quat.conjugate(o.st.rotation), w)
  const jointWorld = (o: ObjRT, j: JointRT) => toWorld(o.st.position, o.st.rotation, j.pos)
  const distToPart = (o: ObjRT, p: PartRT, w: Vec3) => {
    const { c, q } = partXf(o, p)
    return distanceToShape(p.spec.shape, toLocal(c, q, w))
  }
  const partWorldAabb = (o: ObjRT, p: PartRT) => {
    const { c, q } = partXf(o, p)
    return aabbOf(p.spec.shape, c, q)
  }

  interface PartRay { t0: number; t1: number; n: Vec3 }
  const rayPartRaw = (pos: Vec3, rot: Quat, spec: PartSpec, pq: Quat, origin: Vec3, d: Vec3, lp: Vec3 = spec.position): PartRay | null => {
    const c = toWorld(pos, rot, lp)
    const q = quat.mul(rot, pq)
    const qi = quat.conjugate(q)
    const r = rayShape(spec.shape, rotateVec(qi, vec.sub(origin, c)), rotateVec(qi, d))
    return r ? { t0: r.t0, t1: r.t1, n: rotateVec(q, r.n0) } : null
  }
  const rayPart = (o: ObjRT, p: PartRT, origin: Vec3, d: Vec3): PartRay | null => rayPartRaw(o.st.position, o.st.rotation, p.spec, p.q, origin, d, p.pos)

  const raySphereMiss = (origin: Vec3, d: Vec3, c: Vec3, r: number, maxDist: number): boolean => {
    const oc = vec.sub(origin, c)
    const b = vec.dot(oc, d)
    const cc = vec.dot(oc, oc) - r * r
    if (cc > 0 && b > 0) return true
    const disc = b * b - cc
    if (disc < 0) return true
    return -b - Math.sqrt(disc) > maxDist
  }

  const raycastInternal = (origin: Vec3, dir: Vec3, maxDist: number, ignore?: Set<string>, worldOnly = false): (RayHit & { pathLen: number }) | null => {
    const d = vec.normalize(dir)
    let best: (RayHit & { pathLen: number }) | null = null
    for (const o of objects.values()) {
      if (raySphereMiss(origin, d, toWorld(o.st.position, o.st.rotation, o.bc), o.br, best ? Math.min(maxDist, best.distance) : maxDist)) continue
      for (const p of o.parts) {
        if (isLost(p) || ignore?.has(`${o.id}\0${p.spec.id}`)) continue
        const r = rayPart(o, p, origin, d)
        if (!r || r.t0 < 0 || r.t0 > maxDist) continue
        if (p.st.opening && insideOpening(o, p, vec.madd(origin, d, r.t0))) continue
        if (p.st.chipped && insideChip(p, objLocal(o, vec.madd(origin, d, r.t0)))) continue
        if (!best || r.t0 < best.distance) best = { object: o.id, part: p.spec.id, point: vec.madd(origin, d, r.t0), normal: r.n, distance: r.t0, pathLen: r.t1 - r.t0 }
      }
    }
    for (const im of worldOnly ? [] : impls.values()) {
      for (const ps of im.impl.describe().parts) {
        if (ignore?.has(`${im.impl.id}\0${ps.id}`)) continue
        const ov = im.poses.get(ps.id)
        const r = rayPartRaw(im.position, im.rotation, ps, ov?.q ?? quatFromEuler(...(ps.rotation ?? [0, 0, 0])), origin, d, ov?.pos)
        if (!r || r.t0 < 0 || r.t0 > maxDist) continue
        if (!best || r.t0 < best.distance) best = { object: im.impl.id, part: ps.id, point: vec.madd(origin, d, r.t0), normal: r.n, distance: r.t0, pathLen: r.t1 - r.t0 }
      }
    }
    return best
  }

  // impl hosting
  const implHit = (im: ImplRT, hit: Hit): HitResult => {
    let h = hit
    if (hit.space === 'local') {
      h = { ...hit, space: 'world', point: toWorld(im.position, im.rotation, hit.point) }
      if (hit.direction) h.direction = rotateVec(im.rotation, hit.direction)
    }
    const start = cur.length
    for (const e of im.impl.hit(h) ?? []) emit(e.time === undefined ? { ...e, time } : e)
    const mine = cur.slice(start)
    const res: HitResult = { object: im.impl.id, damage: 0, penetrated: false, exitEnergy: 0, events: mine, point: hit.point }
    for (const e of mine) {
      if (e.type === 'damage') res.damage += e.amount
      if (e.type === 'hole' && e.hole.through) res.penetrated = true
      if (res.part === undefined && 'part' in e) res.part = (e as { part: string }).part
    }
    return res
  }

  const implJointPos = (im: ImplRT, a: string, b: string): Vec3 | null => {
    const parts = im.impl.describe().parts
    const pa = parts.find((p) => p.id === a), pb = parts.find((p) => p.id === b)
    if (!pa || !pb) return null
    const A = aabbOf(pa.shape, pa.position, quatFromEuler(...(pa.rotation ?? [0, 0, 0])))
    const B = aabbOf(pb.shape, pb.position, quatFromEuler(...(pb.rotation ?? [0, 0, 0])))
    const pos: Vec3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) pos[k] = (Math.max(A.min[k], B.min[k]) + Math.min(A.max[k], B.max[k])) / 2
    return toWorld(im.position, im.rotation, pos)
  }

  /** Find the part a hit lands on: a short ray along `dir`, else the nearest part within `tol`. */
  const locate = (o: ObjRT, point: Vec3, dir: Vec3 | undefined, tol: number, only?: PartRT): Loc | null => {
    const cands = only ? [only] : o.parts
    if (dir && vec.length(dir) > 1e-9) {
      const d = vec.normalize(dir)
      const origin = vec.madd(point, d, -0.05)
      let best: Loc | null = null
      let bestT = Infinity
      let inside: Loc | null = null
      for (const p of cands) {
        if (isLost(p)) continue
        const r = rayPart(o, p, origin, d)
        if (!r) continue
        if (r.t0 >= 0 && r.t0 <= 0.15) {
          if (r.t0 < bestT) {
            bestT = r.t0
            best = { p, point: vec.madd(origin, d, r.t0), normal: r.n, dir: d, pathLen: Math.max(r.t1 - r.t0, 1e-4) }
          }
        } else if (r.t0 < 0 && r.t1 > 0 && !inside) {
          inside = { p, point, normal: vec.scale(d, -1), dir: d, pathLen: Math.max(r.t1 - 0.05, p.thickness) }
        }
      }
      if (best) return best
      if (inside) return inside
    }
    let np: PartRT | null = null
    let nd = Infinity
    for (const p of cands) {
      if (isLost(p)) continue
      const dd = distToPart(o, p, point)
      if (dd < nd) {
        nd = dd
        np = p
      }
    }
    if (!np || nd > tol) return null
    const { c, q } = partXf(o, np)
    const sp = surfacePoint(np.spec.shape, toLocal(c, q, point))
    const normal = rotateVec(q, sp.normal)
    return { p: np, point: toWorld(c, q, sp.point), normal, dir: dir && vec.length(dir) > 1e-9 ? vec.normalize(dir) : vec.scale(normal, -1), pathLen: np.thickness }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Marks on parts
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const markDamaged = (p: PartRT) => {
    if (p.st.status === 'intact') p.st.status = 'damaged'
  }

  const addDent = (o: ObjRT, p: PartRT, wp: Vec3, wn: Vec3, radius: number, depth: number, src?: string) => {
    const dent: Dent = { point: objLocal(o, wp), normal: objLocalDir(o, wn), radius, depth }
    const arr = p.st.dents
    let ni = -1, nd = Infinity
    for (let i = 0; i < arr.length; i++) {
      const dd = vec.distance(arr[i].point, dent.point)
      if (dd < nd) {
        nd = dd
        ni = i
      }
    }
    if (ni >= 0 && (arr.length >= maxDents || nd < arr[ni].radius * 0.6)) {
      arr[ni].depth = Math.min(0.1, Math.max(arr[ni].depth, depth) + depth * 0.3)
      arr[ni].radius = Math.max(arr[ni].radius, radius)
    } else arr.push(dent)
    markDamaged(p)
    emit({ ...base(o, src), type: 'dent', part: p.spec.id, dent, worldPoint: wp })
  }

  const addHole = (o: ObjRT, p: PartRT, wp: Vec3, wn: Vec3, diameter: number, through: boolean, exit?: Vec3, src?: string) => {
    const hole: Hole = { point: objLocal(o, wp), normal: objLocalDir(o, wn), diameter, through }
    p.st.holes.push(hole)
    if (p.st.holes.length > maxHoles) p.st.holes.shift()
    markDamaged(p)
    emit({ ...base(o, src), type: 'hole', part: p.spec.id, hole, worldPoint: wp, ...(exit ? { exitPoint: exit } : {}) })
    setStage(o, p, 1, {}, src)
    return hole
  }

  const addCrack = (o: ObjRT, p: PartRT, wp: Vec3, wn: Vec3, length: number, src?: string) => {
    const crack: Crack = { point: objLocal(o, wp), normal: objLocalDir(o, wn), length: Math.min(length, Math.max(p.bound, 0.05)), rays: 5 + Math.floor(rnd() * 5) }
    p.st.cracks.push(crack)
    if (p.st.cracks.length > 16) p.st.cracks.shift()
    markDamaged(p)
    emit({ ...base(o, src), type: 'crack', part: p.spec.id, crack, worldPoint: wp })
    setStage(o, p, 1, {}, src)
  }

  const debris = (o: ObjRT, p: PartRT, kind: DebrisKind, point: Vec3, normal: Vec3, count: number, speed: number, src?: string) =>
    emit({ ...base(o, src), type: 'debris', part: p.spec.id, kind, point, normal, count, speed })

  const holeRate = (hole: Hole, pressurized: boolean) => (pressurized ? 0.5 : 0.1) * (hole.diameter / 0.009)

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Failure, joints
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const detachEvents = (o: ObjRT, opened: JointRT[], by: 'break' | 'tool' | 'part_lost', src?: string) => {
    for (const j of opened) emit({ ...base(o, src), type: 'detach', joint: j.spec.id, parts: [j.spec.a, j.spec.b], by, groups: o.st.groups.map((g) => [...g]) })
  }

  const checkDestroyed = (o: ObjRT, src?: string) => {
    if (!o.st.destroyed && o.parts.length > 0 && o.parts.every(isLost)) {
      o.st.destroyed = true
      emit({ ...base(o, src), type: 'destroyed' })
    }
  }

  const partLost = (o: ObjRT, p: PartRT, src?: string) => {
    const opened: JointRT[] = []
    for (const j of o.byPart.get(p.spec.id) ?? []) {
      if (j.st.open) continue
      j.st.open = true
      j.st.openedBy = 'part_lost'
      opened.push(j)
    }
    solveStructure(o)
    recomputeGroups(o)
    detachEvents(o, opened, 'part_lost', src)
    collapseCheck(o, src)
    checkDestroyed(o, src)
  }

  /**
   * Distance from a world point to the joint's contact region: the overlap box of the two parts' bounds (or, when they only nearly touch, the box
   * of the gap between them). Measuring to the joint centre would make a thick part untouchable: a blow on a trunk's surface is half the trunk's
   * width away from a joint that sits on its axis.
   */
  const jointReach = (o: ObjRT, j: JointRT, point: Vec3): number => {
    const A = partWorldAabb(o, o.parts[j.ia]), B = partWorldAabb(o, o.parts[j.ib])
    let d2 = 0
    for (let k = 0; k < 3; k++) {
      const lo = Math.min(Math.max(A.min[k], B.min[k]), Math.min(A.max[k], B.max[k]))
      const hi = Math.max(Math.max(A.min[k], B.min[k]), Math.min(A.max[k], B.max[k]))
      const d = point[k] < lo ? lo - point[k] : point[k] > hi ? point[k] - hi : 0
      d2 += d * d
    }
    return Math.sqrt(d2)
  }
  /** How far from the contact region a blow still counts: half the smallest dimension of the smaller part, at least 6 cm. */
  const jointReachLimit = (o: ObjRT, j: JointRT): number => {
    const pa = o.parts[j.ia], pb = o.parts[j.ib]
    const small = pa.dims[0] * pa.dims[1] * pa.dims[2] <= pb.dims[0] * pb.dims[1] * pb.dims[2] ? pa : pb
    return Math.max(0.06, 0.5 * Math.min(small.dims[0], small.dims[1], small.dims[2]))
  }

  const wearJoints = (o: ObjRT, p: PartRT, amount: number, near?: Vec3, radius = 0.06, src?: string, split = false) => {
    if (amount <= 0) return
    const mine = (o.byPart.get(p.spec.id) ?? []).filter((j) => !j.st.open)
    if (split && mine.length) amount /= mine.length
    for (const j of mine) {
      if (j.st.open) continue
      // the rebar of a reinforced part (a cage, or the tension steel of `structure.rebar`) ties it to the next one: blows do not wear it, only a torch
      // or a saw cuts it (or the part itself giving way)
      if (j.spec.kind === 'rebar' && (isReinforced(o.parts[j.ia].spec) || isReinforced(o.parts[j.ib].spec))) continue
      if (near && jointReach(o, j, near) > Math.max(radius, jointReachLimit(o, j))) continue
      j.st.hp -= amount
      if (j.st.hp <= 0) {
        j.st.hp = 0
        j.st.open = true
        j.st.openedBy = 'break'
        solveStructure(o)
        recomputeGroups(o)
        detachEvents(o, [j], 'break', src)
        collapseCheck(o, src)
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Damage stages: spall, breach, reinforcement cage
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const setStage = (o: ObjRT, p: PartRT, stage: DamageStage, extra: { opening?: { center: Vec3; radius: number }; fragments?: Fragment[] } = {}, src?: string) => {
    if (!p.staged || (p.st.stage ?? 0) >= stage) return
    p.st.stage = stage
    emit({ ...base(o, src), type: 'stage', part: p.spec.id, stage, ...extra })
  }

  /** `1` when the outward normal points along the part's local +thin axis, else `-1`. */
  const faceOf = (o: ObjRT, p: PartRT, worldNormal: Vec3): number => (rotateVec(quat.conjugate(partXf(o, p).q), worldNormal)[p.thin] >= 0 ? 1 : -1)

  const spallOuter = (o: ObjRT, p: PartRT, wp: Vec3, face: number, normal: Vec3, radius: number, src?: string) => {
    if (p.layers.length === 0) return
    const lp = objLocal(o, wp)
    const layer = outerLayer(p.layers, p.rt.spalls, face, lp)
    if (!layer) return
    const spalls = (p.rt.spalls ??= [])
    spalls.push([layer.index, face, lp[0], lp[1], lp[2], radius])
    if (spalls.length > MAX_SPALLS) spalls.shift()
    markDamaged(p)
    emit({ ...base(o, src), type: 'spall', part: p.spec.id, layer: layer.index, point: wp, area: Math.PI * radius * radius })
    debris(o, p, layer.mat.hitDebris, wp, normal, 5, 2, src)
    setStage(o, p, 1, {}, src)
  }

  const insideOpening = (o: ObjRT, p: PartRT, objectPoint: Vec3): boolean => {
    const op = p.st.opening
    if (!op) return false
    const [u, v] = planeAxes(p.thin)
    const lp = toLocal(p.pos, p.q, objectPoint)
    const lc = toLocal(p.pos, p.q, op.center)
    return Math.hypot(lp[u] - lc[u], lp[v] - lc[v]) <= op.radius
  }

  /** Square metres of wall a blow removes: the volume its damage takes out, over the thickness it crosses. */
  const breachAreaOf = (p: PartRT, damage: number, blast: boolean): number =>
    (damage / (p.mat.hpPerKg * p.mat.density) / Math.max(p.thickness, 0.005)) * (blast ? breachBlastFactor : 1)

  const localHolesOf = (p: PartRT): LocalHole[] =>
    p.st.holes.map((h) => ({ point: toLocal(p.pos, p.q, h.point), normal: rotateVec(quat.conjugate(p.q), h.normal), diameter: h.diameter }))

  const unitsOf = (p: PartRT) => p.spec.units ?? { size: [p.mat.fragmentSize?.[1] ?? 0.2, p.mat.fragmentSize?.[1] ?? 0.2, p.thickness] as Vec3, bond: 'stack' as const }

  const FRAGMENT_SHAPE = { shatter: 'shard', splinter: 'splinter', tear: 'scrap' } as const

  /** Unit-sized fragments of `cells` (part-local), thrown from `hitW`; the holes that fell on a unit stay on it as `marks`. */
  const cellFragments = (o: ObjRT, p: PartRT, cells: readonly UnitCell[], hitW: Vec3, dir: Vec3 | null, speed: number, mass: number, tag: string): Fragment[] => {
    const { c, q } = partXf(o, p)
    const holes = p.st.holes.length > 0 ? localHolesOf(p) : []
    const [u, v] = planeAxes(p.thin)
    const faceArea = (cell: UnitCell) => cell.size[u] * cell.size[v]
    const total = cells.reduce((sum, cell) => sum + faceArea(cell), 0) || 1
    const shape = p.spec.units ? 'chunk' : FRAGMENT_SHAPE[p.mat.fracture as keyof typeof FRAGMENT_SHAPE] ?? 'chunk'
    return cells.map((cell, i) => {
      const cw = toWorld(c, q, cell.center)
      const out = vec.normalize(vec.sub(cw, hitW), [0, 1, 0])
      const dv = dir ? vec.normalize(vec.madd(out, dir, 0.6)) : out
      const k = speed * (0.6 + 0.8 * rnd())
      const marks = marksInBox(cell.center, cell.size, undefined, holes)
      return {
        id: `${p.spec.id}#${tag}${i}`, part: p.spec.id, material: p.spec.material, shape, center: cw, size: [cell.size[0], cell.size[1], cell.size[2]], rotation: q,
        velocity: [dv[0] * k, dv[1] * k + 0.5 * rnd(), dv[2] * k], angularVelocity: [(rnd() - 0.5) * 8, (rnd() - 0.5) * 8, (rnd() - 0.5) * 8],
        mass: (mass * faceArea(cell)) / total, ...(marks.length > 0 ? { marks } : {}),
      }
    })
  }

  const worldBars = (o: ObjRT, p: PartRT, bars: ReadonlyArray<readonly [Vec3, Vec3]>): Array<[Vec3, Vec3]> => {
    const { c, q } = partXf(o, p)
    return bars.map(([a, b]) => [toWorld(c, q, a), toWorld(c, q, b)])
  }

  /** A blow that made through damage of `area` m² at `wp` (world): adds up with the earlier ones within the breach radius, and opens the part past its threshold. */
  const addBreach = (o: ObjRT, p: PartRT, wp: Vec3, area: number, energy: number, dir: Vec3 | null, src?: string) => {
    if (!p.staged || area <= 0 || (p.st.stage ?? 0) >= 2 || p.st.stripped || isLost(p)) return
    const lp = objLocal(o, wp)
    const list = (p.rt.breach ??= [])
    list.push([lp[0], lp[1], lp[2], area])
    if (list.length > MAX_SPALLS) list.shift()
    let total = 0
    const sum: Vec3 = [0, 0, 0]
    for (const [x, y, z, a] of list) {
      if (vec.distance([x, y, z], lp) > breachRadius) continue
      total += a
      sum[0] += x * a
      sum[1] += y * a
      sum[2] += z * a
    }
    if (total < (p.spec.breach?.area ?? BREACH_AREA)) return
    openBreach(o, p, [sum[0] / total, sum[1] / total, sum[2] / total], total, energy, dir, src)
  }

  /** The unit grid of a part with `units`, at the cap a breach uses (the same cells every time, so a unit keeps its index). Not saved: it is rebuilt from the spec. */
  const unitGrids = new WeakMap<PartRT, UnitCell[]>()
  const gridOf = (p: PartRT): UnitCell[] => {
    let grid = unitGrids.get(p)
    if (!grid) unitGrids.set(p, (grid = unitGrid(p.dims, p.thin, unitsOf(p), BREACH_GRID_CAP)))
    return grid
  }

  /** The object-local point falls in a unit that was knocked out of the part (`PartState.chipped`). */
  const insideChip = (p: PartRT, objectPoint: Vec3): boolean => {
    const cells = p.st.chipped
    if (!cells?.length) return false
    const [u, v] = planeAxes(p.thin)
    const lp = toLocal(p.pos, p.q, objectPoint)
    return cells.some((c) => Math.abs(lp[u] - c.center[u]) <= c.size[u] / 2 && Math.abs(lp[v] - c.center[v]) <= c.size[v] / 2)
  }

  /**
   * A shot or a blow on a wall of units (`PartSpec.units`) wears the unit it lands on, and a little the ones around it within `radius`: a unit that took
   * `chipEnergy` joules per kilogram of its mass comes out (a `chip` event with the fragment, `PartState.chipped`), and what goes through it passes. The
   * face area that came out adds up like through damage (`addBreach`), so enough units knocked out close together open the part. A reinforced part
   * keeps its units (the cage holds them: it crumbles in a breach).
   */
  const chipUnits = (o: ObjRT, p: PartRT, wp: Vec3, energy: number, dir: Vec3 | null, radius: number, src?: string) => {
    if (!p.spec.units || p.spec.reinforcement || !p.staged || chipEnergy <= 0 || energy <= 0 || p.st.stripped || isLost(p) || (p.st.stage ?? 0) >= 2) return
    const [u, v] = planeAxes(p.thin)
    const lp = toLocal(p.pos, p.q, objLocal(o, wp))
    const grid = gridOf(p)
    const worn = (p.rt.chips ??= {})
    const out: UnitCell[] = []
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i]!
      if (worn[i] === -1) continue
      const gap = Math.hypot(Math.max(0, Math.abs(lp[u] - cell.center[u]) - cell.size[u] / 2), Math.max(0, Math.abs(lp[v] - cell.center[v]) - cell.size[v] / 2))
      if (gap > radius) continue
      const share = gap === 0 ? 1 : CHIP_SPLASH * (1 - gap / radius)
      const total = (worn[i] ?? 0) + energy * share
      const mass = p.mat.density * cell.size[0] * cell.size[1] * cell.size[2]
      if (total < chipEnergy * mass) {
        worn[i] = total
        continue
      }
      worn[i] = -1
      out.push(cell)
    }
    if (out.length === 0) return
    const { c, q } = partXf(o, p)
    const chipped = (p.st.chipped ??= [])
    const holes = localHolesOf(p)
    for (const cell of out) {
      const mass = Math.min(p.st.mass, p.mat.density * cell.size[0] * cell.size[1] * cell.size[2])
      const center = toWorld(c, q, cell.center)
      const speed = clamp(Math.sqrt((2 * energy * 0.05) / Math.max(mass, 0.05)), 0.5, 6)
      const fragments = cellFragments(o, p, [cell], wp, dir, speed, mass, `c${chipped.length}_`)
      p.st.holes = p.st.holes.filter((_, k) => marksInBox(cell.center, cell.size, undefined, [holes[k]!]).length === 0)
      chipped.push({ center: [cell.center[0], cell.center[1], cell.center[2]], size: [cell.size[0], cell.size[1], cell.size[2]] })
      p.st.mass = Math.max(0, p.st.mass - mass)
      p.rt.removed = (p.rt.removed ?? 0) + mass
      markDamaged(p)
      setStage(o, p, 1, {}, src)
      emit({ ...base(o, src), type: 'chip', part: p.spec.id, center, size: [cell.size[0], cell.size[1], cell.size[2]], rotation: q, fragments })
      debris(o, p, p.mat.breakDebris, center, vec.scale(dir ?? [0, 1, 0], -1), 6, 2, src)
    }
    for (const cell of out) addBreach(o, p, toWorld(c, q, cell.center), cell.size[u] * cell.size[v], energy, dir, src)
  }

  /**
   * Stage 2: the units around `center` (object-local) come out as fragments the size of one unit, the part keeps an opening and its mass drops. An
   * opening as wide as the part cuts it in two (a column, a lintel): that is a fracture instead.
   */
  const openBreach = (o: ObjRT, p: PartRT, center: Vec3, total: number, energy: number, dir: Vec3 | null, src?: string) => {
    const [u, v] = planeAxes(p.thin)
    const radius = clamp(Math.sqrt(total / Math.PI), Math.sqrt((p.spec.breach?.area ?? BREACH_AREA) / Math.PI), breachRadius)
    const lc = toLocal(p.pos, p.q, center)
    lc[p.thin] = 0
    const { c, q } = partXf(o, p)
    const worldCenter = toWorld(c, q, lc)
    if (2 * radius >= Math.min(p.dims[u], p.dims[v])) {
      failPart(o, p, worldCenter, dir, energy, 12, src)
      return
    }
    const worn = p.rt.chips
    const cells = cellsWithin(gridOf(p).filter((_, i) => worn?.[i] !== -1), p.thin, lc, radius)
    const removed = (p.st.mass * cells.reduce((sum, cell) => sum + cell.size[u] * cell.size[v], 0)) / (p.dims[u] * p.dims[v])
    const speed = clamp(Math.sqrt((2 * energy * 0.1) / Math.max(removed, 0.05)), 0.5, 8)
    const fragments = cellFragments(o, p, cells, worldCenter, dir, speed, removed, 'b')
    const holes = localHolesOf(p)
    p.st.holes = p.st.holes.filter((_, i) => !cells.some((cell) => marksInBox(cell.center, cell.size, undefined, [holes[i]!]).length > 0))
    p.st.mass = Math.max(0, p.st.mass - removed)
    p.rt.removed = (p.rt.removed ?? 0) + removed
    p.st.opening = { center: objLocal(o, worldCenter), radius }
    markDamaged(p)
    setStage(o, p, 1, {}, src)
    setStage(o, p, 2, { opening: { center: worldCenter, radius }, fragments }, src)
    debris(o, p, p.mat.breakDebris, worldCenter, vec.scale(dir ?? [0, 1, 0], -1), 14, 3, src)
    const reinforcement = p.spec.reinforcement
    if (reinforcement) {
      const bars = worldBars(o, p, clipBarsToDisc(rebarBars(p.dims, p.thin, reinforcement.spacing), u, v, [lc[u], lc[v]], radius + 0.05))
      if (bars.length > 0) emit({ ...base(o, src), type: 'expose', part: p.spec.id, bars })
    }
    if (p.structural) solveStructure(o)
  }

  /** The concrete of a reinforced part is gone: the part stays as its rebar cage, with the capacity the reinforcement leaves it. */
  const stripPart = (o: ObjRT, p: PartRT, reinforcement: NonNullable<PartSpec['reinforcement']>, src?: string) => {
    const bars = rebarBars(p.dims, p.thin, reinforcement.spacing)
    p.st.stripped = true
    p.st.hp = p.st.maxHp
    p.st.mass = rebarMass(bars, reinforcement.diameter, materials.get(reinforcement.material)?.density)
    p.st.holes = []
    p.st.burning = false
    p.rt.jet = false
    markDamaged(p)
    emit({ ...base(o, src), type: 'expose', part: p.spec.id, bars: worldBars(o, p, bars) })
    solveStructure(o)
    collapseCheck(o, src)
  }

  /** The units of the part that are still there (the opening of a breach is already gone), as a fragment plan. */
  const unitFragmentPlan = (p: PartRT, cap: number): PlannedFragment[] => {
    const grid = unitGrid(p.dims, p.thin, unitsOf(p), cap)
    const op = p.st.opening
    const cells = op ? cellsOutside(grid, p.thin, toLocal(p.pos, p.q, op.center), op.radius) : grid
    const [u, v] = planeAxes(p.thin)
    return cells.map((cell) => ({ center: cell.center, size: cell.size, q: quat.identity(), shape: 'chunk' as const, weight: cell.size[u] * cell.size[v] }))
  }

  /** The bare cage gives way (overload, a blast, a cut that finishes): the part is lost for good. */
  const loseCage = (o: ObjRT, p: PartRT, src?: string) => {
    p.st.status = 'broken'
    p.st.hp = 0
    p.st.mass = 0
    emit({ ...base(o, src), type: 'expose', part: p.spec.id, bars: [] })
    debris(o, p, 'sparks', partXf(o, p).c, [0, 1, 0], 6, 3, src)
    partLost(o, p, src)
  }

  /**
   * A reinforced beam or slab that fails in bending folds at the hinge and comes down in one piece, held together by its bars: the joints it rests on
   * open, it keeps what rests on it, and it falls (a `collapse` follows) instead of turning to rubble.
   */
  const hingeDrop = (o: ObjRT, p: PartRT, src?: string) => {
    const i = o.idx.get(p.spec.id)!
    const opened: JointRT[] = []
    for (const j of o.byPart.get(p.spec.id) ?? []) {
      if (j.st.open || restsOn(o, j, i) < 0) continue
      j.st.open = true
      j.st.hp = 0
      j.st.openedBy = 'break'
      opened.push(j)
    }
    p.st.hp = Math.max(1, p.st.maxHp * 0.1)
    p.st.cracked = true
    markDamaged(p)
    debris(o, p, p.mat.breakDebris, partXf(o, p).c, [0, -1, 0], 12, 2, src)
    solveStructure(o)
    recomputeGroups(o)
    detachEvents(o, opened, 'break', src)
    collapseCheck(o, src)
  }

  /** Part hit points reached 0 (or it was forced to explode): fragments, debris, joints open. */
  const failPart = (o: ObjRT, p: PartRT, origin: Vec3 | null, dir: Vec3 | null, fragEnergy: number, cap: number, src?: string, force?: FractureStyle) => {
    if (isLost(p)) return
    if (p.st.stripped) {
      loseCage(o, p, src)
      return
    }
    if (!force && p.bend && (p.st.flexure ?? 0) > 1 && sectionOf(p, p.bend.gravity).reinforced) {
      hingeDrop(o, p, src)
      return
    }
    const ex = p.spec.explodes
    const style = force ?? (p.snap ? 'snap' : p.mat.fracture === 'none' ? 'snap' : p.mat.fracture)
    const { c, q } = partXf(o, p)
    const hitW = origin ?? c
    const grain = p.spec.grain ? AXIS[p.spec.grain] : undefined
    const hitLocal = toLocal(c, q, hitW)
    const unitPlan = p.spec.units ? unitFragmentPlan(p, maxFragments * UNIT_FRAGMENT_FACTOR) : []
    const axis = style === 'splinter' || style === 'snap' ? severAxis(p) : -1
    const cutAt = axis < 0 ? undefined : p.rt.cutAt ?? (origin ? hitLocal[axis] : undefined)
    const plan = unitPlan.length > 0 ? unitPlan : planFragments({
      style, dims: p.dims, thickness: p.thickness, grain, hit: hitLocal, fragmentSize: p.mat.fragmentSize ?? [0.04, 0.2], maxFragments, rnd, sheet: p.mat.sheet,
      ...(cutAt !== undefined ? { cut: { at: cutAt, gap: SEVER_BAND } } : {}),
    })
    const holes = p.st.holes.length > 0 ? localHolesOf(p) : []
    const mass = p.st.mass
    const totW = plan.reduce((s, f) => s + f.weight, 0) || 1
    const energy = ex ? ex.energy * 0.2 : fragEnergy
    const speed = clamp(Math.sqrt((2 * energy) / Math.max(mass, 0.05)), 0.3, ex ? 40 : cap)
    const fragments: Fragment[] = plan.map((f, i) => {
      const cw = toWorld(c, q, f.center)
      const out = vec.normalize(vec.sub(cw, hitW), [0, 1, 0])
      const dv = dir ? vec.normalize(vec.madd(out, dir, 0.6)) : out
      const k = speed * (0.6 + 0.8 * rnd())
      const marks = marksInBox(f.center, f.size, f.q, holes)
      return {
        id: `${p.spec.id}#${i}`, part: p.spec.id, material: p.spec.material, shape: f.shape, center: cw, size: f.size, rotation: quat.mul(q, f.q),
        velocity: [dv[0] * k, dv[1] * k + 0.5 * rnd(), dv[2] * k],
        angularVelocity: [(rnd() - 0.5) * 12, (rnd() - 0.5) * 12, (rnd() - 0.5) * 12],
        mass: (mass * f.weight) / totW, ...(marks.length > 0 ? { marks } : {}), ...(f.inner ? { inner: true } : {}),
      }
    })
    const reinforcement = p.spec.reinforcement
    if (!reinforcement) {
      p.st.status = 'broken'
      p.st.hp = 0
      p.st.mass = 0
      p.st.burning = false
      p.rt.jet = false
    }
    emit({ ...base(o, src), type: 'fracture', part: p.spec.id, style, fragments, point: hitW })
    debris(o, p, p.mat.breakDebris, c, [0, 1, 0], clamp(Math.round(Math.cbrt(partVolume(p.spec.shape)) * 30), 3, 20), 2, src)
    setStage(o, p, 3, {}, src)
    if (reinforcement) {
      stripPart(o, p, reinforcement, src)
      return
    }
    if (ex) {
      emit({ ...base(o, src), type: 'explode', part: p.spec.id, point: c, energy: ex.energy, radius: ex.radius, ...(ex.lethalRadius !== undefined ? { lethalRadius: ex.lethalRadius } : {}), ...(ex.effect !== undefined ? { effect: ex.effect } : {}) })
      blasts.push({ point: c, energy: ex.energy, radius: ex.radius, ...(ex.lethalRadius !== undefined ? { lethalRadius: ex.lethalRadius } : {}), source: src })
    }
    partLost(o, p, src)
  }

  /**
   * Sets an explosive part off from outside (`explodes.chain`): it will explode after the delay of `trigger`, once. The delay is one draw
   * from the world seed, so the same inputs give the same order of blasts.
   */
  const prime = (o: ObjRT, p: PartRT, trigger: ChainTrigger, src?: string) => {
    const spec = chainDelayOf(p.spec, trigger)
    if (spec === undefined || isLost(p) || p.rt.chainDue !== undefined) return
    const delay = drawChainDelay(spec, rnd)
    p.rt.chainDue = time + delay
    primed.set(p, o)
    o.active = true
    emit({ ...base(o, src), type: 'primed', part: p.spec.id, point: partXf(o, p).c, trigger, delay })
  }

  const CHAIN_TRIGGER_OF: Partial<Record<DamageType, ChainTrigger>> = { ballistic: 'shot', explosive: 'explosion' }

  /** Remove hit points. Returns the amount actually removed. */
  /**
   * A long wooden part (a board, a batten, a beam: `splinter`, box, at least `SEVER_ASPECT` times longer than it is wide) breaks where it is hit: its
   * length is cut in bands `SEVER_BAND` long, each with its share of the hit points, and the band whose share runs out breaks it across there. A thin
   * board has little in each band and goes in a few shots; a beam or a log carries its whole section in each band and takes many.
   */
  const severAxis = (p: PartRT): number => {
    // boards and beams break where they are hit: wood along the grain, a snapping board (MDF, plastic) across
    if ((p.mat.fracture !== 'splinter' && p.mat.fracture !== 'snap') || p.spec.shape.kind !== 'box') return -1
    const d = p.dims
    const order = [0, 1, 2].sort((a, b) => d[b] - d[a])
    return d[order[0]] >= SEVER_ASPECT * d[order[1]] && d[order[0]] >= 3 * SEVER_BAND ? order[0] : -1
  }
  const bandOf = (o: ObjRT, p: PartRT, axis: number, origin: Vec3): number => {
    const { c, q } = partXf(o, p)
    const along = toLocal(c, q, origin)[axis]
    const L = p.dims[axis]
    return clamp(Math.floor((along + L / 2) / SEVER_BAND), 0, Math.ceil(L / SEVER_BAND) - 1)
  }

  const applyDamage = (o: ObjRT, p: PartRT, amount: number, type: DamageType, origin: Vec3 | null, dir: Vec3 | null, fragEnergy: number, cap: number, src?: string): number => {
    if (isLost(p) || amount <= 0) return 0
    const prev = p.st.hp
    p.st.hp -= amount
    const axis = origin && type !== 'fire' && type !== 'heat' ? severAxis(p) : -1
    if (axis >= 0 && p.st.hp > 0) {
      const band = bandOf(o, p, axis, origin!)
      const cuts = (p.rt.cuts ??= {})
      cuts[band] = (cuts[band] ?? 0) + amount * (type === 'ballistic' ? SEVER_BALLISTIC : 1)
      if (cuts[band] >= (p.st.maxHp * SEVER_BAND) / p.dims[axis]) {
        p.rt.cutAt = -p.dims[axis] / 2 + (band + 0.5) * SEVER_BAND
        p.st.hp = 0
      }
    }
    markDamaged(p)
    const trigger = CHAIN_TRIGGER_OF[type]
    const chained = trigger !== undefined && chainDelayOf(p.spec, trigger) !== undefined
    // a bullet or a blast sets a chained part off after its delay instead of tearing it apart on the spot
    if (chained && p.st.hp <= 0 && p.rt.chainDue === undefined) p.st.hp = Math.min(prev, 1)
    if (p.st.hp <= 0 && p.mat.fracture === 'none' && !p.spec.explodes) p.st.hp = Math.min(prev, 1)
    const done = prev - p.st.hp
    if (done > 0) emit({ ...base(o, src), type: 'damage', part: p.spec.id, amount: done, hp: Math.max(0, p.st.hp), damageType: type })
    if (p.st.hp <= 0) failPart(o, p, origin, dir, fragEnergy, cap, src)
    else if (chained && (trigger === 'explosion' || 1 - p.st.hp / p.st.maxHp >= shotDamageFractionOf(p.spec))) prime(o, p, trigger, src)
    return done
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Hits
  // -------------------------------------------------------------------------------------------------------------------------------------------

  /** A container of flammable fluid with a hole that goes through: it leaks. */
  const leaksFlammable = (p: PartRT): boolean => {
    const c = p.spec.contains
    return !!c && FLAMMABLE_FLUIDS.includes(c.fluid) && (p.st.liters ?? 0) > 0 && p.st.holes.some((h) => h.through)
  }

  /**
   * A round that went through the wall of a container of flammable fluid lights the leak or does not: the spark of a hard round on metal and the
   * flame of an incendiary or tracer (`Hit.ignition`, `Hit.incendiary`, `Hit.tracer`), weighed by how full the container is (`options.ignition`).
   * A plain bullet carries neither and only leaks. The part burns or goes off at the next `update` (`rt.lit`).
   */
  const rollIgnition = (o: ObjRT, p: PartRT, round: BallisticExtras) => {
    const c = p.spec.contains
    if (!c || !FLAMMABLE_FLUIDS.includes(c.fluid) || p.rt.jet || p.rt.lit) return
    const fill = c.liters > 0 ? (p.st.liters ?? 0) / c.liters : 0
    const chance = ignitionChance(round, { sparkTarget: sparkTargetFactor(p.mat.id, !!p.mat.tags?.includes('metal'), ignitionRules), fill, fluid: c.fluid }, ignitionRules)
    if (chance > 0 && rnd() < chance) {
      p.rt.lit = true
      o.active = true
    }
  }

  /** What is lit by a fire or a blast near: the leaks of flammable fluid within `radius` of `centre` (object parts only). */
  const lightLeaksNear = (centre: Vec3, radius: number) => {
    for (const o of objects.values()) {
      for (const q of o.parts) {
        if (isLost(q) || q.rt.lit || q.rt.jet || !leaksFlammable(q)) continue
        if (vec.distance(partXf(o, q).c, centre) - q.bound > radius) continue
        q.rt.lit = true
        o.active = true
      }
    }
  }

  /** What a blow of `kind` tears out of the material (`MaterialDef.hits`): a round into wood tears splinters by default. */
  const tearOf = (mat: MaterialDef, kind: DamageType): { tear: 'splinters' | 'lumps' | 'none'; joules: number } => {
    const h = mat.hits?.[kind]
    const tear = h?.tear ?? (kind === 'ballistic' && mat.penetrationClass === 'wood' ? 'splinters' : 'none')
    return { tear, joules: h?.tearJoules ?? TEAR_JOULES }
  }

  /**
   * Pieces torn out where a blow lands, as the material answers that kind of blow (`MaterialDef.hits`): splinters of fresh wood, lumps of MDF.
   * A round (`exit` when it went through) throws most out of the exit along the shot and one in three back out of the entry, two out of the entry
   * when it stayed; a blow knocks them out of the face it hits, one per `tearJoules`, none below. `scale` is the calibre or the contact size (m).
   * Reported as a `chip` where they came off. The part stays: its hit points take the blow apart.
   */
  const tearAt = (o: ObjRT, p: PartRT, kind: DamageType, entry: Vec3, exit: Vec3 | undefined, d: Vec3, E: number, scale: number, src?: string) => {
    const { tear, joules } = tearOf(p.mat, kind)
    if (tear === 'none') return
    const shot = kind === 'ballistic'
    const n = shot ? (exit ? clamp(Math.round(E / joules), 1, 7) : 1) : clamp(Math.floor(E / joules), 0, 5)
    if (n === 0) return
    const fibre = tear === 'lumps'
    const { q } = partXf(o, p)
    const along = (p.spec.grain ? AXIS[p.spec.grain] : undefined) ?? [0, 1, 2].sort((a, b) => p.dims[b] - p.dims[a])[0]
    const fragments: Fragment[] = []
    for (let i = 0; i < n; i++) {
      // out of the entry (back towards the shooter or the fist), or out of the exit along the shot
      const back = !exit || i % 3 === 2
      const len = scale * (fibre ? 1.2 + 1.2 * rnd() : 3 + 4 * rnd()), w = scale * (0.8 + 0.8 * rnd()), t = scale * (fibre ? 0.7 + 0.6 * rnd() : 0.4 + 0.4 * rnd())
      const size: Vec3 = [w, w, w]
      size[along] = len
      size[(along + 1) % 3] = w
      size[(along + 2) % 3] = t
      const spread: Vec3 = [(rnd() - 0.5) * 0.8, (rnd() - 0.2) * 0.8, (rnd() - 0.5) * 0.8]
      const speed = shot ? (back ? 1.5 + 2 * rnd() : 2 + 4 * rnd()) : 0.8 + 1.2 * rnd()
      const v = vec.scale(vec.normalize(vec.add(back ? vec.scale(d, -1) : d, spread)), speed)
      const mass = size[0] * size[1] * size[2] * p.mat.density
      fragments.push({
        id: `${p.spec.id}#t${tears++}-${i}`, part: p.spec.id, material: p.spec.material, shape: fibre ? 'chunk' : 'splinter',
        center: back || !exit ? vec.madd(entry, d, -0.01) : vec.madd(exit, d, 0.01), size, rotation: q, velocity: v, inner: true,
        angularVelocity: [(rnd() - 0.5) * 30, (rnd() - 0.5) * 30, (rnd() - 0.5) * 30], mass,
      })
    }
    const patch: Vec3 = [scale * 4, scale * 4, scale * 4]
    emit({ ...base(o, src), type: 'chip', part: p.spec.id, center: exit ?? entry, size: patch, rotation: q, fragments })
  }

  interface BallisticOut { penetrated: boolean; exitEnergy: number; exitPoint?: Vec3; damage: number }

  const ballistic = (o: ObjRT, p: PartRT, entry: Vec3, n: Vec3, d: Vec3, E: number, caliber: number, pathLen: number, src?: string, round: BallisticExtras = {}): BallisticOut => {
    const mat = p.mat
    const piercing = round.piercing ?? 1
    // a bare cage and an opening do not stop a bullet
    if (p.st.stripped || (p.st.opening && insideOpening(o, p, objLocal(o, entry))) || insideChip(p, objLocal(o, entry))) {
      return { penetrated: true, exitEnergy: E, exitPoint: vec.madd(entry, d, Math.min(pathLen, p.thickness)), damage: 0 }
    }
    const sin = Math.min(1, Math.abs(vec.dot(d, n)))
    const angle = (Math.asin(sin) * 180) / Math.PI
    const slant = Math.max(sin, 0.3)
    const effM = p.thickness / slant
    const face = p.layers.length > 0 ? faceOf(o, p, n) : 1
    const exitLocal = objLocal(o, vec.madd(entry, d, Math.min(pathLen, effM)))
    const coats = p.layers.length > 0 ? layersEnergy(p.layers, p.rt.spalls, face, objLocal(o, entry)) + layersEnergy(p.layers, p.rt.spalls, -face, exitLocal) : 0
    // each coat adds penetration x thickness to the core's; a part without layers keeps the plain formula
    const thr = coats > 0 ? (mat.penetration * p.thickness * 1000 + coats) / slant : mat.penetration * effM * 1000
    // the bullet's kind matters against hard targets (steel, masonry); wood, flesh and the like take every bullet for its energy
    const hard = mat.tags?.includes('metal') || mat.tags?.includes('masonry')
    // a round that carries its penetration (mm by material class) goes through a part as thick as that, whatever the energy says; else the energy rule with `piercing`
    const penMm = penetrationOf(mat, round.penetration)
    const Ep = penMm !== undefined ? penMm * mat.penetration : piercing === 1 || !hard ? E : E * piercing
    const penetrated = Ep > thr
    // a thin brittle shell that shatters (a pane, a bottle) is lost to one bullet that a thick block of the same glass shrugs off: the same
    // fragility factor that melee uses for blunt hits (1 for ductile materials and for shells 2 cm or thicker, up to x118 for 3 mm glass)
    const scale = (mat.damageScale?.ballistic ?? 1) * (mat.fracture === 'shatter' ? fragility(mat.ductility, p.thickness) : 1)
    const id = p.spec.id
    if (!penetrated && mat.ricochetDeg && angle < mat.ricochetDeg) {
      const r = vec.sub(d, vec.scale(n, 2 * vec.dot(d, n)))
      emit({ ...base(o, src), type: 'ricochet', part: id, point: entry, direction: vec.normalize(r), energy: E * 0.4 })
      debris(o, p, mat.hitDebris, entry, n, 3, 3, src)
      const dmg = applyDamage(o, p, E * DMG_PER_J * scale * 0.2, 'ballistic', entry, d, E * 0.1, 12, src)
      return { penetrated: false, exitEnergy: 0, damage: dmg }
    }
    if (p.layers.length > 0) spallOuter(o, p, entry, face, n, Math.max(0.03, (caliber / 1000) * 4), src)
    const brittle = mat.ductility < 0.3
    const ratio = Ep / Math.max(thr, 1e-6)
    const crackLen = clamp(0.03 + ratio * 0.2, 0.03, 0.8)
    let exitPoint: Vec3 | undefined
    if (penetrated) {
      const exitDist = (p.spec.contains || (p.spec.fill !== undefined && p.spec.fill < 0.5) || p.thickness < pathLen * 0.5)
        ? pathLen
        : Math.min(pathLen, effM + layersThickness(p.layers, face) / slant + layersThickness(p.layers, -face) / slant)
      exitPoint = vec.madd(entry, d, exitDist)
      const hole = addHole(o, p, entry, n, (caliber / 1000) * (mat.ductility >= 0.3 ? 1 : 1.5), true, exitPoint, src)
      if (p.layers.length > 0) spallOuter(o, p, exitPoint, -face, vec.scale(n, -1), Math.max(0.03, (caliber / 1000) * 4), src)
      addBreach(o, p, entry, Math.PI * (hole.diameter / 2) * (hole.diameter / 2), E, d, src)
      // a thin ductile sheet is dished around the hole it is punched through: deeper the more energy the shot carries
      if (mat.ductility >= 0.5 && p.thickness <= THIN_SHEET_DISHING) addDent(o, p, entry, n, Math.max((caliber * 3) / 1000, 0.012), clamp(E * 0.00002, 0.001, 0.03), src)
      if (brittle && mat.fracture === 'shatter') addCrack(o, p, entry, n, crackLen, src)
      if (p.spec.contains && (p.st.liters ?? 0) > 1e-4) {
        emit({
          ...base(o, src), type: 'leak', part: id, fluid: p.spec.contains.fluid, point: entry,
          direction: p.spec.contains.outflow ? vec.normalize(rotateVec(o.st.rotation, rotateVec(p.q, p.spec.contains.outflow))) : n, rate: holeRate(hole, !!p.spec.contains.pressurized),
          pressurized: !!p.spec.contains.pressurized,
        })
        rollIgnition(o, p, round)
      }
    } else if (mat.ductility >= 0.5) {
      addDent(o, p, entry, n, Math.max((caliber * 3) / 1000, 0.012), clamp(Math.min(Math.max(p.thickness * 3, 0.003), ratio * 0.01), 0.001, 0.05), src)
    } else if (brittle) {
      addCrack(o, p, entry, n, crackLen, src)
      if (mat.fracture !== 'shatter') addHole(o, p, entry, n, caliber / 1000, false, undefined, src)
    } else addHole(o, p, entry, n, caliber / 1000, false, undefined, src)
    debris(o, p, mat.hitDebris, entry, n, clamp(Math.round(E / 60) + 2, 2, 14), clamp(Math.sqrt(E) / 6, 1, 8), src)
    // a bullet only wears the joints of the part it hits, by the energy the part absorbed (a through-and-through shot transfers little)
    wearJoints(o, p, (penetrated ? thr : E) * 0.02, undefined, 0, src, true)
    const dmg = applyDamage(o, p, E * DMG_PER_J * scale, 'ballistic', entry, d, E * 0.1, 12, src)
    if (!isLost(p)) tearAt(o, p, 'ballistic', entry, penetrated ? exitPoint : undefined, d, E, caliber / 1000, src)
    // a wall of units: the unit hit takes what the bullet left in it (all of it when the bullet stopped), and comes out when it took enough
    chipUnits(o, p, entry, penetrated ? Math.min(E, Math.max(thr, E * 0.5)) : E, d, Math.max(0.05, (caliber / 1000) * 8), src)
    return { penetrated, exitEnergy: penetrated ? (penMm !== undefined ? E * (1 - thr / Ep) : E - thr / (hard ? piercing : 1)) : 0, exitPoint, damage: dmg }
  }

  const melee = (o: ObjRT, p: PartRT, kind: 'blunt' | 'slash', E: number, point: Vec3, n: Vec3, d: Vec3, contactR: number, src?: string): number => {
    const mat = p.mat
    const thrMm = mat.penetration * p.thickness * 1000
    // brittle thin shells (a bottle, a mug, a pane) break from a knock that a thick block shrugs off
    const fragile = kind === 'blunt' ? fragility(mat.ductility, p.thickness) : 1
    const Ec = E * fragile
    if (E > 0) {
      if (kind === 'blunt') {
        if (mat.ductility >= 0.5) addDent(o, p, point, n, Math.max(contactR, 0.015), clamp(E * 0.0001, 0.001, 0.06), src)
        else if (mat.ductility < 0.3) {
          if (Ec >= 5) addCrack(o, p, point, n, clamp(0.04 + Math.min(Ec, E * 6) * 0.0008, 0.04, 0.6), src)
        } else if (E >= thrMm * 0.2) addDent(o, p, point, n, Math.max(contactR, 0.015), clamp(E * 0.00006, 0.001, 0.04), src)
      } else if (mat.fracture === 'tear') {
        addHole(o, p, point, n, clamp(0.02 + E * 0.0005, 0.02, 0.3), true, undefined, src)
      } else if (mat.ductility >= 0.5) {
        addDent(o, p, point, n, Math.max(contactR, 0.01), clamp(E * 0.00004, 0.0005, 0.02), src)
      }
      debris(o, p, mat.hitDebris, point, n, clamp(Math.round(E / 25) + 1, 1, 10), clamp(Math.sqrt(E) / 8, 1, 6), src)
    }
    // a blow shakes the joints of the part it lands on, except on the terrain a structure stands on (an anchored part tagged `terrain`): a piece that lands on the
    // ground does not loosen every wall that stands on it
    if (kind === 'blunt') {
      if (!(p.anchored && p.spec.tags?.includes('terrain'))) wearJoints(o, p, E * 0.3, undefined, 0, src)
    } else wearJoints(o, p, E * 0.3, point, 0.06, src)
    if (kind === 'blunt' && E > 0 && p.layers.length > 0) spallOuter(o, p, point, faceOf(o, p, n), n, Math.max(contactR, 0.05), src)
    const scale = mat.damageScale?.[kind] ?? 1
    const done = applyDamage(o, p, Ec * DMG_PER_J * scale * (kind === 'slash' ? p.cutFactor : 1), kind, point, d, E * 0.1, 12, src)
    addBreach(o, p, point, breachAreaOf(p, done, false), E, d, src)
    // a blow that did not open the wall wears the units it lands on
    if (kind === 'blunt') chipUnits(o, p, point, E, d, Math.max(contactR, 0.03), src)
    if (E > 0 && !isLost(p)) tearAt(o, p, kind, point, undefined, d, E, clamp(contactR * 0.2, 0.006, 0.02), src)
    return done
  }

  /**
   * What one part takes of a blast: dents, cracks, debris, heat, joint wear and the hit points. `reach` is the share of the blast that gets to the
   * part (`blast.shelter`; 1 without it) and it comes back, so a caller can report it. It is computed from the point of the part nearest to the centre.
   */
  const blastPart = (o: ObjRT, p: PartRT, point: Vec3, energy: number, radius: number, src: string | undefined, res: HitResult, reachAt?: (wp: Vec3, p: PartRT) => number): number | null => {
    if (isLost(p)) return null
    const { c, q } = partXf(o, p)
    const lp = toLocal(c, q, point)
    const dist = distanceToShape(p.spec.shape, lp)
    if (dist >= radius) return null
    const sp = surfacePoint(p.spec.shape, lp)
    const wp = toWorld(c, q, sp.point)
    const reach = reachAt ? reachAt(wp, p) : 1
    const f = (1 - dist / radius) ** 2 * reach
    const Ein = energy * f * BLAST_COUPLING
    const wn = rotateVec(q, sp.normal)
    if (!res.part) {
      res.part = p.spec.id
      res.point = wp
    }
    const mat = p.mat
    if (Ein > 20) {
      if (mat.ductility >= 0.5) addDent(o, p, wp, wn, clamp(0.05 + Math.sqrt(Ein) * 0.002, 0.05, 0.4), clamp(0.004 + Ein * 0.00002, 0.004, 0.08), src)
      else if (mat.ductility < 0.3 && Ein > 60) addCrack(o, p, wp, wn, clamp(0.05 + Ein * 0.0005, 0.05, 1), src)
      debris(o, p, mat.hitDebris, wp, wn, clamp(Math.round(Ein / 80) + 1, 1, 12), clamp(Math.sqrt(Ein) / 4, 2, 15), src)
    }
    const th = mat.thermal
    if (th.ignitionC !== undefined && p.st.fuel > 0) {
      p.st.temperature += 300 * f
      o.active = true
      if (f >= 0.25 && !p.st.burning) {
        p.st.temperature = Math.max(p.st.temperature, th.ignitionC + 1)
        checkIgnite(o, p, src)
      }
    }
    wearJoints(o, p, Ein * 0.5, undefined, 0, src)
    const amount = Ein * DMG_PER_J * (mat.damageScale?.explosive ?? 1)
    if (blastFrontSpeed > 0 && dist > 0 && mat.tags?.includes('glass')) {
      frontQueue.push({ o, p, due: time + dist / blastFrontSpeed, amount, fragEnergy: Ein * 0.3, point, ...(src !== undefined ? { src } : {}) })
      return reach
    }
    if (Ein > 20 && p.layers.length > 0) spallOuter(o, p, wp, faceOf(o, p, wn), wn, clamp(0.05 + Math.sqrt(Ein) * 0.002, 0.05, 0.4), src)
    const dealt = applyDamage(o, p, amount, 'explosive', point, null, Ein * 0.3, 40, src)
    res.damage += dealt
    if (p.bend && flexure.enabled) bendByBlast(o, p, point, energy, radius, reach, src)
    if (dist <= BREACH_BLAST_REACH * Math.cbrt(Math.max(0, energy) / 1000)) addBreach(o, p, wp, breachAreaOf(p, dealt, true), Ein, null, src)
    return reach
  }

  const blastObject = (o: ObjRT, point: Vec3, energy: number, radius: number, src?: string): HitResult => {
    const start = cur.length
    const res: HitResult = { object: o.id, damage: 0, penetrated: false, exitEnergy: 0, events: [] }
    for (const p of o.parts) blastPart(o, p, point, energy, radius, src, res)
    res.events = cur.slice(start)
    return res
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Blast options: shelter, fragment hits, confinement (all off by default)
  // -------------------------------------------------------------------------------------------------------------------------------------------

  interface BlastCfg {
    shelter: Required<ShelterOptions> | null
    frag: Required<FragmentHitOptions> | null
    /** A number is the multiplier itself. */
    conf: Required<ConfinementOptions> | number | null
  }

  const blastCfg = (call?: BlastOptions): BlastCfg => {
    const pick = <K extends keyof BlastOptions>(key: K): BlastOptions[K] => (call && call[key] !== undefined ? call[key] : options.blast?.[key])
    const merge = <T extends object>(v: boolean | T | undefined, defaults: Required<T>): Required<T> | null => {
      if (!v) return null
      const out = { ...defaults }
      if (v !== true) for (const [key, value] of Object.entries(v)) if (value !== undefined) (out as Record<string, unknown>)[key] = value
      return out
    }
    const conf = pick('confinement')
    return {
      shelter: merge(pick('shelter'), SHELTER_DEFAULTS),
      frag: merge(pick('fragmentHits'), FRAGMENT_HIT_DEFAULTS),
      conf: typeof conf === 'number' ? (Number.isFinite(conf) ? Math.max(0, conf) : 1) : merge(conf, CONFINEMENT_DEFAULTS),
    }
  }

  /** Same directions in every blast of this world: a Fibonacci lattice turned by the world seed. */
  const confinementRays = new Map<number, Vec3[]>()
  const raysOf = (n: number): Vec3[] => {
    let rays = confinementRays.get(n)
    if (rays) return rays
    const r = createRng((options.seed ?? 1) ^ 0x5bd1e995)
    const off = r.next()
    const phi0 = r.next() * Math.PI * 2
    rays = []
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + off)) / n
      const s = Math.sqrt(Math.max(0, 1 - y * y))
      const phi = phi0 + i * 2.399963229728653
      rays.push([Math.cos(phi) * s, y, Math.sin(phi) * s])
    }
    confinementRays.set(n, rays)
    return rays
  }

  /** Pressure multiplier of a blast at `point`: the host's number, or an estimate from rays that hit parts (never the ones that are lost or open). */
  const confinementOf = (conf: BlastCfg['conf'], point: Vec3, radius: number): number => {
    if (conf === null) return 1
    if (typeof conf === 'number') return conf
    let hits = 0
    let sum = 0
    for (const d of raysOf(Math.max(1, Math.round(conf.rays)))) {
      const h = raycastInternal(point, d, radius * conf.reach, undefined, true)
      if (h) {
        hits++
        sum += h.distance
      }
    }
    if (hits === 0) return 1
    const closed = hits / Math.max(1, Math.round(conf.rays))
    const ratio = clamp(radius / Math.max(sum / hits, 1e-3), 0, 2)
    return Math.min(Math.max(1, conf.max), 1 + conf.gain * closed ** conf.power * ratio)
  }

  const FLAG_LOST = 1
  const FLAG_OPEN = 2

  /** The legacy blast: every part of every object, then every impl, each at full strength. */
  const blastPlain = (point: Vec3, energy: number, radius: number, src?: string, lethal?: number): HitResult[] => {
    const out: HitResult[] = []
    for (const o of [...objects.values()]) {
      if (vec.distance(toWorld(o.st.position, o.st.rotation, o.bc), point) - o.br >= radius) continue
      const r = blastObject(o, point, energy, radius, src)
      if (r.part) out.push(r)
    }
    for (const im of [...impls.values()]) {
      if (implInRange(im, point, radius)) out.push(implHit(im, { type: 'explosive', point, energy, radius, ...(lethal !== undefined ? { lethalRadius: lethal } : {}), ...(src !== undefined ? { source: src } : {}) }))
    }
    return out
  }

  const implParts = (im: ImplRT) =>
    im.impl.describe().parts.map((ps) => {
      const ov = im.poses.get(ps.id)
      return { ps, c: toWorld(im.position, im.rotation, ov?.pos ?? ps.position), q: quat.mul(im.rotation, ov?.q ?? quatFromEuler(...(ps.rotation ?? [0, 0, 0]))) }
    })

  const implInRange = (im: ImplRT, point: Vec3, radius: number): boolean => implParts(im).some(({ ps, c, q }) => distanceToShape(ps.shape, toLocal(c, q, point)) < radius)

  /** A blast with shelter, fragment hits or confinement. Parts are served from the nearest to the farthest, so a wall takes the blast (and may break) before what is behind it. */
  const blastScene = (point: Vec3, energy: number, radius: number, src: string | undefined, cfg: BlastCfg, only?: ObjRT | ImplRT, lethal?: number): HitResult[] => {
    const mult = confinementOf(cfg.conf, point, radius)
    const E = energy * mult
    const shelter = cfg.shelter
    const flags = new Map<PartRT, number>()
    const inRange: ObjRT[] = []
    for (const o of objects.values()) {
      if (vec.distance(toWorld(o.st.position, o.st.rotation, o.bc), point) - o.br >= radius) continue
      inRange.push(o)
      if (shelter) for (const p of o.parts) flags.set(p, (isLost(p) ? FLAG_LOST : 0) | (p.st.opening || p.st.stripped ? FLAG_OPEN : 0))
    }
    // what each blocker stands in front of, to aim its fragments
    const shields = new Map<PartRT, Vec3[]>()
    /** Share of the blast that gets to `tp` (world) through everything between it and the centre; `self` never blocks. */
    const reachAt = (tp: Vec3, self: PartRT | null): number => {
      if (!shelter) return 1
      const L = vec.distance(point, tp)
      if (L < 1e-4) return 1
      const d = vec.scale(vec.sub(tp, point), 1 / L)
      let t = 1
      for (const o of inRange) {
        if (raySphereMiss(point, d, toWorld(o.st.position, o.st.rotation, o.bc), o.br, L)) continue
        for (const p of o.parts) {
          if (p === self) continue
          const was = flags.get(p) ?? 0
          if (was & FLAG_LOST) continue
          const r = rayPart(o, p, point, d)
          if (!r) continue
          const t0 = Math.max(r.t0, 0)
          const path = Math.min(r.t1, L) - t0
          if (path < shelter.minPath) continue
          const mid = vec.madd(point, d, t0 + path / 2)
          const opening = p.st.opening && insideOpening(o, p, mid)
          if (opening && was & FLAG_OPEN) continue
          if (p.st.stripped && was & FLAG_OPEN) continue
          const resistance = p.mat.hpPerKg * p.mat.density * path * (p.mat.damageScale?.shelter ?? 1)
          let ti = Math.exp(-resistance / shelter.k)
          // destroyed or breached by this same blast: part of what it held back goes through
          if (isLost(p) || opening || (p.st.stripped && !(was & FLAG_OPEN))) ti += (1 - ti) * shelter.brokenTransmission
          t *= ti
          if (cfg.frag) {
            let list = shields.get(p)
            if (!list) shields.set(p, (list = []))
            list.push(tp)
          }
        }
      }
      return t
    }

    interface Item { dist: number; order: number; o?: ObjRT; p?: PartRT; im?: ImplRT }
    const items: Item[] = []
    let order = 0
    for (const o of inRange) {
      if (only && only !== o) continue
      for (const p of o.parts) {
        if (isLost(p)) continue
        const dist = distToPart(o, p, point)
        if (dist < radius) items.push({ dist, order: order++, o, p })
      }
    }
    for (const im of impls.values()) {
      if (only && only !== im) continue
      let dist = Infinity
      for (const { ps, c, q } of implParts(im)) dist = Math.min(dist, distanceToShape(ps.shape, toLocal(c, q, point)))
      if (dist < radius) items.push({ dist, order: order++, im })
    }
    items.sort((a, b) => a.dist - b.dist || a.order - b.order)

    const results = new Map<ObjRT | ImplRT, HitResult>()
    const reports = new Map<ObjRT | ImplRT, BlastReport>()
    const report = (key: ObjRT | ImplRT): BlastReport => {
      let r = reports.get(key)
      if (!r) reports.set(key, (r = { shelter: 0, confinement: mult, fragmentHits: 0 }))
      return r
    }
    const thrown: Array<{ frag: Fragment; object: string; part: PartRT | null }> = []
    const sweep = (from: number) => {
      if (!cfg.frag) return
      for (let i = from; i < cur.length; i++) {
        const e = cur[i]!
        if (e.type !== 'fracture' && e.type !== 'stage') continue
        for (const frag of e.fragments ?? []) thrown.push({ frag, object: e.object, part: objects.get(e.object)?.byId.get(e.part) ?? null })
      }
    }

    for (const it of items) {
      if (it.o && it.p) {
        const o = it.o
        let res = results.get(o)
        if (!res) results.set(o, (res = { object: o.id, damage: 0, penetrated: false, exitEnergy: 0, events: [] }))
        const start = cur.length
        const k = blastPart(o, it.p, point, E, radius, src, res, shelter ? reachAt : undefined)
        res.events.push(...cur.slice(start))
        sweep(start)
        if (k !== null) {
          const rep = report(o)
          rep.shelter = Math.max(rep.shelter, k)
          if (shelter) (rep.parts ??= {})[it.p.spec.id] = k
        }
      } else if (it.im) {
        const im = it.im
        // the impl takes one hit: the share of the blast that gets to its parts, weighted by how hard the blast hits each
        let num = 0
        let den = 0
        for (const { ps, c, q } of implParts(im)) {
          const lp = toLocal(c, q, point)
          const dist = distanceToShape(ps.shape, lp)
          if (dist >= radius) continue
          const f = (1 - dist / radius) ** 2
          const sp = surfacePoint(ps.shape, lp)
          num += f * reachAt(toWorld(c, q, sp.point), null)
          den += f
        }
        const k = den > 0 ? num / den : 1
        const res = implHit(im, { type: 'explosive', point, energy: E * k, radius, ...(lethal !== undefined ? { lethalRadius: lethal } : {}), ...(shelter ? { shelter: k } : {}), ...(src !== undefined ? { source: src } : {}) })
        results.set(im, res)
        report(im).shelter = k
      }
    }

    if (cfg.frag && thrown.length > 0) {
      const g = cfg.frag
      const energyOf = (f: Fragment) => 0.5 * f.mass * (f.velocity[0] ** 2 + f.velocity[1] ** 2 + f.velocity[2] ** 2)
      const list = thrown
        .map((t, i) => ({ ...t, i, e: energyOf(t.frag) }))
        .sort((a, b) => b.e - a.e || a.i - b.i)
        .slice(0, Math.max(0, Math.floor(g.max)))
      list.forEach((t, i) => throwFragment(t.frag, t.object, t.part, g, point, i, src, shields, results, reports, mult))
    }

    const out: HitResult[] = []
    const reportShelter = (key: ObjRT | ImplRT, res: HitResult) => {
      res.blast = reports.get(key) ?? { shelter: 1, confinement: mult, fragmentHits: 0 }
    }
    const summary: Array<{ object: string; part?: string; factor: number }> = []
    let fragmentHits = 0
    for (const o of objects.values()) {
      const r = results.get(o)
      if (!r?.part) continue
      reportShelter(o, r)
      out.push(r)
      for (const [part, factor] of Object.entries(r.blast?.parts ?? {})) summary.push({ object: o.id, part, factor })
      fragmentHits += r.blast?.fragmentHits ?? 0
    }
    for (const im of impls.values()) {
      const r = results.get(im)
      if (!r) continue
      reportShelter(im, r)
      out.push(r)
      if (shelter) summary.push({ object: im.impl.id, factor: r.blast?.shelter ?? 1 })
      fragmentHits += r.blast?.fragmentHits ?? 0
    }
    emit({ type: 'blast', object: '', time, ...(src !== undefined ? { source: src } : {}), point, energy: E, radius, confinement: mult, shelter: summary, fragmentHits })
    return out
  }

  /** Integer seed from numbers: a fragment's flight depends only on the blast and on the fragment, not on what the world did before. */
  const seedOf = (...nums: number[]): number => {
    let h = 2166136261
    for (const n of nums) {
      h = Math.imul(h ^ (Math.round(n * 1000) | 0), 16777619)
      h ^= h >>> 15
    }
    return h | 0
  }

  /** One fragment of a part the blast broke flies on: a low-energy hit on the first part or impl it reaches within its throw. */
  const throwFragment = (
    frag: Fragment, objectId: string, from: PartRT | null, g: Required<FragmentHitOptions>, centre: Vec3, index: number, src: string | undefined,
    shields: Map<PartRT, Vec3[]>, results: Map<ObjRT | ImplRT, HitResult>, reports: Map<ObjRT | ImplRT, BlastReport>, mult: number,
  ) => {
    const v = frag.velocity
    const speed = Math.hypot(v[0], v[1], v[2])
    const energy = g.energyFactor * 0.5 * frag.mass * speed * speed
    if (speed < 0.5 || energy < 1) return
    const r = createRng(seedOf(options.seed ?? 1, centre[0], centre[1], centre[2], index, frag.center[0], frag.center[1], frag.center[2]))
    let dir = vec.scale(v, 1 / speed)
    // a fragment of a blocker whose flight points at a target behind it goes for that target
    const behind = from ? shields.get(from) : undefined
    if (behind) {
      let best = Math.cos((g.aim * Math.PI) / 180)
      for (const tp of behind) {
        const to = vec.sub(tp, frag.center)
        const len = vec.length(to)
        if (len < 1e-4) continue
        const cos = vec.dot(dir, to) / len
        if (cos >= best) {
          best = cos
          dir = vec.scale(to, 1 / len)
        }
      }
    }
    const spread = Math.tan((g.spread * Math.PI) / 180)
    dir = vec.normalize([dir[0] + (r.next() - 0.5) * 2 * spread, dir[1] + (r.next() - 0.5) * 2 * spread, dir[2] + (r.next() - 0.5) * 2 * spread], dir)
    const range = Math.min(g.range, speed * g.flightTime)
    const origin = vec.madd(frag.center, dir, 0.02)
    const rh = raycastInternal(origin, dir, range, from ? new Set([`${objectId}\0${from.spec.id}`]) : undefined)
    if (!rh) return
    const hit: Hit = {
      type: g.hitType, point: rh.point, direction: dir, energy, radius: 0.05, part: rh.part,
      ...(g.hitType === 'ballistic' ? { caliber: clamp(Math.max(...frag.size) * 1000, 3, 30), mass: frag.mass * 1000 } : {}),
      ...(src !== undefined ? { source: src } : {}),
    }
    emit({ type: 'fragment_hit', object: objectId, time, ...(src !== undefined ? { source: src } : {}), from: { object: objectId, part: frag.part }, target: { object: rh.object, part: rh.part }, point: rh.point, direction: dir, energy, mass: frag.mass, speed })
    const im = impls.get(rh.object)
    const o = im ? undefined : objects.get(rh.object)
    const key = im ?? o
    if (!key) return
    const res = im ? implHit(im, hit) : doHit(o!, hit, o!.byId.get(rh.part))
    const have = results.get(key)
    if (have) {
      have.damage += res.damage
      have.events.push(...res.events)
      if (!have.part) have.part = res.part
      if (res.penetrated) have.penetrated = true
    } else results.set(key, { ...res, events: [...res.events] })
    let rep = reports.get(key)
    if (!rep) reports.set(key, (rep = { shelter: 1, confinement: mult, fragmentHits: 0 }))
    rep.fragmentHits++
  }

  const blastWorld = (point: Vec3, energy: number, radius: number, src?: string, call?: BlastOptions, only?: ObjRT | ImplRT, lethal?: number): HitResult[] => {
    const cfg = blastCfg(call)
    const res = !cfg.shelter && !cfg.frag && cfg.conf === null ? blastPlain(point, energy, radius, src, lethal) : blastScene(point, energy, radius, src, cfg, only, lethal)
    // a blast is a flame: a container that leaks flammable fluid inside it catches
    lightLeaksNear(point, radius)
    return res
  }

  const heatObject = (o: ObjRT, point: Vec3, T: number, radius: number, duration: number, src?: string): HitResult => {
    const start = cur.length
    const res: HitResult = { object: o.id, damage: 0, penetrated: false, exitEnergy: 0, events: [] }
    for (const p of o.parts) {
      if (isLost(p)) continue
      const dist = distToPart(o, p, point)
      if (dist >= radius) continue
      const f = clamp(1 - dist / radius, 0.25, 1)
      if (!res.part) {
        res.part = p.spec.id
        res.point = point
      }
      if (T > p.st.temperature) {
        const k = (0.8 * f) / (p.mat.thermal.heatCapacity ?? 1)
        p.st.temperature += (T - p.st.temperature) * (1 - Math.exp(-k * duration))
      }
      o.active = true
      // a flame held against a flammable leak lights it: it burns, or goes off by its chain, at the next update
      if (T >= FLAME_LIGHTS_LEAK_C && !p.rt.jet && !p.rt.lit && leaksFlammable(p)) p.rt.lit = true
      checkIgnite(o, p, src)
    }
    res.events = cur.slice(start)
    return res
  }

  const doHit = (o: ObjRT, hit: Hit, only?: PartRT): HitResult => {
    let point = hit.point
    let dir = hit.direction
    if (hit.space === 'local') {
      point = toWorld(o.st.position, o.st.rotation, point)
      if (dir) dir = rotateVec(o.st.rotation, dir)
    }
    const src = hit.source
    const start = cur.length
    let res: HitResult = { object: o.id, damage: 0, penetrated: false, exitEnergy: 0, events: [] }
    const E = hit.energy ?? 0
    if (hit.type === 'ballistic') {
      const loc = locate(o, point, dir, 0.05, only)
      if (loc) {
        const out = ballistic(o, loc.p, loc.point, loc.normal, loc.dir, E, hit.caliber ?? 9, loc.pathLen, src, hit)
        res = { ...res, part: loc.p.spec.id, point: loc.point, damage: out.damage, penetrated: out.penetrated, exitEnergy: out.exitEnergy }
      }
    } else if (hit.type === 'blunt' || hit.type === 'slash') {
      const radius = hit.radius ?? 0
      const loc = locate(o, point, dir, Math.max(0.05, radius), only)
      if (loc) {
        res.part = loc.p.spec.id
        res.point = loc.point
        res.damage += melee(o, loc.p, hit.type, E, loc.point, loc.normal, loc.dir, radius || 0.03, src)
        if (radius > 0.1 && !only) {
          for (const p of o.parts) {
            if (p === loc.p || isLost(p)) continue
            const dd = distToPart(o, p, point)
            if (dd >= radius) continue
            const { c, q } = partXf(o, p)
            const sp = surfacePoint(p.spec.shape, toLocal(c, q, point))
            res.damage += melee(o, p, hit.type, E * (1 - dd / radius) ** 2, toWorld(c, q, sp.point), rotateVec(q, sp.normal), loc.dir, radius, src)
          }
        }
      }
    } else if (hit.type === 'explosive') {
      const call = hit.blast || hit.confinement !== undefined ? { ...hit.blast, ...(hit.confinement !== undefined ? { confinement: hit.confinement } : {}) } : undefined
      const cfg = blastCfg(call)
      if (!cfg.shelter && !cfg.frag && cfg.conf === null) res = blastObject(o, point, E, hit.radius ?? 2, src)
      else {
        res = blastWorld(point, E, hit.radius ?? 2, src, call, o)[0] ?? res
        res.events = cur.slice(start)
      }
    } else {
      res = heatObject(o, point, hit.temperature ?? 800, hit.radius ?? 0.25, hit.duration ?? 1, src)
    }
    res.events = cur.slice(start)
    return res
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // Fire, heat, melting, leaks
  // -------------------------------------------------------------------------------------------------------------------------------------------

  const checkIgnite = (o: ObjRT, p: PartRT, src?: string) => {
    const th = p.mat.thermal
    if (isLost(p) || p.st.burning || th.ignitionC === undefined || p.st.fuel <= 0 || p.st.temperature < th.ignitionC) return
    p.st.burning = true
    p.st.temperature = Math.max(p.st.temperature, th.flameC ?? 800)
    o.active = true
    markDamaged(p)
    emit({ ...base(o, src), type: 'ignite', part: p.spec.id, point: partXf(o, p).c })
  }

  const syncMass = (p: PartRT) => {
    p.st.mass = Math.max(0, p.mass0 * (1 - p.st.melt) - (p.fuel0 - p.st.fuel))
  }

  const burnStep = (o: ObjRT, p: PartRT, dt: number) => {
    const th = p.mat.thermal
    const use = Math.min((th.burnRate ?? 0.01) * p.area * dt, p.st.fuel)
    p.st.fuel -= use
    syncMass(p)
    if (p.structural) o.dirty = true
    p.st.temperature = th.flameC ?? 800
    markDamaged(p)
    if (p.fuel0 > 0) {
      p.st.char = clamp(1 - p.st.fuel / p.fuel0, 0, 1)
      p.st.hp = Math.min(p.st.hp, Math.max(1, p.st.maxHp * (p.st.fuel / p.fuel0)))
    }
    if (p.st.fuel <= 1e-9) {
      p.st.fuel = 0
      p.st.burning = false
      p.st.char = 1
      const c = partXf(o, p).c
      if ((th.fuelFraction ?? 0) >= 0.8) {
        p.st.status = 'ashes'
        p.st.hp = 0
        p.st.mass = p.mass0 * (1 - (th.fuelFraction ?? 0))
        emit({ ...base(o), type: 'burnout', part: p.spec.id, point: c })
        debris(o, p, 'ash', c, [0, 1, 0], clamp(Math.round(Math.cbrt(partVolume(p.spec.shape)) * 30), 3, 20), 1)
        partLost(o, p)
      } else {
        emit({ ...base(o), type: 'burnout', part: p.spec.id, point: c })
      }
    }
  }

  const meltStep = (o: ObjRT, p: PartRT, dt: number) => {
    const th = p.mat.thermal
    if (th.meltC === undefined || p.st.temperature <= th.meltC) return
    const rate = (th.meltRate ?? 0.05) * ((p.st.temperature - th.meltC) / 100)
    p.st.melt = Math.min(1, p.st.melt + rate * dt)
    syncMass(p)
    if (p.structural) o.dirty = true
    markDamaged(p)
    p.rt.dripT += dt
    if (p.rt.dripT >= 0.25) {
      p.rt.dripT -= 0.25
      const b = partWorldAabb(o, p)
      const pt: Vec3 = [b.min[0] + (b.max[0] - b.min[0]) * (0.2 + 0.6 * rnd()), b.min[1], b.min[2] + (b.max[2] - b.min[2]) * (0.2 + 0.6 * rnd())]
      emit({ ...base(o), type: 'drip', part: p.spec.id, point: pt, material: p.mat.id })
    }
    if (p.st.melt - p.rt.meltEmitted >= 0.05 || p.st.melt >= 1) {
      p.rt.meltEmitted = p.st.melt
      emit({ ...base(o), type: 'melt', part: p.spec.id, melt: p.st.melt })
    }
    if (p.st.melt >= 1) {
      p.st.status = 'melted'
      p.st.hp = 0
      p.st.mass = 0
      p.st.burning = false
      p.rt.jet = false
      partLost(o, p)
    }
  }

  const stepObject = (o: ObjRT, dt: number, sources: Array<{ o: ObjRT; p: PartRT; flame: number }>) => {
    const parts = o.parts
    const T0 = o.tmp
    T0.length = parts.length
    for (let i = 0; i < parts.length; i++) T0[i] = parts[i].st.temperature
    let hot = false
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (isLost(p)) continue
      const th = p.mat.thermal
      const hc = th.heatCapacity ?? 1
      const s = p.st
      if (p.rt.jet) {
        s.temperature = Math.max(s.temperature, 900)
      } else if (s.burning) {
        burnStep(o, p, dt)
        if (isLost(p)) continue
      }
      if (!s.burning && !p.rt.jet) {
        // conduction from hotter neighbours through closed joints, then cooling
        let dT = 0
        let maxN = s.temperature
        for (const j of o.byPart.get(p.spec.id)!) {
          if (j.st.open) continue
          const k = j.ia === i ? j.ib : j.ia
          if (isLost(parts[k]) || T0[k] <= T0[i]) continue
          const c = (th.conductivity + parts[k].mat.thermal.conductivity) / 2
          dT += (T0[k] - T0[i]) * (1 - Math.exp((-1.2 * c * dt) / hc))
          if (T0[k] > maxN) maxN = T0[k]
        }
        if (dT > 0) s.temperature = Math.min(s.temperature + dT, maxN)
        s.temperature += (ambient - s.temperature) * (1 - Math.exp(-dt / (20 * hc)))
        if (Math.abs(s.temperature - ambient) < 0.05) s.temperature = ambient
      }
      meltStep(o, p, dt)
      if (isLost(p)) continue
      checkIgnite(o, p)
      const ex = p.spec.explodes
      if (ex && chainDelayOf(p.spec, 'fire') !== undefined) {
        if (s.temperature >= (ex.atC ?? FIRE_PRIME_C)) prime(o, p, 'fire')
      } else if (ex && ex.atC !== undefined && s.temperature >= ex.atC) {
        failPart(o, p, null, null, 0, 40)
        continue
      }
      // leaks
      const cont = p.spec.contains
      if (cont && (s.liters ?? 0) > 0) {
        let rate = 0
        for (const h of s.holes) if (h.through) rate += holeRate(h, !!cont.pressurized)
        if (rate > 0) {
          s.liters = Math.max(0, (s.liters ?? 0) - rate * dt)
          hot = true
          if (FLAMMABLE_FLUIDS.includes(cont.fluid) && (s.temperature >= 350 || p.rt.lit) && !p.rt.jet) {
            p.rt.lit = false
            if (ex && chainDelayOf(p.spec, 'fire') !== undefined) {
              prime(o, p, 'fire')
              continue
            }
            if (ex) {
              failPart(o, p, null, null, 0, 40)
              continue
            }
            p.rt.jet = true
            s.burning = true
            emit({ ...base(o), type: 'ignite', part: p.spec.id, point: partXf(o, p).c })
          }
        }
      }
      if ((s.liters ?? 0) <= 0) p.rt.lit = false
      if (p.rt.jet && (s.liters ?? 0) <= 0) {
        p.rt.jet = false
        s.burning = false
        emit({ ...base(o), type: 'extinguish', part: p.spec.id })
      }
      // thermal shock
      const sc = th.thermalShockC
      if (sc !== undefined) {
        p.rt.shockT = Math.max(0, p.rt.shockT - dt)
        const rate = Math.abs(s.temperature - p.rt.prevTemp) / dt
        p.rt.prevTemp = s.temperature
        if (rate > sc && p.rt.shockT <= 0) {
          p.rt.shockT = 1
          const { c, q } = partXf(o, p)
          const lp: Vec3 = [(rnd() - 0.5) * p.dims[0], (rnd() - 0.5) * p.dims[1], (rnd() - 0.5) * p.dims[2]]
          const sp = surfacePoint(p.spec.shape, lp)
          addCrack(o, p, toWorld(c, q, sp.point), rotateVec(q, sp.normal), 0.1 + (rate / sc) * 0.1)
          applyDamage(o, p, p.st.maxHp * 0.25, 'heat', null, null, 5, 3)
          if (isLost(p)) continue
        }
      }
      if (s.burning || p.rt.jet) sources.push({ o, p, flame: p.rt.jet ? 900 : th.flameC ?? 800 })
      if (s.burning || p.rt.jet || s.temperature > ambient + 0.5) hot = true
    }
    if (o.hasStructure) {
      if (o.dirty) {
        o.dirty = false
        solveStructure(o)
      }
      for (const p of parts) {
        if (!p.structural || isLost(p)) continue
        const stress = p.st.stress ?? 0
        p.rt.stressT = Math.max(0, (p.rt.stressT ?? 0) - dt)
        if (stress > 1) {
          if (p.rt.stressT <= 0) {
            p.rt.stressT = 0.5
            emit({ ...base(o), type: 'stress', part: p.spec.id, stress, load: p.st.load ?? 0 })
          }
          applyDamage(o, p, overloadRate(stress) * p.st.maxHp * dt, 'blunt', null, null, 5, 3)
        } else if (stress > 0.8 && p.mat.ductility < 0.3 && p.rt.stressT <= 0 && p.st.cracks.length < 6) {
          p.rt.stressT = 0.5
          const { c, q } = partXf(o, p)
          const sp = surfacePoint(p.spec.shape, [(rnd() - 0.5) * p.dims[0], (rnd() - 0.5) * p.dims[1], (rnd() - 0.5) * p.dims[2]])
          addCrack(o, p, toWorld(c, q, sp.point), rotateVec(q, sp.normal), 0.1 + (stress - 0.8) * 0.5)
        }
      }
      if (o.maxStress > 0.8) hot = true
    }
    o.active = hot
  }

  /** A leak of flammable fluid within `ignition.fireNear.radius` of a burning part (or of a jet) lights at `chancePerSecond`. */
  const igniteLeaksNearFire = (sources: Array<{ o: ObjRT; p: PartRT; flame: number }>, dt: number) => {
    const { radius, chancePerSecond } = ignitionRules.fireNear
    if (chancePerSecond <= 0) return
    const chance = 1 - Math.exp(-chancePerSecond * dt)
    for (const src of sources) {
      if (!src.p.st.burning && !src.p.rt.jet) continue
      const sc = partXf(src.o, src.p).c
      for (const o of objects.values()) {
        for (const q of o.parts) {
          if (q === src.p || isLost(q) || q.rt.lit || q.rt.jet || !leaksFlammable(q)) continue
          if (vec.distance(partXf(o, q).c, sc) - q.bound - src.p.bound > radius) continue
          if (rnd() < chance) {
            q.rt.lit = true
            o.active = true
          }
        }
      }
    }
  }

  const spread = (sources: Array<{ o: ObjRT; p: PartRT; flame: number }>, dt: number) => {
    for (const src of sources) {
      if (!src.p.st.burning && !src.p.rt.jet) continue
      const sc = toWorld(src.o.st.position, src.o.st.rotation, src.p.pos)
      const A = partWorldAabb(src.o, src.p)
      for (const o of objects.values()) {
        if (o === src.o) continue
        if (vec.distance(toWorld(o.st.position, o.st.rotation, o.bc), sc) > o.br + src.p.bound + fireSpread) continue
        for (const q of o.parts) {
          if (isLost(q) || q.st.burning) continue
          const B = partWorldAabb(o, q)
          const gap = Math.hypot(
            Math.max(0, A.min[0] - B.max[0], B.min[0] - A.max[0]),
            Math.max(0, A.min[1] - B.max[1], B.min[1] - A.max[1]),
            Math.max(0, A.min[2] - B.max[2], B.min[2] - A.max[2]),
          )
          if (gap >= fireSpread || src.flame <= q.st.temperature) continue
          const f = 1 - gap / fireSpread
          q.st.temperature += (src.flame - q.st.temperature) * (1 - Math.exp((-0.6 * f * dt) / (q.mat.thermal.heatCapacity ?? 1)))
          o.active = true
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // World API
  // -------------------------------------------------------------------------------------------------------------------------------------------

  /** The primed part that goes off first: earliest due time, then the older object, then the part listed first. */
  const nextPrimed = (until: number): { o: ObjRT; p: PartRT } | null => {
    let best: { o: ObjRT; p: PartRT } | null = null
    for (const [p, o] of primed) {
      if (objects.get(o.id) !== o || isLost(p)) {
        primed.delete(p)
        continue
      }
      const due = p.rt.chainDue as number
      if (due > until) continue
      if (!best) best = { o, p }
      else {
        const bestDue = best.p.rt.chainDue as number
        if (due < bestDue || (due === bestDue && (o.order < best.o.order || (o.order === best.o.order && (o.idx.get(p.spec.id) ?? 0) < (best.o.idx.get(best.p.spec.id) ?? 0))))) best = { o, p }
      }
    }
    return best
  }

  /**
   * Explodes the primed parts whose delay ran out by `until`, one at a time in order of time; each blast is resolved before the next part goes off,
   * so a part it primes counts its delay from that moment, not from the end of the frame.
   */
  const detonatePrimed = (until: number) => {
    const end = time
    for (let next = nextPrimed(until); next; next = nextPrimed(until)) {
      primed.delete(next.p)
      time = Math.max(0, Math.min(end, next.p.rt.chainDue as number))
      next.p.rt.chainDue = undefined
      failPart(next.o, next.p, null, null, 0, 40)
      drainBlasts()
    }
    time = end
  }

  /** Lands the damage of the glass the blast front has reached by `time`, the nearest first. */
  const releaseFront = () => {
    if (frontQueue.length === 0) return
    frontQueue.sort((a, b) => a.due - b.due)
    while (frontQueue.length > 0 && frontQueue[0]!.due <= time) {
      const hit = frontQueue.shift()!
      if (objects.get(hit.o.id) !== hit.o) continue
      applyDamage(hit.o, hit.p, hit.amount, 'explosive', hit.point, null, hit.fragEnergy, 40, hit.src)
    }
  }

  /** Collapse events are produced after the whole operation: make sure the result of the operation carries them. */
  const withCollapses = (r: { value: HitResult[]; events: DestructionEvent[] }): HitResult[] => {
    const last = r.value[r.value.length - 1]
    if (!last) return r.value
    for (const e of r.events) if (e.type === 'collapse' && !r.value.some((h) => h.events.includes(e))) last.events.push(e)
    return r.value
  }

  /** An explosive hit on an impl: a blast of its own when blast options are on, else the plain hit. */
  const blastImpl = (im: ImplRT, h: Hit): HitResult => {
    const call = h.blast || h.confinement !== undefined ? { ...h.blast, ...(h.confinement !== undefined ? { confinement: h.confinement } : {}) } : undefined
    const cfg = blastCfg(call)
    if (!cfg.shelter && !cfg.frag && cfg.conf === null) return implHit(im, h)
    const world = h.space === 'local' ? toWorld(im.position, im.rotation, h.point) : h.point
    const r = blastWorld(world, h.energy ?? 0, h.radius ?? 2, h.source, call, im)
    return r.find((x) => x.object === im.impl.id) ?? implHit(im, h)
  }

  const whole = (fn: () => HitResult): HitResult => {
    const r = run(fn)
    r.value.events = r.events
    return r.value
  }

  const world: DestructionWorld = {
    materials,
    get time() {
      return time
    },
    add(spec, opts: AddOptions = {}) {
      const id = opts.id ?? nextId()
      if (taken(id)) throw new Error(`object "${id}" already exists`)
      objects.set(id, build(resolveSpec(spec), id, opts.position ?? [0, 0, 0], opts.rotation ?? [0, 0, 0, 1]))
      return id
    },
    register(impl, opts: AddOptions = {}) {
      const id = opts.id ?? impl.id
      if (taken(id)) throw new Error(`object "${id}" already exists`)
      impls.set(id, { impl, position: opts.position ?? [0, 0, 0], rotation: opts.rotation ?? [0, 0, 0, 1], poses: new Map() })
      return id
    },
    setPartPose(objectId, partId, position, rotation) {
      const q = quatFromEuler(...(rotation ?? [0, 0, 0]))
      const im = impls.get(objectId)
      if (im) {
        im.impl.setPartPose?.(partId, position, rotation)
        im.poses.set(partId, { pos: [position[0], position[1], position[2]], q })
        return
      }
      const o = getObj(objectId)
      const p = getPart(o, partId)
      p.pos = [position[0], position[1], position[2]]
      p.q = q
      updateBound(o)
    },
    remove(id) {
      objects.delete(id)
      impls.delete(id)
    },
    has: (id) => taken(id),
    ids: () => [...objects.keys(), ...impls.keys()],
    setTransform(id, position, rotation) {
      const im = impls.get(id)
      if (im) {
        im.position = [position[0], position[1], position[2]]
        im.rotation = [rotation[0], rotation[1], rotation[2], rotation[3]]
        return
      }
      const o = getObj(id)
      o.base = { pos: [position[0], position[1], position[2]], rot: [rotation[0], rotation[1], rotation[2], rotation[3]] }
      applySoilPose(o)
    },
    splitGroup(id, group, newId) {
      if (impls.has(id)) throw new Error(`object "${id}" is a registered DestructibleImpl and cannot be split; its module owns its pieces`)
      const o = getObj(id)
      if (o.st.groups.length < 2) return id
      const names = o.st.groups[group]
      if (!names) throw new Error(`object "${id}" has no group ${group}`)
      const moved = new Set(names)
      const nid = newId ?? nextId()
      if (objects.has(nid)) throw new Error(`object "${nid}" already exists`)
      // an open joint between the two objects stays with the original
      const carryFor = (keep: (pid: string) => boolean, keepOpen: (a: string, b: string) => boolean = () => false): Carry => ({
        parts: new Map(o.parts.filter((p) => keep(p.spec.id)).map((p) => [p.spec.id, { st: p.st, rt: p.rt }])),
        joints: new Map([
          ...o.joints.filter((j) => (keep(j.spec.a) && keep(j.spec.b)) || (j.st.open && keepOpen(j.spec.a, j.spec.b))).map((j): [string, { st: JointState; step: number }] => [j.spec.id, { st: j.st, step: j.step }]),
          ...o.st.joints.filter((st) => st.open && !o.jointMap.has(st.id) && keepOpen(st.a, st.b)).map((st): [string, { st: JointState; step: number }] => [st.id, { st, step: 0 }]),
        ]),
        collapsed: [...o.collapsed].filter(keep),
      })
      const sub = (keep: (pid: string) => boolean): DestructibleSpec => {
        const s: DestructibleSpec = { parts: o.spec.parts.filter((p) => keep(p.id)), joints: (o.spec.joints ?? []).filter((j) => keep(j.a) && keep(j.b)) }
        if (o.spec.name !== undefined) s.name = o.spec.name
        if (o.spec.tags) s.tags = [...o.spec.tags]
        if (o.spec.soil !== undefined) s.soil = o.spec.soil
        return clone(s)
      }
      const inNew = (pid: string) => moved.has(pid)
      const inOld = (pid: string) => !moved.has(pid)
      const pos = o.st.position, rot = o.st.rotation
      const fresh = build(sub(inNew), nid, pos, rot, carryFor(inNew, (a, b) => inNew(a) && inNew(b)))
      const restCarry = carryFor(inOld, (a, b) => !(inNew(a) && inNew(b)))
      if (o.st.soil) restCarry.soil = o.st.soil
      if (o.soil?.sets.size) restCarry.soilSets = Object.fromEntries(o.soil.sets)
      const rest = build(sub(inOld), id, o.soil ? o.base.pos : pos, o.soil ? o.base.rot : rot, restCarry)
      objects.set(id, rest)
      objects.set(nid, fresh)
      return nid
    },
    hit(objectId, h) {
      const im = impls.get(objectId)
      if (im) return whole(() => (h.type === 'explosive' ? blastImpl(im, h) : implHit(im, h)))
      const o = getObj(objectId)
      return whole(() => doHit(o, h))
    },
    hitPart(objectId, partId, h) {
      const im = impls.get(objectId)
      if (im) return whole(() => implHit(im, h))
      const o = getObj(objectId)
      const p = getPart(o, partId)
      return whole(() => doHit(o, h, p))
    },
    explode(point, energy, radius, source, blast) {
      return withCollapses(run(() => blastWorld(point, energy, radius, source, blast)))
    },
    raycast(origin, direction, maxDistance = Infinity) {
      const r = raycastInternal(origin, direction, maxDistance)
      return r ? { object: r.object, part: r.part, point: r.point, normal: r.normal, distance: r.distance } : null
    },
    shoot(origin, direction, energy, caliber, source, round) {
      const extras: BallisticExtras = typeof round === 'number' ? { piercing: round } : round ?? {}
      return withCollapses(run(() => {
        const results: HitResult[] = []
        const d = vec.normalize(direction)
        const ignore = new Set<string>()
        let org = origin
        let E = energy
        for (let i = 0; i < 4 && E > 0; i++) {
          const rh = raycastInternal(org, d, Infinity, ignore)
          if (!rh) break
          const im = impls.get(rh.object)
          if (im) {
            const r = implHit(im, { type: 'ballistic', point: rh.point, direction: d, energy: E, caliber, ...extras, ...(source !== undefined ? { source } : {}) })
            r.part = rh.part
            r.point = rh.point
            r.exitEnergy = r.penetrated ? E * 0.5 : 0
            results.push(r)
            ignore.add(`${im.impl.id}\0${rh.part}`)
            if (!r.penetrated) break
            org = vec.madd(rh.point, d, Math.min(rh.pathLen, 0.05) + 0.001)
            E = r.exitEnergy
            continue
          }
          const o = getObj(rh.object)
          const p = getPart(o, rh.part)
          const start = cur.length
          const out = ballistic(o, p, rh.point, rh.normal, d, E, caliber, rh.pathLen, source, extras)
          results.push({ object: o.id, part: p.spec.id, point: rh.point, damage: out.damage, penetrated: out.penetrated, exitEnergy: out.exitEnergy, events: cur.slice(start) })
          ignore.add(`${o.id}\0${p.spec.id}`)
          if (!out.penetrated || !out.exitPoint) break
          org = vec.madd(out.exitPoint, d, 0.001)
          E = out.exitEnergy
        }
        return results
      }))
    },
    disassemble(objectId, jointId, tool: ToolKind, dt) {
      const im = impls.get(objectId)
      if (im) return im.impl.disassemble ? im.impl.disassemble(jointId, tool, dt) : -1
      const o = getObj(objectId)
      const j = o.jointMap.get(jointId)
      if (!j || !j.spec.tools.includes(tool)) return -1
      if (j.st.open) return 1
      return run(() => {
        j.st.progress = Math.min(1, j.st.progress + (j.spec.seconds > 0 ? dt / j.spec.seconds : 1))
        if (j.st.progress >= 1 - 1e-9) j.st.progress = 1
        const step = Math.floor(j.st.progress * 10 + 1e-9)
        if (step > j.step || j.st.progress >= 1) {
          j.step = step
          emit({ ...base(o), type: 'disassemble_progress', joint: j.spec.id, tool, progress: j.st.progress })
        }
        if (j.st.progress >= 1) {
          j.st.open = true
          j.st.openedBy = 'tool'
          solveStructure(o)
          recomputeGroups(o)
          detachEvents(o, [j], 'tool')
          collapseCheck(o)
        }
        return j.st.progress
      }).value
    },
    workableJoints(objectId, tool) {
      const im = impls.get(objectId)
      if (im) {
        const spec = im.impl.describe()
        return im.impl.state().joints.filter((js) => {
          const j = (spec.joints ?? []).find((x) => (x.id ?? `${x.a}~${x.b}`) === js.id)
          return !js.open && !!j && (j.tools ?? JOINT_DEFAULTS[j.kind].tools).includes(tool)
        })
      }
      return getObj(objectId).joints.filter((j) => !j.st.open && j.spec.tools.includes(tool)).map((j) => j.st)
    },
    nearestJoint(objectId, point, maxDistance = 0.3, tool) {
      const im = impls.get(objectId)
      // Candidates: closed joints with their world position and whether `tool` can undo them.
      const cands: { st: JointState; d: number; ok: boolean }[] = []
      if (im) {
        const spec = im.impl.describe()
        for (const js of im.impl.state().joints) {
          if (js.open) continue
          const pos = implJointPos(im, js.a, js.b)
          const j = (spec.joints ?? []).find((x) => (x.id ?? `${x.a}~${x.b}`) === js.id)
          cands.push({ st: js, d: pos ? vec.distance(pos, point) : Infinity, ok: !!j && (j.tools ?? JOINT_DEFAULTS[j.kind].tools).includes(tool as ToolKind) })
        }
      } else {
        const o = getObj(objectId)
        for (const j of o.joints) {
          if (j.st.open) continue
          cands.push({ st: j.st, d: vec.distance(jointWorld(o, j), point), ok: tool ? j.spec.tools.includes(tool) : true })
        }
      }
      const pick = (only: boolean): JointState | null => {
        let best: JointState | null = null
        let bd = maxDistance
        for (const c of cands) {
          if (only && !c.ok) continue
          if (c.d <= bd) {
            bd = c.d
            best = c.st
          }
        }
        return best
      }
      return (tool ? pick(true) : null) ?? pick(false)
    },
    extinguish(objectId, partId, coolC = 200) {
      const im = impls.get(objectId)
      if (im) {
        run(() => im.impl.extinguish?.(partId))
        return
      }
      const o = getObj(objectId)
      run(() => {
        for (const p of partId ? [getPart(o, partId)] : o.parts) {
          if (isLost(p)) continue
          if (p.st.burning) {
            p.st.burning = false
            p.rt.jet = false
            emit({ ...base(o), type: 'extinguish', part: p.spec.id })
          }
          p.st.temperature = Math.max(ambient, p.st.temperature - coolC)
        }
        o.active = true
      })
    },
    setWind(next) {
      windOpts = { ...windOpts, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) }
      windCfg = resolveWind(windOpts)
      for (const o of objects.values()) {
        if (!o.hasStructure || o.spec.wind === false) continue
        o.wind ??= newWind(o)
        o.dirty = true
        o.active = true
      }
    },
    vent(objectId, partId, opening = {}) {
      if (impls.has(objectId)) return false
      const o = getObj(objectId)
      const p = getPart(o, partId)
      const c = p.spec.contains
      if (!c || isLost(p) || (p.st.liters ?? 0) <= 0) return false
      if (p.st.holes.some((h) => h.vent)) return true
      return run(() => {
        const wp = opening.point ?? partXf(o, p).c
        const wn = vec.normalize(opening.normal ?? [0, 1, 0])
        const hole: Hole = { point: objLocal(o, wp), normal: objLocalDir(o, wn), diameter: opening.diameter ?? VENT_DIAMETER, through: true, vent: true }
        p.st.holes.push(hole)
        if (p.st.holes.length > maxHoles) p.st.holes.shift()
        o.active = true
        emit({
          ...base(o), type: 'leak', part: partId, fluid: c.fluid, point: wp,
          direction: c.outflow ? vec.normalize(rotateVec(o.st.rotation, rotateVec(p.q, c.outflow))) : wn, rate: holeRate(hole, !!c.pressurized), pressurized: !!c.pressurized,
        })
        return true
      }).value
    },
    seal(objectId, partId) {
      if (impls.has(objectId)) return 0
      const o = getObj(objectId)
      const p = getPart(o, partId)
      const before = p.st.holes.length
      p.st.holes = p.st.holes.filter((h) => !h.vent)
      o.active = true
      return before - p.st.holes.length
    },
    setLiters(objectId, partId, liters) {
      if (impls.has(objectId)) return
      const p = getPart(getObj(objectId), partId)
      if (!p.spec.contains) return
      p.st.liters = clamp(liters, 0, p.spec.contains.liters)
      getObj(objectId).active = true
    },
    update(dt) {
      if (!(dt > 0)) return []
      return run(() => {
        time += dt
        const sources: Array<{ o: ObjRT; p: PartRT; flame: number }> = []
        for (const o of [...objects.values()]) if (o.active) stepObject(o, dt, sources)
        for (const o of [...objects.values()]) if (o.soil && objects.get(o.id) === o) stepSoil(o, dt)
        for (const o of [...objects.values()]) if (o.wind && objects.get(o.id) === o) stepWind(o, dt)
        if (sources.length) {
          spread(sources, dt)
          igniteLeaksNearFire(sources, dt)
        }
        detonatePrimed(time)
        releaseFront()
        for (const im of [...impls.values()]) {
          if (!im.impl.update) continue
          for (const e of im.impl.update(dt) ?? []) emit(e.time === undefined ? { ...e, time } : e)
        }
      }).events
    },
    state: (id) => objects.get(id)?.st ?? impls.get(id)?.impl.state() ?? null,
    snapshot: (id) => {
      const st = objects.get(id)?.st ?? impls.get(id)?.impl.state()
      return st ? clone(st) : null
    },
    part: (id, partId) => objects.get(id)?.byId.get(partId)?.st ?? impls.get(id)?.impl.state().parts.find((p) => p.id === partId) ?? null,
    reset(id) {
      const im = impls.get(id)
      if (im) {
        im.impl.reset?.()
        return
      }
      const o = getObj(id)
      objects.set(id, build(o.spec, id, o.base.pos, o.base.rot))
    },
    on(type: DestructionEventType | '*', fn) {
      let set = listeners.get(type)
      if (!set) listeners.set(type, (set = new Set()))
      set.add(fn)
      return () => {
        set!.delete(fn)
      }
    },
    serialize(): DestructionSnapshot {
      return {
        version: 1,
        time,
        rng: rng.state(),
        counter,
        objects: [...objects.values()].map((o) => {
          const runtime: ObjectRuntime = { parts: {}, joints: {}, collapsed: [...o.collapsed], ...(o.soil?.sets.size ? { soil: Object.fromEntries(o.soil.sets) } : {}), ...(o.wind ? { wind: [o.wind.dyn.x, o.wind.dyn.v, o.wind.dyn.y, o.wind.dyn.w, o.wind.dyn.peak] as [number, number, number, number, number] } : {}) }
          for (const p of o.parts) runtime.parts[p.spec.id] = clone(p.rt)
          for (const j of o.joints) runtime.joints[j.spec.id] = j.step
          return { id: o.id, spec: clone(o.spec), state: clone(o.st), runtime }
        }),
        ...(impls.size
          ? { impls: [...impls.values()].map((im) => ({ id: im.impl.id, position: [...im.position] as Vec3, rotation: [...im.rotation] as Quat, data: im.impl.serialize?.() })) }
          : {}),
      }
    },
    load(snap) {
      if (snap.version !== 1) throw new Error(`unsupported snapshot version ${String(snap.version)}`)
      objects.clear()
      time = snap.time
      rng.set(snap.rng)
      counter = snap.counter ?? 0
      for (const e of snap.objects) {
        const state = clone(e.state)
        const carry: Carry = {
          parts: new Map(
            state.parts.map((st) => [st.id, { st, rt: e.runtime?.parts[st.id] ? clone(e.runtime.parts[st.id]) : { ...freshRuntime(), prevTemp: st.temperature } }]),
          ),
          joints: new Map(state.joints.map((st) => [st.id, { st, step: e.runtime?.joints[st.id] ?? 0 }])),
          collapsed: e.runtime?.collapsed,
          ...(e.runtime?.wind ? { wind: e.runtime.wind } : {}),
        }
        let pos = state.position, rot = state.rotation
        if (state.soil) {
          // the saved pose has the settlement on top of the host's: take it off to get the host's back
          carry.soil = state.soil
          if (e.runtime?.soil) carry.soilSets = e.runtime.soil
          rot = quat.normalize(quat.mul(state.rotation, quat.conjugate(state.soil.offset.rotation)))
          pos = vec.sub(state.position, rotateVec(rot, state.soil.offset.position))
        }
        objects.set(e.id, build(clone(e.spec), e.id, pos, rot, carry))
      }
      for (const e of snap.impls ?? []) {
        const im = impls.get(e.id)
        if (!im) continue
        im.position = [e.position[0], e.position[1], e.position[2]]
        im.rotation = [e.rotation[0], e.rotation[1], e.rotation[2], e.rotation[3]]
        if (e.data !== undefined) im.impl.load?.(e.data)
      }
    },
  }
  return world
}
