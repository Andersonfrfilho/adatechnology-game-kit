import type {
  Agent,
  Compartment,
  Infection,
  InfectionConfig,
  InfectionEvent,
  InfectionEventMap,
  InfectionParams,
  MovePopulationEvent,
  RegionDef,
  RegionView,
  ReleaseActiveEvent,
  SeedEvent,
  Stage,
  WarnEvent,
} from './types'

export const STAGES: readonly Stage[] = ['calm', 'cases', 'panic', 'fallen', 'overrun']
export const version = '0.1.0'

export const DEFAULT_PARAMS: InfectionParams = {
  transmission: 0.7,
  containedTransmission: 0.03,
  invasionTransmission: 0.004,
  shelteredFloor: 0.015,
  curiosity: 1.2,
  night: 0.6,
  nightHours: [20, 6],
  containedEscape: 0.004,
  hideFractionMax: 0.6,
  hideFractionPerAwareness: 0.7,
  seenPerActive: 0.02,
  seenScale: 0.004,
  awarenessGain: 0.03,
  fleeCarry: 0.5,
  fleeIncubatingMult: 20,
  fleeMax: 0.05,
  fleePressure: 2,
  thresholdCases: 1,
  thresholdPanic: 0.005,
  thresholdFallen: 0.15,
  thresholdOverrun: 0.1,
}

interface Region {
  def: RegionDef
  id: string
  pop: number
  free: number
  sheltered: number
  queue: Float64Array
  active: number
  contained: number
  departed: number
  removed: number
  awareness: number
  seen: number
  guard: number
  stage: number
}

type FiredEvent = InfectionEvent & { done: boolean }

/**
 * Creates a model. Deterministic: the same configuration and the same calls always give the same result.
 * The game supplies regions, links, phases and events as data; the model only emits `phase`, `stage` and `event`.
 */
