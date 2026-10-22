/** Stage of a region, from quiet to lost. */
export type Stage = 'calm' | 'cases' | 'panic' | 'fallen' | 'overrun'

/** Compartments a region's population can be in. */
export type Compartment = 'free' | 'sheltered' | 'incubating' | 'active' | 'contained' | 'departed' | 'removed'

/** Tunable model parameters; every field is optional in `InfectionConfig.params`. */
export interface InfectionParams {
  /** Base transmission rate. */
  transmission: number
  /** Transmission from contained (hiding) infected to sheltered people. */
  containedTransmission: number
  /** Transmission from active infected into shelters. */
  invasionTransmission: number
  /** Fraction of the population in shelters that is never infected. */
  shelteredFloor: number
  /** Extra transmission while the population is unaware. */
  curiosity: number
  /** Transmission multiplier at night. */
  night: number
  /** `[startHour, endHour]` of the night (wraps past midnight). */
  nightHours: [number, number]
  /** Fraction of contained infected escaping per hour. */
  containedEscape: number
  hideFractionMax: number
  hideFractionPerAwareness: number
  seenPerActive: number
  seenScale: number
  awarenessGain: number
  fleeCarry: number
  fleeIncubatingMult: number
  fleeMax: number
  fleePressure: number
  thresholdCases: number
  thresholdPanic: number
  thresholdFallen: number
  thresholdOverrun: number
}

/** A region of the map. Extra fields (names, places...) are ignored by the model and may carry game data. */
export interface RegionDef {
  id: string
  pop: number
  density?: number
  /** Policing strength: scales the fixed cull of the phase. */
  police?: number
  /** Per-region transmission multiplier. */
  transmissionMult?: number
  /** Truthy: infected here are transferred to the `focus` region while incubating. */
  urban?: number | boolean
  /** Fraction of free people leaving the map from this region (scaled by the phase `exit`). */
  exit?: number
  [extra: string]: unknown
}

/** A phase of the outbreak. Entered when the day is in `[dayMin, dayMax]` and the total passes `threshold`, or when `dayMax` arrives. */
export interface PhaseDef {
  id: string
  dayMin: number
  dayMax: number
  threshold: number
  /** Minimum awareness every region is raised to. */
  awareness: number
  cullFixed: number
  cullFraction: number
  shelter: number
  flee: number
  exit: number
  focusTransfer: number
  [extra: string]: unknown
}

/** A connection between two regions. */
export interface LinkDef {
  a: string
  b: string
  /** Fraction of free people fleeing from `a` to `b`. */
  flow?: number
  /** Fraction of active infected walking from `a` to `b`. */
  active?: number
  /** Link only works from this phase index on. */
  fromPhase?: number
}

interface EventBase {
  id: string
  /** Game hour at which the event fires. */
  hour: number
  [extra: string]: unknown
}

export interface SeedEvent extends EventBase {
  action: 'seed'
  region: string
  n: number
  /** Index of the incubation queue slot (hours already elapsed). */
  queuePosition?: number
}
export interface MovePopulationEvent extends EventBase {
  action: 'move_population'
  from: string[]
  to: string
  fraction: number
  carryIncubating?: boolean
}
export interface ReleaseActiveEvent extends EventBase {
  action: 'release_active'
  from: string
  to: string
  fraction: number
}
export interface WarnEvent extends EventBase {
  action: 'warn'
  region: string
  level: number
  guard?: number
}
export type InfectionEvent = SeedEvent | MovePopulationEvent | ReleaseActiveEvent | WarnEvent
export type EventAction = InfectionEvent['action']

export interface InfectionConfig {
  seed?: number
  /** Length of the incubation queue in hours (default 48). */
  incubationHours?: number
  startHour?: number
  /** Id of the region that receives incubating people from `urban` regions (e.g. a hospital). */
  focus?: string
  params?: Partial<InfectionParams>
  regions: RegionDef[]
  links?: LinkDef[]
  phases: PhaseDef[]
  events?: InfectionEvent[]
}

export interface RegionView {
  id: string
  pop: number
  free: number
  sheltered: number
  incubating: number
  active: number
  contained: number
  /** Left the map. */
  departed: number
  removed: number
  awareness: number
  stage: Stage
}

export interface PhaseInfo {
  id: string
  index: number
  /** Hour the phase started. */
  since: number
  /** Id of the next phase, or `null` at the last one. */
  next: string | null
}

/** A seed for a concrete agent materialised near the player. */
export interface Agent {
  state: 'active' | 'contained' | 'removed'
  seed: number
}

export interface PhaseEvent {
  id: string
  hour: number
  total: number
}
export interface StageEvent {
  region: string
  from: Stage
  to: Stage
  hour: number
}
export interface EventFired {
  id: string
  hour: number
}
export interface InfectionEventMap {
  phase: PhaseEvent
  stage: StageEvent
  event: EventFired
}

export interface Infection {
  /** Advances the model by `hours` (default 1) one-hour steps. */
  advance(hours?: number): Infection
  hour(): number
  day(): number
  phase(): PhaseInfo
  region(id: string): RegionView
  regions(): RegionView[]
  /** Sum of one compartment over all regions. */
  total(field: Compartment): number
  /** A real bite seen in the game enters the incubation queue (`hoursElapsed` = hours since the bite). */
  infect(region: string, n?: number, hoursElapsed?: number): void
  /** A real kill removes active infected. */
  remove(region: string, n?: number): void
  /** Raises awareness; `guard < 1` reduces who flees into the region. */
  warn(region: string, level: number, guard?: number): void
  /** Takes up to `n` infected out of the abstract numbers as seeds for concrete agents. */
  materialize(region: string, n: number): Agent[]
  /** Returns agents (e.g. when they leave relevance) to the abstract numbers. */
  giveBack(region: string, batch: Agent[]): void
  on<K extends keyof InfectionEventMap>(name: K, listener: (data: InfectionEventMap[K]) => void): Infection
  /** Serialises the whole state to JSON. */
  save(): string
  /** Restores a state produced by `save` (a string or the parsed object). */
  load(json: string | object): Infection
}
