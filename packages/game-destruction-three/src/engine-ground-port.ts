import type { WorkerLike, WorkerScopeLike } from '@adatechnology/game-shapes'

import { computeGroundTile, transferOf } from './engine-ground-job'
import type { GroundTileJob, GroundTileResult } from './engine-ground-job'

/**
 * Where the engine's ground tiles are made (`RendererOptions.groundWorker`): the main thread posts a job (`GroundTileJob`, plain arrays, transferred) and takes the tile back
 * when it comes. The engine applies a tile exactly `groundWorkerFrames` updates after it asked for it, from the answer if it came, else made on the main thread from the same
 * job: the answer is the same bits either way, so when it comes changes nothing but where the work ran (`GroundSchedule`).
 *
 * - `transfer`: a worker (`createWorkerGroundPort`, over game-shapes' `WorkerLike`); the answer comes whenever its event loop delivers it.
 * - `inline`: this thread, at once when posted (`createInlineGroundPort`): tests, Node.
 * - `none`: never answers and nothing is posted (`createMainThreadGroundPort`): every tile made on the main thread at its frame, the reference the other two match.
 */
export interface GroundWorkerPort {
  readonly transport: 'transfer' | 'inline' | 'none'
  /** Takes the job's arrays (they may be transferred: not to be read after). */
  postTile(job: GroundTileJob): void
  /** The one handler the answers go to. */
  onTile(handler: (result: GroundTileResult) => void): void
  /** Stops the worker, if any; no answer comes after. */
  dispose(): void
}

export const createInlineGroundPort = (): GroundWorkerPort => {
  let handler: ((result: GroundTileResult) => void) | null = null
  return {
    transport: 'inline',
    postTile: (job) => handler?.(computeGroundTile(job)),
    onTile: (h) => {
      handler = h
    },
    dispose: () => {
      handler = null
    },
  }
}

export const createMainThreadGroundPort = (): GroundWorkerPort => ({ transport: 'none', postTile: () => undefined, onTile: () => undefined, dispose: () => undefined })

/** A worker running `installGroundWorker` (the package's `ground-worker` entry): jobs and answers cross with their buffers transferred; `dispose` terminates it. */
export const createWorkerGroundPort = (worker: WorkerLike): GroundWorkerPort => {
  let handler: ((result: GroundTileResult) => void) | null = null
  worker.onmessage = (event) => handler?.(event.data as GroundTileResult)
  return {
    transport: 'transfer',
    postTile: (job) => worker.postMessage(job, [job.samples.buffer as ArrayBuffer, job.band.buffer as ArrayBuffer]),
    onTile: (h) => {
      handler = h
    },
    dispose: () => {
      handler = null
      worker.onmessage = null
      worker.terminate()
    },
  }
}

/** The worker side: each job answered with its tile, every array transferred back (the job's own included, for the main thread's pool). */
export const installGroundWorker = (scope: WorkerScopeLike): void => {
  scope.onmessage = (event) => {
    const result = computeGroundTile(event.data as GroundTileJob)
    scope.postMessage(result, transferOf(result))
  }
}
