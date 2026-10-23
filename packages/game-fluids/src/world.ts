import { LIQUIDS } from './liquids'
import { GROUND_ID, MAX_FLIGHT, ballistic, trace } from './landing'
import type { Hit, LandingSurface } from './landing'
import { describeEvent, resolveStrings } from './locale'
import { GRAVITY, Rng, add, clamp, copy3, cross, distance, dot, length, normalize, quatConjugate, quatRotate } from './math'
import { levelFor, lipOf, lipRadius, makeColumns, planeFraction, planeRange, shapeHeight } from './shapes'
import type { Columns } from './shapes'
import { addInflow, createStain, makeBasis, meanRadius, nudgeCenter, stepStain } from './stains'
import type { Basis, StainInt, StainSurface } from './stains'
import type {
  ContainerSpec,
  ContainerState,
  FluidEvent,
  FluidOptions,
  FluidWorld,
  LiquidDef,
  LiquidId,
  Quat,
  StainState,
  StreamCause,
  StreamState,
  SurfaceSpec,
  Vec3,
} from './types'

interface Hole {
  point: Vec3
  normal: Vec3
  diameter: number
}

interface ContainerInt {
  id: string
  spec: ContainerSpec
  cols: Columns
  liquid: LiquidId | null
  liters: number
  temperature: number
  closed: boolean
  position: Vec3
  rotation: Quat
  velocity: Vec3
  prevVelocity: Vec3
  hasPrev: boolean
  holes: Hole[]
  /** Slosh of the liquid surface: tilt offsets and their rates (x, z, vx, vz). */
  slosh: [number, number, number, number]
  /** Surface normal in world space (up plus slosh) and in container space, and the surface offset along it. */
  normal: Vec3
  u: Vec3
  d: number
  steaming: boolean
  outflow: number
  /** Stream key (`spill`, `pour`, `leak:<n>`) to stream id. */
  streams: Record<string, string>
  pourRate: number
  pourTTL: number
  pourVisual: boolean
  lastMix: number
}

interface StreamInt extends StreamState {
  key: string
  lastSplash: number
  visualOnly: boolean
  temperature: number
}

interface SurfaceInt extends SurfaceSpec, StainSurface {}

interface Snapshot {
  version: 1
  time: number
  rng: number
  counters: { container: number; stream: number; stain: number }
  containers: Array<Omit<ContainerInt, 'cols'>>
  surfaces: SurfaceSpec[]
  streams: StreamInt[]
  stains: StainInt[]
}

