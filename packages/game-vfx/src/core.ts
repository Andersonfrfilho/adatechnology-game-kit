import type { AreaCapTracker } from './area-cap'
import type { Fire } from './emitters/fire'
import type { GroundField } from './ground'
import type { LightPool } from './lights'
import type { MarkStore } from './marks'
import type { OrderedPool } from './pool'
import type { Chunk } from './pools/chunks'
import type { Glow } from './pools/glows'
import type { Puff, Ring } from './pools/puffs'
import type { Shock } from './pools/shocks'
import type { Spark } from './pools/sparks'
import type { MutableVec3, RandomStream } from './random'
import type { Schedule } from './schedule'
import type { VfxTrace } from './trace'
import type { LodBands, ScreenState, VfxLayer, VfxProfile, VfxSideRequest } from './types'

export type RandomMode = 'per_event' | 'shared'

/** What every part of the effects reads and writes: the pools, lights, screen, marks, clock and the few settings. Internal; the host sees `VfxWorld`. */
export interface VfxCore {
  readonly profile: VfxProfile
  readonly puffs: OrderedPool<Puff>
  readonly sparks: OrderedPool<Spark>
  readonly glows: OrderedPool<Glow>
  readonly chunks: OrderedPool<Chunk>
  readonly fires: OrderedPool<Fire>
  readonly shocks: OrderedPool<Shock>
  readonly rings: OrderedPool<Ring>
  readonly lights: LightPool
  readonly marks: MarkStore
  readonly screen: ScreenState
  readonly layers: Record<VfxLayer, boolean>
  readonly schedule: Schedule
  readonly wind: MutableVec3
  readonly camera: MutableVec3
  readonly ground: GroundField | undefined
  readonly bands: LodBands
  readonly areaCap: AreaCapTracker | undefined
  readonly randomMode: RandomMode
  /** The stream every explosion draws from in `shared` mode, and what spawns outside an event use. */
  readonly sharedRandom: RandomStream
  readonly reducedMotion: boolean
  readonly gravity: number
  readonly trace: VfxTrace | undefined
  /** What the last explosion made: puffs, sparks, chunks, lights (the Lab's `evCount`). */
  readonly spawned: { puffs: number; sparks: number; chunks: number; lights: number }
  readonly clock: { time: number; lastBlast: number; lod: number; forcedLod: number | null }
  groundAt(x: number, z: number): number
  emit(request: VfxSideRequest): void
}
