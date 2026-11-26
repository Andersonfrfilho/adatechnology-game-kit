import type { BodyLod, BodyLodOptions, BodyRung } from './body-lod'
import type { CorpseHeap } from './engine-corpses-heap'
import type { BodyId, RagdollId, SeamWorld, Vec3 } from './contract'
import type { CorpseBodyKit, Rigid } from './corpse-pose'
import type { WorkBudget } from './work-budget'

/** A dead body to put in the world, standing where it died; it falls. */
export interface AddCorpseParams {
  /** The ledger's id (`CorpseEntry.id`): the one name of the body for as long as it lasts, whatever its rung. */
  readonly id: number
  readonly kit: CorpseBodyKit
  /** Where the feet were. */
  readonly position: Vec3
  /** Turn about +y. */
  readonly yaw: number
  /** What it was moving at (m/s), carried to every body of the first rung. */
  readonly velocity?: Vec3
}

/** A dead body that already lies where it lies (a loaded game, a body streamed in): put in the world asleep, on the rung asked. */
export interface AddLyingCorpseParams {
  readonly id: number
  readonly kit: CorpseBodyKit
  /** Where the torso lies (the chain's torso frame: local y along the body). */
  readonly torso: Rigid
  readonly rung: 'r1' | 'r2' | 'r3'
}

export interface CorpseBodiesOptions {
  readonly lod?: BodyLodOptions
  /** Points the distance is taken from (the player, more than one in a split screen), read once in each fixed step. None: everything is near. */
  readonly interest?: () => readonly Vec3[]
  /** Height (m) of the mound the horde built under (x, z): a body on one higher than `pileHeight` is in a pile. */
  readonly moundAt?: (x: number, z: number) => number
  /** The frame's budget: a change of rung by distance takes `lod` units from it and waits when there are none; a pile, a quota or a removal does not wait. */
  readonly budget?: WorkBudget
  /** Fixed steps between looks at a body that is not a ragdoll (staggered by id). Default 8. */
  readonly evaluateEvery?: number
  /**
   * A corpse fell asleep more than `settleDistance` from where the host last had it (a blast pushed it): told once, in the fixed step, so the host's own record (the ledger the
   * horde's mound is built from) is where the body lies. Called as a structural event of the tick.
   */
  readonly onSettled?: (corpse: SettledCorpse) => void
  /** Metres a corpse must lie from where the host has it for `onSettled` to be told: more than a body's own fall moves its torso (about 1.3 m). Default 2. */
  readonly settleDistance?: number
}

/** Where a corpse that was pushed lies now: its torso's x and z, and the way its head points (about +y, as `AddCorpseParams.yaw`). */
export interface SettledCorpse {
  readonly id: number
  readonly x: number
  readonly z: number
  readonly yaw: number
}

/** Work units (10 µs on the reference machine) a change of rung takes, by what it makes: one a body made, two for a ragdoll's joints. */
export const LOD_UNITS = { ragdoll: 8, chain: 3, capsule: 1, freeze: 2, unload: 1 } as const

export interface CorpseRecord {
  readonly id: number
  readonly kit: CorpseBodyKit
  rung: BodyRung
  /** The engine ragdoll of R0 and R1, 0 for none. */
  ragdoll: RagdollId | 0
  /** The rigid bodies of the rung: a ragdoll's or chain's parts, the capsule alone, none for R2f and R3. */
  bodies: BodyId[]
  /** The pile whose static compound holds it (R2f), 0 for none. */
  pile: number
  /** Where its torso is when it has no body (x y z, then the quaternion): kept for R2f and R3, and for a sleeper (it cannot move). */
  readonly torso: Float64Array
  asleepSeconds: number
  sinceChangeSeconds: number
  woken: boolean
  /** Its place among the bodies of its pile by distance (`BodyLodInput.pileRank`), set every `evaluateEvery` steps. */
  pileRank: number
  /** Asleep when last looked at. */
  asleep: boolean
  /** `touching` is of bodies that are gone (the rung changed): the next look reads it again. */
  stale: boolean
  /** The bodies it touches, kept while it sleeps (a sleeper has no contacts in the engine; they are read once, as it falls asleep). */
  touching: BodyId[]
  born: number
  /** Where the host has it (x, z): what `onSettled` is measured against. */
  originX: number
  originZ: number
  lastLookedAt: number
  distance: number
  /** Asleep with nothing that can change its rung until the interest has travelled `dormantKey` (or something wakes it): it is in no list that is walked each step. */
  dormant: boolean
  dormantKey: number
}

export interface Pile {
  readonly id: number
  /** The static compound, one capsule child per member (tagged with the corpse's id). */
  body: BodyId
  members: number[]
}

export interface CorpseContext {
  readonly world: SeamWorld
  readonly lod: BodyLod
  readonly budget: WorkBudget | undefined
  readonly records: Map<number, CorpseRecord>
  readonly piles: Map<number, Pile>
  /** Every body of a corpse (and a pile's compound, by the pile's negative id) to the corpse. */
  readonly ownerOf: Map<BodyId, number>
  readonly pileOf: Map<BodyId, number>
  nextPile: number
  born: number
  tick: number
  /** Corpses by rung and the rigid bodies they hold: kept by the changes, so a quota asks in one read instead of a walk. */
  readonly rungCounts: Record<BodyRung, number>
  rigidCount: number
  /** The corpses a step walks: all but the dormant ones. */
  readonly live: Set<CorpseRecord>
  /** The dormant ones by the distance the interest must still travel (`travel` is the total so far) before their rung could change. */
  readonly dormant: CorpseHeap
  travel: number
  /** The interest as of the last step (x, z per point), to measure how far it moved. */
  interest: Float64Array
  /** Looks taken at corpses, in all: what a step costs is in how many. */
  looks: number
  /** The interest now, read afresh (a quota that needs distances; a step reads it once and hands it on). */
  readonly readInterest: () => readonly Vec3[]
  readonly pending: PendingChange[]
  readonly freezing: CorpseRecord[]
}

export interface PendingChange {
  readonly record: CorpseRecord
  readonly to: BodyRung
  readonly forced: boolean
}