const GROUND_POROSITY = 0.2
const MAX_STEP = 0.1
const MAX_SUBSTEPS = 50
const MAX_HOLES = 32

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function createFluids(options: FluidOptions = {}): FluidWorld {
  const strings = resolveStrings(options.locale)
  const liquids = new Map<LiquidId, LiquidDef>()
  for (const def of LIQUIDS) liquids.set(def.id, def)
  for (const def of options.liquids ?? []) liquids.set(def.id, def)
  const ambientC = options.ambientC ?? 20
  const gravity = options.gravity ?? GRAVITY
  const groundAt = options.groundAt ?? (() => 0)
  const mergeDistance = options.mergeDistance ?? 0.15
  const maxStains = options.maxStains ?? 64

  let rng = new Rng(options.seed ?? 1)
  let time = 0
  const counters = { container: 0, stream: 0, stain: 0 }
  let containers = new Map<string, ContainerInt>()
  let surfaces = new Map<string, SurfaceInt>()
  let streams = new Map<string, StreamInt>()
  let stains = new Map<string, StainInt>()
  const listeners = new Map<string, Set<(e: FluidEvent) => void>>()
  let queue: FluidEvent[] = []

  const groundSurface: StainSurface = {
    normal: [0, 1, 0],
    t1: [1, 0, 0],
    t2: [0, 0, -1],
    point: [0, 0, 0],
    half: [Infinity, Infinity],
    porosity: GROUND_POROSITY,
  }

  // ---- events ----

  const emit = (e: FluidEvent): void => {
    queue.push(e)
    options.onEvent?.(e)
    listeners.get(e.type)?.forEach((fn) => fn(e))
    listeners.get('*')?.forEach((fn) => fn(e))
  }

  // ---- helpers ----

  const toWorld = (c: ContainerInt, p: Vec3): Vec3 => add(c.position, quatRotate(c.rotation, p))
  const defOf = (c: ContainerInt): LiquidDef | null => (c.liquid ? (liquids.get(c.liquid) ?? null) : null)
  const viscScale = (def: LiquidDef): number => 1 / Math.sqrt(Math.max(1, def.viscosity))

  const refreshLevel = (c: ContainerInt): void => {
    c.normal = normalize([c.slosh[0], 1, c.slosh[1]])
    c.u = normalize(quatRotate(quatConjugate(c.rotation), c.normal))
    c.d = levelFor(c.cols, c.u, c.spec.capacity > 0 ? c.liters / c.spec.capacity : 0)
  }

  const surfaceFor = (id: string): StainSurface => (id === GROUND_ID ? groundSurface : (surfaces.get(id) ?? groundSurface))

  const landingSurfaces = (): LandingSurface[] => {
    const list: LandingSurface[] = []
    for (const [id, s] of surfaces) list.push({ id, normal: s.normal, t1: s.t1, t2: s.t2, point: s.point, half: s.half })
    return list
  }

  const stopStream = (id: string): void => {
    const s = streams.get(id)
    if (!s) return
    streams.delete(id)
    const c = s.container ? containers.get(s.container) : undefined
    if (c) delete c.streams[s.key]
    emit({ type: 'stream_end', stream: id })
  }

  const endStreamKey = (c: ContainerInt, key: string): void => {
    const id = c.streams[key]
    if (id) stopStream(id)
  }

  /** Create or update the stream under `key` of a container; creating one emits the matching cause event. */
  const syncStream = (
    c: ContainerInt,
    key: string,
    cause: StreamCause,
    rate: number,
    origin: Vec3,
    velocity: Vec3,
    visualOnly = false,
  ): void => {
    if (rate < 1e-5 || !c.liquid) {
      endStreamKey(c, key)
      return
    }
    const existing = c.streams[key] ? streams.get(c.streams[key]) : undefined
    if (existing) {
      existing.rate = rate
      existing.origin = origin
      existing.velocity = velocity
      existing.thin = rate < 0.04
      existing.visualOnly = visualOnly
      existing.temperature = c.temperature
      return
    }
    const id = `stream_${++counters.stream}`
    const stream: StreamInt = {
      id,
      liquid: c.liquid,
      cause,
      container: c.id,
      origin,
      velocity,
      rate,
      landing: null,
      thin: rate < 0.04,
      flightTime: MAX_FLIGHT,
      key,
      lastSplash: -1,
      visualOnly,
      temperature: c.temperature,
    }
    streams.set(id, stream)
    c.streams[key] = id
    if (cause === 'leak') emit({ type: 'leak', container: c.id, liquid: c.liquid, rate, stream: id, point: copy3(origin) })
    else if (cause === 'spill') emit({ type: 'spill', container: c.id, liquid: c.liquid, rate, stream: id })
    else emit({ type: 'pour', container: c.id, liquid: c.liquid, rate, stream: id })
  }

  /** Where and how fast the liquid leaves over the lowest lip point. */
  const lipFlow = (c: ContainerInt, head: number): { origin: Vec3; velocity: Vec3 } => {
    const lip = lipOf(c.spec.shape, c.spec.opening, c.u)
    const origin = toWorld(c, lip.point)
    let dir: Vec3 = [1, 0, 0]
    const horizontal = (v: Vec3): Vec3 | null => (Math.hypot(v[0], v[2]) > 1e-3 ? normalize([v[0], 0, v[2]]) : null)
    if (lip.outward) dir = horizontal(quatRotate(c.rotation, lip.outward)) ?? horizontal(quatRotate(c.rotation, [1, 0, 0])) ?? dir
    else dir = horizontal(quatRotate(c.rotation, [1, 0, 0])) ?? dir
    const speed = clamp(0.3 + 0.5 * Math.sqrt(2 * gravity * Math.max(0, head)), 0.2, 2.5)
    return { origin, velocity: [dir[0] * speed, -0.1, dir[2] * speed] }
  }

  const removeLiters = (c: ContainerInt, amount: number): void => {
    c.liters = Math.max(0, c.liters - amount)
  }

  /** Clear a container that ran out and emit `empty` once. */
  const settle = (c: ContainerInt): void => {
    if (c.liquid && c.liters <= 1e-6) {
      c.liters = 0
      c.liquid = null
      emit({ type: 'empty', container: c.id })
    }
  }

  const fillInternal = (c: ContainerInt, liquid: LiquidId, liters: number, temperature: number | undefined, announce: boolean): number => {
    if (!(liters > 0) || !liquids.has(liquid)) return 0
    const room = c.spec.capacity - c.liters
    const accepted = Math.min(liters, Math.max(0, room))
    if (accepted <= 0) return 0
    const t = temperature ?? ambientC
    if (c.liquid && c.liquid !== liquid && c.liters > 1e-6) {
      const incomingWins = accepted > c.liters
      const into = incomingWins ? liquid : c.liquid
      const from = incomingWins ? c.liquid : liquid
      if (announce || time - c.lastMix > 0.5) {
        c.lastMix = time
        emit({ type: 'mix', container: c.id, from, into })
      }
      c.liquid = into
    } else if (!c.liquid || c.liters <= 1e-6) {
      c.liquid = liquid
    }
    c.temperature = c.liters > 1e-6 ? (c.temperature * c.liters + t * accepted) / (c.liters + accepted) : t
    c.liters += accepted
    if (announce) emit({ type: 'fill', container: c.id, liquid, liters: accepted })
    return accepted
  }

  // ---- stains ----

  const stainAt = (surfaceId: string, liquid: LiquidId, point: Vec3): StainInt | null => {
    let best: StainInt | null = null
    let bestD = Infinity
    for (const s of stains.values()) {
      if (s.surface !== surfaceId || s.liquid !== liquid) continue
      const d = distance(point, s.center)
      if (d < mergeDistance + 0.5 * meanRadius(s.front) && d < bestD) {
        best = s
        bestD = d
      }
    }
    return best
  }

  const evictStain = (): void => {
    let victim: StainInt | null = null
    for (const s of stains.values()) {
      const rank = (x: StainInt) => (x.wetness <= 0 ? 0 : 1) * 1e9 - x.age
      if (!victim || rank(s) < rank(victim)) victim = s
    }
    if (victim) stains.delete(victim.id)
  }

  const deposit = (liquid: LiquidId, hit: Pick<Hit, 'point' | 'surface' | 'normal'>, liters: number, velocity: Vec3 | null): void => {
    const def = liquids.get(liquid)
    if (!def || liters <= 0) return
    let s = stainAt(hit.surface, liquid, hit.point)
    if (s) {
      const basis: Basis = { normal: s.normal, t1: s.tangent, t2: cross(s.normal, s.tangent) }
      nudgeCenter(s, hit.point, clamp((liters / (s.liters + liters)) * 0.5, 0, 0.5), basis)
      addInflow(s, liters, velocity)
      return
    }
    while (stains.size >= maxStains) evictStain()
    const surface = surfaceFor(hit.surface)
    const basis: Basis = hit.surface === GROUND_ID ? makeBasis(hit.normal) : surface
    s = createStain(`stain_${++counters.stain}`, hit.surface, def, basis, hit.point, liters, rng)
    if (velocity) addInflow(s, 0, velocity)
    s.sinceInflow = 0
    stains.set(s.id, s)
    emit({ type: 'stain', stain: s.id, surface: hit.surface, liquid, point: copy3(hit.point) })
  }

  // ---- streams ----

  const lipCenterWorld = (c: ContainerInt): Vec3 => toWorld(c, [0, shapeHeight(c.spec.shape), 0])

  /** A container whose opening the jet passes through before it lands (pouring into a cup). */
  const catcher = (s: StreamInt, landingT: number): { container: ContainerInt; t: number; point: Vec3 } | null => {
    let best: { container: ContainerInt; t: number; point: Vec3 } | null = null
    for (const oc of containers.values()) {
      if (oc.id === s.container || oc.closed || oc.liters >= oc.spec.capacity) continue
      const lip = lipCenterWorld(oc)
      const disc = s.velocity[1] * s.velocity[1] - 2 * gravity * (lip[1] - s.origin[1])
      if (disc < 0) continue
      const t = (s.velocity[1] + Math.sqrt(disc)) / gravity
      if (t <= 0 || t >= landingT || (best && t >= best.t)) continue
      const p = ballistic(s.origin, s.velocity, gravity, t)
      if (Math.hypot(p[0] - lip[0], p[2] - lip[2]) <= lipRadius(oc.spec.shape, oc.spec.opening) + 0.01) best = { container: oc, t, point: p }
    }
    return best
  }

  const stepStream = (s: StreamInt, dt: number): void => {
    const hit = trace(landingSurfaces(), groundAt, s.origin, s.velocity, gravity)
    const caught = catcher(s, hit ? hit.t : MAX_FLIGHT)
    if (caught) {
      s.landing = caught.point
      s.flightTime = caught.t
      if (!s.visualOnly) fillInternal(caught.container, s.liquid, s.rate * dt, s.temperature, false)
      return
    }
    s.landing = hit ? copy3(hit.point) : null
    s.flightTime = hit ? hit.t : MAX_FLIGHT
    if (!hit || s.visualOnly) return
    const speed = length(hit.velocity)
    if (time - s.lastSplash >= 0.12) {
      s.lastSplash = time
      emit({ type: 'splash', liquid: s.liquid, point: copy3(hit.point), intensity: clamp(0.15 + s.rate * 1.2 + speed * 0.05, 0, 1) })
    }
    deposit(s.liquid, hit, s.rate * dt, hit.velocity)
  }

  // ---- containers ----

  const spillRate = (c: ContainerInt, def: LiquidDef, h: number): number => {
    const ro = lipRadius(c.spec.shape, c.spec.opening)
    const area = 2 * ro * Math.min(h, ro)
    return Math.max(0.6 * area * Math.sqrt(2 * gravity * h) * 1000 * viscScale(def), 0.004)
  }

  const steamThreshold = (def: LiquidDef): number => def.steamC ?? (def.drink && def.drink.thirst > 0 ? 60 : Infinity)

  const stepContainer = (c: ContainerInt, dt: number): void => {
    // Slosh: the surface tilts towards the horizontal acceleration and settles with a damped spring.
    if (c.hasPrev && dt > 0) {
      const ax = (c.velocity[0] - c.prevVelocity[0]) / dt
      const az = (c.velocity[2] - c.prevVelocity[2]) / dt
      const tx = clamp(ax / gravity, -0.35, 0.35)
      const tz = clamp(az / gravity, -0.35, 0.35)
      const w = 9
      const z = 0.12
      c.slosh[2] += (w * w * (tx - c.slosh[0]) - 2 * z * w * c.slosh[2]) * dt
      c.slosh[3] += (w * w * (tz - c.slosh[1]) - 2 * z * w * c.slosh[3]) * dt
    } else {
      c.slosh[2] *= 0.5
      c.slosh[3] *= 0.5
    }
    c.slosh[0] += c.slosh[2] * dt
    c.slosh[1] += c.slosh[3] * dt
    if (Math.abs(c.slosh[0]) + Math.abs(c.slosh[1]) + Math.abs(c.slosh[2]) + Math.abs(c.slosh[3]) < 1e-5) c.slosh = [0, 0, 0, 0]
    c.prevVelocity = copy3(c.velocity)
    c.hasPrev = true

    // Cooling towards ambient (insulated containers 10× slower).
    if (c.temperature !== ambientC) {
      const tau = (600 + 2400 * c.liters) * (c.spec.insulated ? 10 : 1)
      c.temperature = ambientC + (c.temperature - ambientC) * Math.exp(-dt / tau)
      if (Math.abs(c.temperature - ambientC) < 0.01) c.temperature = ambientC
    }

    refreshLevel(c)
    const def = defOf(c)

    const steaming = !!def && c.liters > 1e-6 && !c.closed && c.temperature > steamThreshold(def)
    if (steaming !== c.steaming) {
      c.steaming = steaming
      emit({ type: 'steam', container: c.id, on: steaming })
    }

    c.outflow = 0
    if (!def || c.liters <= 1e-6) {
      for (const key of Object.keys(c.streams)) endStreamKey(c, key)
      c.pourTTL = 0
      settle(c)
      return
    }

    // Pour (driven by `pour()`), else spill over the lip when the tilted surface rises above it.
    if (c.pourTTL > 0) {
      c.pourTTL -= dt
      if (c.pourTTL > 0) {
        const flow = lipFlow(c, 0.05)
        syncStream(c, 'pour', 'pour', c.pourRate, flow.origin, flow.velocity, c.pourVisual)
        c.outflow += c.pourRate
      } else endStreamKey(c, 'pour')
      endStreamKey(c, 'spill')
    } else {
      endStreamKey(c, 'pour')
      const lip = lipOf(c.spec.shape, c.spec.opening, c.u)
      const h = c.d - lip.level
      let handled = false
      if (!c.closed && h > 1e-5) {
        const excess = c.liters - c.spec.capacity * planeFraction(c.cols, c.u, lip.level)
        if (excess > 1e-6) {
          const rate = Math.min(spillRate(c, def, h), excess / Math.max(dt, 1e-6))
          removeLiters(c, Math.min(rate * dt, excess, c.liters))
          const flow = lipFlow(c, h)
          syncStream(c, 'spill', 'spill', rate, flow.origin, flow.velocity)
          c.outflow += rate
          handled = true
        }
      }
      if (!handled) endStreamKey(c, 'spill')
    }

    // Holes leak by Torricelli with the head above each hole.
    for (let i = 0; i < c.holes.length; i++) {
      const hole = c.holes[i]
      const key = `leak:${i}`
      const hh = dot(c.u, hole.point)
      const head = c.d - hh
      if (c.liters > 1e-6 && head > 1e-4) {
        const area = Math.PI * (hole.diameter / 2) ** 2
        const natural = 0.6 * area * Math.sqrt(2 * gravity * head) * 1000 * viscScale(def)
        const avail = c.liters - c.spec.capacity * planeFraction(c.cols, c.u, hh)
        if (avail > 1e-7) {
          const rate = Math.min(natural, avail / Math.max(dt, 1e-6))
          removeLiters(c, Math.min(rate * dt, avail))
          const nW = normalize(quatRotate(c.rotation, hole.normal))
          const v = Math.min(3, 0.6 * Math.sqrt(2 * gravity * head))
          syncStream(c, key, 'leak', rate, toWorld(c, hole.point), [nW[0] * v, nW[1] * v - 0.05, nW[2] * v])
          c.outflow += rate
          continue
        }
      }
      endStreamKey(c, key)
    }
    if (c.holes.length > 0 || c.outflow > 0) refreshLevel(c)
    settle(c)
  }

  const step = (dt: number): void => {
    time += dt
    for (const c of [...containers.values()]) stepContainer(c, dt)
    for (const s of [...streams.values()]) stepStream(s, dt)
    for (const st of [...stains.values()]) {
      const def = liquids.get(st.liquid)
      if (!def) continue
      const status = stepStain(st, def, surfaceFor(st.surface), ambientC, dt)
      if (status === 'dried_mark') emit({ type: 'dried', stain: st.id, mark: true })
      else if (status === 'dried_gone') {
        stains.delete(st.id)
        emit({ type: 'dried', stain: st.id, mark: false })
      }
    }
  }

  // ---- public state views ----

  const stateOf = (c: ContainerInt): ContainerState => ({
    id: c.id,
    liquid: c.liquid,
    liters: c.liters,
    capacity: c.spec.capacity,
    temperature: c.temperature,
    closed: c.closed,
    surfaceHeight: c.liters > 0 ? c.d : 0,
    surfacePoint: add(c.position, [0, c.liters > 0 ? c.d : 0, 0]),
    surfaceNormal: copy3(c.normal),
    holes: c.holes.map((h) => ({ point: copy3(h.point), normal: copy3(h.normal), diameter: h.diameter })),
    outflow: c.outflow,
    steaming: c.steaming,
    shape: c.spec.shape,
    lipRadius: lipRadius(c.spec.shape, c.spec.opening),
    position: copy3(c.position),
    rotation: [...c.rotation] as Quat,
  })

  const streamView = (s: StreamInt): StreamState => ({
    id: s.id,
    liquid: s.liquid,
    cause: s.cause,
    container: s.container,
    origin: copy3(s.origin),
    velocity: copy3(s.velocity),
    rate: s.rate,
    landing: s.landing ? copy3(s.landing) : null,
    thin: s.thin,
    flightTime: s.flightTime,
  })

  const stainView = (s: StainInt): StainState => ({
    id: s.id,
    surface: s.surface,
    liquid: s.liquid,
    center: copy3(s.center),
    front: [...s.front],
    liters: s.liters,
    soaked: s.soaked,
    wetness: s.wetness,
    wetRadius: s.wetRadius,
    normal: copy3(s.normal),
    tangent: copy3(s.tangent),
    flow: s.flow ? copy3(s.flow) : undefined,
    mark: s.mark,
    age: s.age,
  })

  // ---- world API ----

  const world: FluidWorld = {
    liquids,
    gravity,
    describe: (event) => describeEvent(strings, event),

    addContainer(spec, opts = {}) {
      const id = opts.id ?? `container_${++counters.container}`
      if (containers.has(id)) world.removeContainer(id)
      const liquid = spec.liquid && liquids.has(spec.liquid) ? spec.liquid : null
      const liters = liquid ? clamp(spec.liters ?? 0, 0, spec.capacity) : 0
      const c: ContainerInt = {
        id,
        spec: clone(spec),
        cols: makeColumns(spec.shape),
        liquid: liters > 0 ? liquid : null,
        liters,
        temperature: spec.temperature ?? ambientC,
        closed: spec.closed ?? spec.opening <= 0,
        position: copy3(opts.position ?? [0, 0, 0]),
        rotation: opts.rotation ? ([...opts.rotation] as Quat) : [0, 0, 0, 1],
        velocity: [0, 0, 0],
        prevVelocity: [0, 0, 0],
        hasPrev: false,
        holes: [],
        slosh: [0, 0, 0, 0],
        normal: [0, 1, 0],
        u: [0, 1, 0],
        d: 0,
        steaming: false,
        outflow: 0,
        streams: {},
        pourRate: 0,
        pourTTL: 0,
        pourVisual: false,
        lastMix: -10,
      }
      containers.set(id, c)
      refreshLevel(c)
      return id
    },

    removeContainer(id) {
      const c = containers.get(id)
      if (!c) return
      for (const key of Object.keys(c.streams)) endStreamKey(c, key)
      containers.delete(id)
    },

    setTransform(id, position, rotation, velocity) {
      const c = containers.get(id)
      if (!c) return
      c.position = copy3(position)
      c.rotation = [...rotation] as Quat
      if (velocity) c.velocity = copy3(velocity)
      refreshLevel(c)
    },

    open(id) {
      const c = containers.get(id)
      if (c) c.closed = false
    },

    close(id) {
      const c = containers.get(id)
      if (!c) return
      c.closed = true
      for (const key of ['pour', 'spill']) endStreamKey(c, key)
      c.pourTTL = 0
    },

    fill(id, liquid, liters, temperature) {
      const c = containers.get(id)
      if (!c || c.closed) return 0
      const accepted = fillInternal(c, liquid, liters, temperature, true)
      refreshLevel(c)
      return accepted
    },

    pour(id, dt, into) {
      const c = containers.get(id)
      const def = c ? defOf(c) : null
      if (!c || !def || c.closed || c.liters <= 1e-6 || !(dt > 0)) return 0
      refreshLevel(c)
      const lip = lipOf(c.spec.shape, c.spec.opening, c.u)
      const depth = Math.max(0, c.d - planeRange(c.cols, c.u)[0])
      const head = Math.max(c.d - lip.level, 0.02 + 0.5 * depth)
      const ro = lipRadius(c.spec.shape, c.spec.opening)
      const natural = 0.6 * Math.PI * ro * ro * Math.sqrt(2 * gravity * head) * 1000
      const rate = Math.min(natural, 0.15 + 12 * ro) * viscScale(def)
      const out = Math.min(rate * dt, c.liters)
      const target = into ? containers.get(into) : undefined
      let delivered = out
      if (target) {
        delivered = fillInternal(target, c.liquid as LiquidId, out, c.temperature, false)
        refreshLevel(target)
        const overflow = out - delivered
        if (overflow > 1e-6) {
          const flow = lipFlow(c, head)
          const hit = trace(landingSurfaces(), groundAt, flow.origin, flow.velocity, gravity)
          if (hit) deposit(c.liquid as LiquidId, hit, overflow, hit.velocity)
        }
      }
      removeLiters(c, out)
      c.pourRate = out / dt
      c.pourTTL = Math.max(0.12, dt * 1.5)
      c.pourVisual = !!target
      const flow = lipFlow(c, head)
      syncStream(c, 'pour', 'pour', c.pourRate, flow.origin, flow.velocity, c.pourVisual)
      refreshLevel(c)
      settle(c)
      return out
    },

    drink(id, liters) {
      const c = containers.get(id)
      const def = c ? defOf(c) : null
      if (!c || !def || c.closed || c.liters <= 1e-6 || !(liters > 0)) return null
      const amount = Math.min(liters, c.liters)
      removeLiters(c, amount)
      const event: Extract<FluidEvent, { type: 'drink' }> = {
        type: 'drink',
        container: c.id,
        liquid: def.id,
        liters: amount,
        temperature: c.temperature,
        thirst: (def.drink?.thirst ?? 0) * amount,
        effects: [...(def.drink?.effects ?? [])],
        burn: c.temperature > 65,
      }
      emit(event)
      refreshLevel(c)
      settle(c)
      return event
    },

    puncture(id, point, normal, diameter) {
      const c = containers.get(id)
      if (!c || !(diameter > 0) || c.holes.length >= MAX_HOLES) return
      c.holes.push({ point: copy3(point), normal: normalize(normal), diameter })
    },

    heat(id, deltaC) {
      const c = containers.get(id)
      if (c) c.temperature = clamp(c.temperature + deltaC, -50, 1000)
    },

    addSurface(spec) {
      const basis = makeBasis(spec.normal, spec.tangent)
      surfaces.set(spec.id, {
        ...clone(spec),
        ...basis,
        point: copy3(spec.point),
        half: [spec.halfSize[0], spec.halfSize[1]],
      })
    },

    removeSurface(id) {
      surfaces.delete(id)
      for (const s of [...stains.values()]) if (s.surface === id) stains.delete(s.id)
    },

    splash(liquid, point, liters, velocity) {
      if (!liquids.has(liquid) || !(liters > 0)) return
      const v: Vec3 = velocity ?? [0, -0.1, 0]
      const origin = add(point, [0, 0.02, 0])
      const hit = trace(landingSurfaces(), groundAt, origin, v, gravity)
      if (!hit) return
      emit({ type: 'splash', liquid, point: copy3(hit.point), intensity: clamp(0.3 + liters * 2, 0, 1) })
      deposit(liquid, hit, liters, length(v) > 0.3 ? hit.velocity : null)
    },

    clearStains(point, radius) {
      for (const s of [...stains.values()]) {
        if (distance(point, s.center) <= radius + 0.5 * meanRadius(s.front)) {
          stains.delete(s.id)
          emit({ type: 'dried', stain: s.id, mark: false })
        }
      }
    },

    update(dt) {
      if (dt > 0) {
        const n = clamp(Math.ceil(dt / MAX_STEP), 1, MAX_SUBSTEPS)
        for (let i = 0; i < n; i++) step(dt / n)
      }
      const out = queue
      queue = []
      return out
    },

    container: (id) => {
      const c = containers.get(id)
      return c ? stateOf(c) : null
    },
    containers: () => [...containers.values()].map(stateOf),
    streams: () => [...streams.values()].map(streamView),
    stains: () => [...stains.values()].map(stainView),

    on(type, fn) {
      let set = listeners.get(type)
      if (!set) listeners.set(type, (set = new Set()))
      set.add(fn)
      return () => {
        set?.delete(fn)
      }
    },

    serialize() {
      const snapshot: Snapshot = {
        version: 1,
        time,
        rng: rng.state,
        counters: { ...counters },
        containers: [...containers.values()].map((c) => {
          const { cols: _cols, ...rest } = c
          return clone(rest)
        }),
        surfaces: [...surfaces.values()].map((s) => clone({ id: s.id, point: s.point, normal: s.normal, halfSize: s.half, tangent: s.t1, porosity: s.porosity })),
        streams: [...streams.values()].map((s) => clone(s)),
        stains: [...stains.values()].map((s) => clone(s)),
      }
      return snapshot
    },

    load(input) {
      const snap = clone(input) as Snapshot
      if (!snap || snap.version !== 1) throw new Error('game-fluids: unsupported snapshot')
      time = snap.time
      rng = new Rng(0)
      rng.state = snap.rng
      counters.container = snap.counters.container
      counters.stream = snap.counters.stream
      counters.stain = snap.counters.stain
      containers = new Map()
      for (const raw of snap.containers) containers.set(raw.id, { ...raw, cols: makeColumns(raw.spec.shape) })
      surfaces = new Map()
      for (const s of snap.surfaces) world.addSurface(s)
      streams = new Map(snap.streams.map((s) => [s.id, s]))
      stains = new Map(snap.stains.map((s) => [s.id, s]))
      queue = []
    },
  }

  return world
}
