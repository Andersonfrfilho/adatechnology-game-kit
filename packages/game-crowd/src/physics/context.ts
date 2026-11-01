import type { Doors } from '../doors'
import type { NavGrid } from '../grid'
import type { CrowdStore } from '../store'
import type { Corpse, CrowdDamageResult, CrowdEventMap, CrowdEventName, CrowdHit, CrowdTarget, CrowdType } from '../types'
import type { ResolvedPhysics } from './options'

/** Counters of the physics, all zero with it off (`crowd.stats.physics`). */
export type PhysicsStats = {
  contacts: number
  maxOverlap: number
  meanOverlap: number
  /** Falls by cause: pressure, shove, trip, landing, collapse, blast. */
  falls: [pressure: number, shove: number, trip: number, landing: number, collapse: number, blast: number]
  /** Chain falls: shove, landing, collapse or trip within 240 steps of a blast, of an agent whose own direct shove from it was below `shoveStagger`. */
  fallsBeyondBlast: number
  fallen: number
  staggering: number
  climbers: number
  moundMax: number
  thrownActive: number
  thrownPeak: number
  blastChecks: number
  chainLinks: number
  /** The highest field of the step, N: the front of a column, or the funnel of a door. */
  fieldMax: number
  /** The pressure of the horde on the target, N (exponential mean). */
  playerPressure: number
}

export const createPhysicsStats = (): PhysicsStats => ({
  contacts: 0,
  maxOverlap: 0,
  meanOverlap: 0,
  falls: [0, 0, 0, 0, 0, 0],
  fallsBeyondBlast: 0,
  fallen: 0,
  staggering: 0,
  climbers: 0,
  moundMax: 0,
  thrownActive: 0,
  thrownPeak: 0,
  blastChecks: 0,
  chainLinks: 0,
  fieldMax: 0,
  playerPressure: 0,
})

/** What the physics modules need from the crowd: the shared state and the few verbs they cannot do alone. */
export type PhysicsContext = {
  readonly store: CrowdStore
  readonly grid: NavGrid
  readonly doors: Doors
  readonly options: ResolvedPhysics
  readonly stats: PhysicsStats
  readonly gravity: number
  readonly attackEvery: number
  /** The fixed step being run, counted from 0: the counter of every `unit` draw. */
  step: number
  /** Seconds of the fixed step. */
  h: number
  /** Centre of the bands of this step. */
  centre: { x: number; z: number }
  /** Step of the last blast, -1000 before the first. */
  lastBlastStep: number
  typeOf(i: number): CrowdType
  target(): CrowdTarget | null
  emit<K extends CrowdEventName>(event: K, payload: CrowdEventMap[K]): void
  /** Damage with the draw handed in, so the shared stream stays where the game left it. A death is deferred to the end of the step. */
  damage(i: number, hit: CrowdHit, draw: () => number): CrowdDamageResult
  deferKill(i: number): void
  /** A pile step goes (falls, is thrown or dies): the steps behind it in the column come down. */
  releasePileStep(i: number): void
  corpseOf(i: number, seed: number): Corpse
  /** The bodies on the ground (the ledger), for the mound. */
  corpseList(): readonly { readonly data: Corpse }[]
  addCorpse(corpse: Corpse): void
  groundAt(cell: number, y: number): number
  /** Mound height in mm at a grid cell (0 with the mound off). */
  moundAt(cell: number): number
  /** Kilograms standing on the three cells of the lying body of agent `i` (0 with the mound off). */
  weightOn: (i: number) => number
}
