import { chainDelayOf, drawChainDelay, FIRE_PRIME_C, shotDamageFractionOf } from './chain'
import type { ChainTrigger } from './chain'
import { planFragments } from './fracture'
import type { PlannedFragment } from './fracture'
import { cellsOutside, cellsWithin, marksInBox, planeAxes, unitGrid } from './breach'
import type { LocalHole, UnitCell } from './breach'
import { layersEnergy, layersThickness, MAX_SPALLS, outerLayer, resolveLayer, thinAxisOf } from './layers'
import type { LayerRT } from './layers'
import { clipBarsToDisc, rebarBars, rebarMass } from './rebar'
import { JOINT_DEFAULTS, inferJoints, MATERIALS, partCapacity, partMass, partThickness, partVolume, fragility } from './materials'
import { aabbOf, createRng, distanceToShape, quat, quatFromEuler, rayShape, rotateVec, shapeArea, shapeBound, shapeDims, surfacePoint, toLocal, toWorld, vec } from './math'
import type { DestructibleImpl } from './contracts'
import type {
  AddOptions, Crack, DamageType, DebrisKind, DestructibleSpec, Dent, DestructionEvent, DestructionEventType, DestructionOptions, DestructionSnapshot,
  DamageStage, DestructionWorld, Fragment, Hit, HitResult, Hole, JointSpec, JointState, MaterialDef, MaterialId, ObjectRuntime, ObjectState, PartRuntime, PartSpec,
  PartState, Quat, RayHit, ToolKind, Vec3,
  BlastOptions, BlastReport, ConfinementOptions, FragmentHitOptions, ShelterOptions,
  BallisticExtras,
} from './types'

/** Hit points removed per joule (before the material's `damageScale`). */
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
/** Staged parts: default breach radius (m), blast multiplier on the breach area, area a part must lose to open (m²), and the share of capacity the bare cage keeps. */
const BREACH_RADIUS = 0.55
const BREACH_BLAST_FACTOR = 6
const BREACH_AREA = 0.25
/** Metres of reach per cube root of kilojoule for a blast to open a breach. */
const BREACH_BLAST_REACH = 0.12
const RESIDUAL_CAPACITY = 0.15
/** Unit-sized fragments of a whole wall: at most this many times `maxFragments`. A breach picks its units from a grid of up to `BREACH_GRID_CAP`. */
const UNIT_FRAGMENT_FACTOR = 4
const BREACH_GRID_CAP = 4096

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
  /** The part has layers, units, reinforcement or a breach: it goes through damage stages. */
  staged: boolean
  /** Axis the part is thinnest along (the wall's depth). */
  thin: number
  layers: LayerRT[]
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
  dirty: boolean
  maxStress: number
  collapsed: Set<string>
  /** Structural parts with no support path to an anchored part (they fall). */
  unsup: boolean[]
  anyAnchor: boolean
  /** Creation order of the object in this world: breaks ties between parts that go off at the same time. */
  order: number
}

interface Carry {
  parts: Map<string, { st: PartState; rt: PartRuntime }>
  joints: Map<string, { st: JointState; step: number }>
  collapsed?: string[]
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
  const breachBlastFactor = options.breach?.blastFactor ?? BREACH_BLAST_FACTOR
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
    for (let blast = blasts.shift(); blast; blast = blasts.shift()) blastWorld(blast.point, blast.energy, blast.radius, blast.source)
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
        structural: !!ps.structure && ps.structure.role !== 'none', anchored: !!ps.anchored || ps.structure?.role === 'foundation', cap: ps.structure ? partCapacity(ps, mat) : 0,
        staged, thin: thinAxisOf(shapeDims(ps.shape)), layers,
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
    solveStructure(o)
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

  /** Which part `r` rests on over joint `j` (index), or -1 when the joint does not let `r` rest on its other end. */
  const restsOn = (j: JointRT, r: number): number => {
    const b = j.bears
    if (!b) return -1
    if (b === true) return j.ia === r ? j.ib : j.ia
    if (b === 'a_on_b') return j.ia === r ? j.ib : -1
    return j.ib === r ? j.ia : -1
  }

