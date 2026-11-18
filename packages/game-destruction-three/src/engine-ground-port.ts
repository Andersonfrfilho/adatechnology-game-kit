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
  /** May turn `none` later (a worker that failed): read it at each job. */
  readonly transport: 'transfer' | 'inline' | 'none'
  /** Takes the job's arrays (they may be transferred: not to be read after). */
  postTile(job: GroundTileJob): void
  /** The one handler the answers go to. */
  onTile(handler: (result: GroundTileResult) => void): void
  /** Stops the worker, if any; no answer comes after. */
  dispose(): void
}

/** The one handler of a port: a port serves one engine, so a second one is an error (it would take the answers of the first). */
const oneHandler = (): { set(h: (result: GroundTileResult) => void): void; get(): ((result: GroundTileResult) => void) | null; drop(): void } => {
  let handler: ((result: GroundTileResult) => void) | null = null
  return {
    set: (h) => {
      if (handler) throw new Error('GroundWorkerPort: onTile set twice (a port serves one engine)')
      handler = h
    },
    get: () => handler,
    drop: () => {
      handler = null
    },
  }
}

export const createInlineGroundPort = (): GroundWorkerPort => {
  const handler = oneHandler()
  return {
    transport: 'inline',
    postTile: (job) => handler.get()?.(computeGroundTile(job)),
    onTile: handler.set,
    dispose: handler.drop,
  }
}

export const createMainThreadGroundPort = (): GroundWorkerPort => {
  const handler = oneHandler()
  return { transport: 'none', postTile: () => undefined, onTile: handler.set, dispose: handler.drop }
}

/**
 * A worker running `installGroundWorker` (the package's `ground-worker` entry): jobs and answers cross with their buffers transferred; `dispose` terminates it. A worker that
 * fails (`onerror`: its script did not load, it threw) is posted nothing more: the port turns `none` and every tile is made on the main thread at its update, as it would have
 * been anyway (game-shapes' pool fails its jobs the same way).
 */
export const createWorkerGroundPort = (worker: WorkerLike): GroundWorkerPort => {
  const handler = oneHandler()
  let failed = false
  worker.onmessage = (event) => handler.get()?.(event.data as GroundTileResult)
  worker.onerror = () => {
    failed = true
  }
  return {
    get transport() {
      return failed ? 'none' : 'transfer'
    },
    postTile: (job) => {
      if (!failed) worker.postMessage(job, [job.samples.buffer as ArrayBuffer, job.band.buffer as ArrayBuffer])
    },
    onTile: handler.set,
    dispose: () => {
      handler.drop()
      worker.onmessage = null
      worker.onerror = null
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