export function create(cfg: InfectionConfig): Infection {
  const P: InfectionParams = Object.assign({}, DEFAULT_PARAMS, cfg.params || {})
  const N = cfg.incubationHours || 48
  const R: Region[] = cfg.regions.map((r) => ({
    def: r,
    id: r.id,
    pop: r.pop,
    free: r.pop,
    sheltered: 0,
    queue: new Float64Array(N),
    active: 0,
    contained: 0,
    departed: 0,
    removed: 0,
    awareness: 0,
    seen: 0,
    guard: 1,
    stage: 0,
  }))
  const index: Record<string, number> = Object.create(null)
  R.forEach((r, i) => {
    index[r.id] = i
  })
  const reg = (id: string): Region => {
    const i = index[id]
    if (i === undefined) throw new Error('Infection: unknown region ' + id)
    return R[i]
  }
  const phases = cfg.phases
  const links = cfg.links || []
  const events: FiredEvent[] = (cfg.events || []).map((e) => Object.assign({ done: false }, e) as FiredEvent).sort((a, b) => a.hour - b.hour)
  const listeners: Record<string, Array<(data: never) => void>> = Object.create(null)
  const st = { hour: cfg.startHour || 0, phase: 0, phaseSince: cfg.startHour || 0 }
  let rs = (cfg.seed! >>> 0) || 1
  // mulberry32
  const rnd = () => {
    rs = (rs + 0x6d2b79f5) | 0
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function emit<K extends keyof InfectionEventMap>(name: K, data: InfectionEventMap[K]) {
    const l = listeners[name]
    if (l) for (const f of l) (f as (d: InfectionEventMap[K]) => void)(data)
  }
  const queueSum = (r: Region) => {
    let s = 0
    for (let k = 0; k < N; k++) s += r.queue[k]
    return s
  }
  const moveQueue = (a: Region, b: Region, frac: number) => {
    for (let k = 0; k < N; k++) {
      const m = a.queue[k] * frac
      a.queue[k] -= m
      b.queue[k] += m
    }
  }

  const ACTIONS = {
    seed(e: SeedEvent) {
      reg(e.region).queue[e.queuePosition || 0] += e.n
    },
    move_population(e: MovePopulationEvent) {
      const b = reg(e.to)
      for (const id of e.from) {
        const a = reg(id)
        const m = a.free * e.fraction
        a.free -= m
        b.free += m
        if (e.carryIncubating) moveQueue(a, b, e.fraction)
      }
    },
    release_active(e: ReleaseActiveEvent) {
      const a = reg(e.from)
      const z = a.active * e.fraction
      a.active -= z
      reg(e.to).active += z
    },
    warn(e: Pick<WarnEvent, 'region' | 'level' | 'guard'>) {
      const r = reg(e.region)
      r.awareness = Math.max(r.awareness, e.level)
      if (e.guard !== undefined) r.guard = e.guard
    },
  }

  function step() {
    const F = phases[st.phase]
    const hourOfDay = ((st.hour % 24) + 24) % 24
    const night = hourOfDay >= P.nightHours[0] || hourOfDay < P.nightHours[1]
    for (const e of events) {
      if (e.done || st.hour < e.hour) continue
      e.done = true
      ;(ACTIONS[e.action] as (e: InfectionEvent) => void)(e)
      emit('event', { id: e.id, hour: st.hour })
    }
    for (const r of R) {
      const d = r.def
      const inc = queueSum(r)
      r.seen += r.active * P.seenPerActive
      r.awareness = Math.min(
        1,
        Math.max(r.awareness, F.awareness) + (1 - Math.exp(-r.seen / (r.pop * P.seenScale))) * P.awarenessGain * (1 - r.awareness),
      )
      const beta =
        P.transmission * (d.density || 1) * (1 + (1 - r.awareness) * P.curiosity) * (night ? P.night : 1) * (d.transmissionMult || 1)
      const present = r.free + inc + r.active + 1
      const fresh = Math.min(r.free, (beta * r.active * r.free) / present)
      const exposed = Math.max(0, r.sheltered - r.pop * P.shelteredFloor)
      const freshSheltered = Math.min(
        exposed,
        (P.containedTransmission * r.contained * exposed) / (r.sheltered + r.contained + 1) +
          (P.invasionTransmission * r.active * exposed) / (present + r.sheltered),
      )
      r.free -= fresh
      r.sheltered -= freshSheltered
      const turns = r.queue[N - 1]
      for (let k = N - 1; k > 0; k--) r.queue[k] = r.queue[k - 1]
      r.queue[0] = fresh + freshSheltered
      const hide = Math.min(P.hideFractionMax, r.awareness * P.hideFractionPerAwareness)
      r.contained += turns * hide
      r.active += turns * (1 - hide)
      const cull = Math.min(r.active, F.cullFixed * (d.police || 0) + r.active * F.cullFraction)
      r.active -= cull
      r.removed += cull
      const shelter = r.free * F.shelter * r.awareness
      r.free -= shelter
      r.sheltered += shelter
      const escape = r.contained * P.containedEscape
      r.contained -= escape
      r.active += escape
    }
    for (const L of links) {
      if (st.phase < (L.fromPhase || 0)) continue
      const a = reg(L.a)
      const b = reg(L.b)
      const g = b.guard
      if (L.flow) {
        const pressure = a.active / (a.free + a.sheltered + a.active + 1)
        const f = Math.min(a.free * P.fleeMax, a.free * L.flow * (F.flee * a.awareness + pressure * P.fleePressure)) * g
        a.free -= f
        b.free += f
        const carry = (f / (a.free + f + 1)) * P.fleeCarry * g
        for (let k = 0; k < N; k++) {
          const m = a.queue[k] * carry * L.flow * P.fleeIncubatingMult
          a.queue[k] -= m
          b.queue[k] += m
        }
      }
      if (L.active) {
        const z = a.active * L.active * g
        a.active -= z
        b.active += z
      }
    }
    for (const r of R) {
      if (r.def.exit) {
        const o = r.free * F.exit * r.def.exit
        r.free -= o
        r.departed += o
      }
    }
    if (cfg.focus) {
      const H = reg(cfg.focus)
      for (const r of R) {
        if (r === H || !r.def.urban) continue
        for (let k = 2; k < N; k++) {
          const m = r.queue[k] * F.focusTransfer
          r.queue[k] -= m
          H.queue[k] += m
        }
      }
    }
    st.hour++
    // phase: enters when the day is inside the window and the threshold is reached, or when the window ends
    const day = st.hour / 24
    const total = R.reduce((s, r) => s + r.active + r.contained, 0)
    while (st.phase + 1 < phases.length) {
      const n = phases[st.phase + 1]
      if (day >= n.dayMax || (day >= n.dayMin && total >= n.threshold)) {
        st.phase++
        st.phaseSince = st.hour
        emit('phase', { id: n.id, hour: st.hour, total })
      } else break
    }
    for (const r of R) {
      const e = stageOf(r)
      if (e !== r.stage) {
        const from = r.stage
        r.stage = e
        emit('stage', { region: r.id, from: STAGES[from], to: STAGES[e], hour: st.hour })
      }
    }
  }
  function stageOf(r: Region): number {
    const z = r.active + r.contained
    const alive = r.free + r.sheltered + queueSum(r)
    if (alive < r.pop * P.thresholdOverrun && z > 0) return 4
    if (z > r.pop * P.thresholdFallen) return 3
    if (z > r.pop * P.thresholdPanic || r.awareness > 0.5) return 2
    if (z >= P.thresholdCases || queueSum(r) >= P.thresholdCases) return Math.max(r.stage, 1)
    return r.stage
  }
  function view(r: Region): RegionView {
    return {
      id: r.id,
      pop: r.pop,
      free: r.free,
      sheltered: r.sheltered,
      incubating: queueSum(r),
      active: r.active,
      contained: r.contained,
      departed: r.departed,
      removed: r.removed,
      awareness: r.awareness,
      stage: STAGES[r.stage],
    }
  }

  const model: Infection = {
    advance(hours = 1) {
      for (let h = 0; h < hours; h++) step()
      return model
    },
    hour: () => st.hour,
    day: () => Math.floor(st.hour / 24),
    phase: () => ({
      id: phases[st.phase].id,
      index: st.phase,
      since: st.phaseSince,
      next: phases[st.phase + 1] ? phases[st.phase + 1].id : null,
    }),
    region: (id) => view(reg(id)),
    regions: () => R.map(view),
    total(field: Compartment) {
      return R.reduce((s, r) => s + (field === 'incubating' ? queueSum(r) : r[field]), 0)
    },
    // a real bite seen in the game enters the incubation queue (position = hours already elapsed since the bite)
    infect(region, n = 1, hoursElapsed = 0) {
      const r = reg(region)
      const m = Math.min(n, r.free)
      r.free -= m
      r.queue[Math.min(N - 1, hoursElapsed)] += m
    },
    remove(region, n = 1) {
      const r = reg(region)
      const m = Math.min(n, r.active)
      r.active -= m
      r.removed += m
    },
    warn(region, level, guard) {
      ACTIONS.warn({ region, level, guard })
    },
    // seeds to materialise agents near the player; the game gives them back with giveBack() when they leave relevance
    materialize(region, n) {
      const r = reg(region)
      const tot = r.active + r.contained
      const k = Math.min(n, Math.floor(tot))
      const out: Agent[] = []
      for (let i = 0; i < k; i++) {
        const contained = rnd() * tot < r.contained
        if (contained) r.contained--
        else r.active--
        out.push({ state: contained ? 'contained' : 'active', seed: (rnd() * 4294967296) >>> 0 })
      }
      return out
    },
    giveBack(region, batch) {
      const r = reg(region)
      for (const a of batch) {
        if (a.state === 'contained') r.contained++
        else if (a.state === 'removed') r.removed++
        else r.active++
      }
    },
    on(name, f) {
      ;(listeners[name] || (listeners[name] = [])).push(f as (data: never) => void)
      return model
    },
    save() {
      return JSON.stringify({
        state: st,
        rng: rs,
        events: events.map((e) => e.done),
        regions: R.map((r) => ({
          free: r.free,
          sheltered: r.sheltered,
          queue: Array.from(r.queue),
          active: r.active,
          contained: r.contained,
          departed: r.departed,
          removed: r.removed,
          awareness: r.awareness,
          seen: r.seen,
          guard: r.guard,
          stage: r.stage,
        })),
      })
    },
    load(json) {
      const d = (typeof json === 'string' ? JSON.parse(json) : json) as {
        state: typeof st
        rng: number
        events: boolean[]
        regions: Array<Omit<Region, 'def' | 'id' | 'pop' | 'queue'> & { queue: number[] }>
      }
      Object.assign(st, d.state)
      rs = d.rng
      d.events.forEach((f, i) => {
        events[i].done = f
      })
      d.regions.forEach((s, i) => {
        Object.assign(R[i], s, { queue: Float64Array.from(s.queue) })
      })
      return model
    },
  }
  return model
}