  /** Distribute own mass plus carried load down the bearing graph to the anchored parts; mark parts without any support path. */
  const solveStructure = (o: ObjRT) => {
    o.maxStress = 0
    if (!o.hasStructure) return
    const parts = o.parts
    const n = parts.length
    const dist = new Array<number>(n).fill(-1)
    const queue: number[] = []
    const ok = (i: number) => parts[i].structural && !isLost(parts[i])
    const isPartition = (i: number) => parts[i].spec.structure?.role === 'partition'
    for (let i = 0; i < n; i++) if (ok(i) && parts[i].anchored) {
      dist[i] = 0
      queue.push(i)
    }
    for (let h = 0; h < queue.length; h++) {
      const s = queue[h]
      if (isPartition(s)) continue
      for (const j of o.byPart.get(parts[s].spec.id)!) {
        if (j.st.open || !j.bears) continue
        const r = j.ia === s ? j.ib : j.ia
        if (dist[r] >= 0 || !ok(r) || restsOn(j, r) !== s) continue
        dist[r] = dist[s] + 1
        queue.push(r)
      }
    }
    const incoming = new Array<number>(n).fill(0)
    for (let h = queue.length - 1; h >= 0; h--) {
      const i = queue[h]
      const total = parts[i].st.mass + incoming[i]
      parts[i].st.load = total
      const lower: number[] = []
      for (const j of o.byPart.get(parts[i].spec.id)!) {
        if (j.st.open || !j.bears) continue
        const k = restsOn(j, i)
        if (k >= 0 && dist[k] >= 0 && dist[k] < dist[i] && !isPartition(k)) lower.push(k)
      }
      for (const k of lower) incoming[k] += total / lower.length
    }
    for (let i = 0; i < n; i++) {
      const p = parts[i]
      o.unsup[i] = false
      if (!p.structural) continue
      if (dist[i] < 0 || isLost(p)) {
        p.st.load = p.st.mass
        p.st.stress = 0
        o.unsup[i] = o.anyAnchor && !isLost(p)
        continue
      }
      p.st.stress = (p.st.load! * structureSafety) / (p.cap * capacityScale(p))
      if (p.st.stress > o.maxStress) o.maxStress = p.st.stress
    }
    if (o.maxStress > 0.8) o.active = true
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
      // the rebar of a reinforced part is its cage: blows do not wear it, only a torch or a saw cuts it (or the cage itself giving way)
      if (j.spec.kind === 'rebar' && (o.parts[j.ia].spec.reinforcement || o.parts[j.ib].spec.reinforcement)) continue
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
    const cells = cellsWithin(unitGrid(p.dims, p.thin, unitsOf(p), BREACH_GRID_CAP), p.thin, lc, radius)
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

  /** Part hit points reached 0 (or it was forced to explode): fragments, debris, joints open. */
  const failPart = (o: ObjRT, p: PartRT, origin: Vec3 | null, dir: Vec3 | null, fragEnergy: number, cap: number, src?: string) => {
    if (isLost(p)) return
    if (p.st.stripped) {
      loseCage(o, p, src)
      return
    }
    const ex = p.spec.explodes
    const style = p.mat.fracture === 'none' ? 'snap' : p.mat.fracture
    const { c, q } = partXf(o, p)
    const hitW = origin ?? c
    const grain = p.spec.grain ? AXIS[p.spec.grain] : undefined
    const hitLocal = toLocal(c, q, hitW)
    const unitPlan = p.spec.units ? unitFragmentPlan(p, maxFragments * UNIT_FRAGMENT_FACTOR) : []
    const plan = unitPlan.length > 0 ? unitPlan : planFragments({
      style, dims: p.dims, thickness: p.thickness, grain, hit: hitLocal, fragmentSize: p.mat.fragmentSize ?? [0.04, 0.2], maxFragments, rnd,
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
        mass: (mass * f.weight) / totW, ...(marks.length > 0 ? { marks } : {}),
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
      emit({ ...base(o, src), type: 'explode', part: p.spec.id, point: c, energy: ex.energy, radius: ex.radius, ...(ex.effect !== undefined ? { effect: ex.effect } : {}) })
      blasts.push({ point: c, energy: ex.energy, radius: ex.radius, source: src })
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
  const applyDamage = (o: ObjRT, p: PartRT, amount: number, type: DamageType, origin: Vec3 | null, dir: Vec3 | null, fragEnergy: number, cap: number, src?: string): number => {
    if (isLost(p) || amount <= 0) return 0
    const prev = p.st.hp
    p.st.hp -= amount
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

  interface BallisticOut { penetrated: boolean; exitEnergy: number; exitPoint?: Vec3; damage: number }

  const ballistic = (o: ObjRT, p: PartRT, entry: Vec3, n: Vec3, d: Vec3, E: number, caliber: number, pathLen: number, src?: string, round: BallisticExtras = {}): BallisticOut => {
    const mat = p.mat
    const piercing = round.piercing ?? 1
    // a bare cage and an opening do not stop a bullet
    if (p.st.stripped || (p.st.opening && insideOpening(o, p, objLocal(o, entry)))) {
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
      exitPoint = vec.madd(entry, d, Math.min(pathLen, effM + layersThickness(p.layers, face) / slant + layersThickness(p.layers, -face) / slant))
      const hole = addHole(o, p, entry, n, (caliber / 1000) * (mat.ductility >= 0.3 ? 1 : 1.5), true, exitPoint, src)
      if (p.layers.length > 0) spallOuter(o, p, exitPoint, -face, vec.scale(n, -1), Math.max(0.03, (caliber / 1000) * 4), src)
      addBreach(o, p, entry, Math.PI * (hole.diameter / 2) * (hole.diameter / 2), E, d, src)
      if (brittle && mat.fracture === 'shatter') addCrack(o, p, entry, n, crackLen, src)
      if (p.spec.contains && (p.st.liters ?? 0) > 0) {
        emit({
          ...base(o, src), type: 'leak', part: id, fluid: p.spec.contains.fluid, point: entry, direction: n, rate: holeRate(hole, !!p.spec.contains.pressurized),
          pressurized: !!p.spec.contains.pressurized,
        })
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
    if (kind === 'blunt') wearJoints(o, p, E * 0.3, undefined, 0, src)
    else wearJoints(o, p, E * 0.3, point, 0.06, src)
    if (kind === 'blunt' && E > 0 && p.layers.length > 0) spallOuter(o, p, point, faceOf(o, p, n), n, Math.max(contactR, 0.05), src)
    const scale = mat.damageScale?.[kind] ?? 1
    const done = applyDamage(o, p, Ec * DMG_PER_J * scale * (kind === 'slash' ? p.cutFactor : 1), kind, point, d, E * 0.1, 12, src)
    addBreach(o, p, point, breachAreaOf(p, done, false), E, d, src)
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
  const blastPlain = (point: Vec3, energy: number, radius: number, src?: string): HitResult[] => {
    const out: HitResult[] = []
    for (const o of [...objects.values()]) {
      if (vec.distance(toWorld(o.st.position, o.st.rotation, o.bc), point) - o.br >= radius) continue
      const r = blastObject(o, point, energy, radius, src)
      if (r.part) out.push(r)
    }
    for (const im of [...impls.values()]) {
      if (implInRange(im, point, radius)) out.push(implHit(im, { type: 'explosive', point, energy, radius, ...(src !== undefined ? { source: src } : {}) }))
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
  const blastScene = (point: Vec3, energy: number, radius: number, src: string | undefined, cfg: BlastCfg, only?: ObjRT | ImplRT): HitResult[] => {
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
        const res = implHit(im, { type: 'explosive', point, energy: E * k, radius, ...(shelter ? { shelter: k } : {}), ...(src !== undefined ? { source: src } : {}) })
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

  const blastWorld = (point: Vec3, energy: number, radius: number, src?: string, call?: BlastOptions, only?: ObjRT | ImplRT): HitResult[] => {
    const cfg = blastCfg(call)
    if (!cfg.shelter && !cfg.frag && cfg.conf === null) return blastPlain(point, energy, radius, src)
    return blastScene(point, energy, radius, src, cfg, only)
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
          if (FLAMMABLE_FLUIDS.includes(cont.fluid) && s.temperature >= 350 && !p.rt.jet) {
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
      o.st.position = [position[0], position[1], position[2]]
      o.st.rotation = [rotation[0], rotation[1], rotation[2], rotation[3]]
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
        return clone(s)
      }
      const inNew = (pid: string) => moved.has(pid)
      const inOld = (pid: string) => !moved.has(pid)
      const pos = o.st.position, rot = o.st.rotation
      const fresh = build(sub(inNew), nid, pos, rot, carryFor(inNew, (a, b) => inNew(a) && inNew(b)))
      const rest = build(sub(inOld), id, pos, rot, carryFor(inOld, (a, b) => !(inNew(a) && inNew(b))))
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
        if (sources.length) spread(sources, dt)
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
      objects.set(id, build(o.spec, id, o.st.position, o.st.rotation))
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
          const runtime: ObjectRuntime = { parts: {}, joints: {}, collapsed: [...o.collapsed] }
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
        }
        objects.set(e.id, build(clone(e.spec), e.id, state.position, state.rotation, carry))
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
