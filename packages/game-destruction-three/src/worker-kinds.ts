import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { TaskKind } from '@adatechnology/game-contracts'

import { computeGroundTile, transferOf } from './engine-ground-job'
import type { GroundTileJob, GroundTileResult } from './engine-ground-job'

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
  // the schedule posts copies from its pool and keeps the job for its own fallback: the samples and band go over without a structured clone, and come back with the answer
  transferInput: (job: GroundTileJob) => {
    const out: ArrayBuffer[] = []
    for (const array of [job.samples, job.band]) {
      const buffer = array.buffer as ArrayBuffer
      if (buffer.byteLength > 0 && !out.includes(buffer)) out.push(buffer)
    }
    return out
  },
  transferAwaitedInput: true,
  // no `warmup`: the engine warms its port with a real tile when the renderer is made (`GroundSchedule.warm`)
})
