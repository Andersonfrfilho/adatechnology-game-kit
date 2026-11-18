import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { TaskKind } from '@adatechnology/game-contracts'

import { computeGroundTile, jobTransferOf, transferOf } from './engine-ground-job'
import type { GroundTileJob, GroundTileResult } from './engine-ground-job'
import type { StaticSolid } from './engine-statics'
import { measureStaticPart, staticSolidsTransfer } from './static-part-job'
import type { StaticPartJob } from './static-part-job'

/**
 * The engine's ground tiles as a task kind of the worker coordinator (`destruction.ground-tiles`, CLAUDE.md §14): a tile is a pure function
 * of the samples and the band read at the update it was asked for, so the worker and the main thread give the same bits. The engine's
 * `GroundSchedule` applies it at its update whatever the worker does (`createCoordinatorGroundPort`). No three.js here: a game's worker file
 * imports it from `@adatechnology/game-destruction-three/worker-kinds`.
 */
export const groundTilesKind: TaskKind<GroundTileJob, GroundTileResult> = Object.freeze({
  id: WORKER_KIND_ID.GROUND_TILES,
  kind: 'task' as const,
  ...WORKER_KIND_DEFAULTS[WORKER_KIND_ID.GROUND_TILES],
  run: computeGroundTile,
  transferOutput: transferOf,
  // the schedule posts copies from its pool and keeps the job for its own fallback: the samples and band (or the patch) go over without a structured clone, and come back with the answer
  transferInput: jobTransferOf,
  transferAwaitedInput: true,
  // no `warmup`: the engine warms its port with a real tile when the renderer is made (`GroundSchedule.warm`)
})

/** A cube, the first job each worker runs (`warm`). */
const WARM_PART: StaticPartJob = {
  points: new Float64Array([-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]),
  matrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
  found: new Uint32Array(0),
  from: 0,
}

/**
 * The fixed colliders measured from what is drawn (`destruction.static-colliders`, lane `build`, CLAUDE.md §14): a part of a house, a table, a wall measured anew is a
 * pure function of its vertices, its triangles and its world matrix (`measureStaticPart`), so the worker and the main thread give the same bits. The renderer hands its
 * parts to it when it has a coordinator (`RendererOptions.workers`); the object waits for the answer as a part out of turns waits for the next update.
 */
export const staticCollidersKind: TaskKind<StaticPartJob, StaticSolid[]> = Object.freeze({
  id: WORKER_KIND_ID.STATIC_COLLIDERS,
  kind: 'task' as const,
  ...WORKER_KIND_DEFAULTS[WORKER_KIND_ID.STATIC_COLLIDERS],
  run: measureStaticPart,
  transferOutput: staticSolidsTransfer,
  warmup: WARM_PART,
})
