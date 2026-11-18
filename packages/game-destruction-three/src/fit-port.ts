import type { WorkerLike, WorkerScopeLike } from '@adatechnology/game-shapes'

import { computeFit, fitTransferOf } from './fit-job'
import type { FitJob, FitResult } from './fit-job'

/**
 * Where the boxes of ranged parts are fitted ahead of the blow (`RendererOptions.fitWorker`). The answers only fill the renderer's exact-input cache: a part whose answer has not
 * come when it breaks off is fitted on the main thread from the same numbers, so when (or whether) an answer comes changes where the work ran, never the boxes.
 *
 * - `transfer`: a worker (`createWorkerFitPort`, over game-shapes' `WorkerLike`); the answer comes whenever its event loop delivers it.
 * - `inline`: this thread, at once when posted (`createInlineFitPort`): tests, Node.
 */
export interface FitWorkerPort {
  readonly transport: 'transfer' | 'inline'
  /** Takes the job's arrays (they may be transferred: not to be read after). */
  postFit(job: FitJob): void
  /** The one handler the answers go to. */
  onFit(handler: (result: FitResult) => void): void
  /** The one handler told when the worker fails (`onerror`, `onmessageerror`, or a message that is not an answer; it answers nothing after): the renderer stops posting and fits on the main thread. */
  onFailure(handler: (reason: string) => void): void
  /** Stops the worker, if any; no answer comes after. */
  dispose(): void
}

export const createInlineFitPort = (): FitWorkerPort => {
  let handler: ((result: FitResult) => void) | null = null
  return {
    transport: 'inline',
    postFit: (job) => handler?.(computeFit(job)),
    onFit: (h) => {
      handler = h
    },
    onFailure: () => undefined,
    dispose: () => {
      handler = null
    },
  }
}

/** Whether a message from the fit worker is an answer: its id, its outcome and the job's two arrays handed back. */
const isFitResult = (data: unknown): data is FitResult => {
  if (typeof data !== 'object' || data === null) return false
  const r = data as Partial<Record<keyof FitResult, unknown>>
  return typeof r.id === 'number' && typeof r.ok === 'boolean' && r.points instanceof Float64Array && r.triangles instanceof Uint32Array
}

/** A worker running `installFitWorker` (the package's `fit-worker` entry): jobs and answers cross with their buffers transferred; `dispose` terminates it. */
export const createWorkerFitPort = (worker: WorkerLike): FitWorkerPort => {
  let handler: ((result: FitResult) => void) | null = null
  let failure: ((reason: string) => void) | null = null
  const fail = (event: unknown): void => failure?.((event as { message?: string } | null)?.message ?? String(event))
  worker.onmessage = (event) => {
    // anything but an answer means the worker is not the fit worker (or broke): stop trusting it
    if (isFitResult(event.data)) handler?.(event.data)
    else failure?.('the fit worker sent something that is not an answer')
  }
  worker.onerror = fail
  worker.onmessageerror = fail
  return {
    transport: 'transfer',
    postFit: (job) => worker.postMessage(job, fitTransferOf(job)),
    onFit: (h) => {
      handler = h
    },
    onFailure: (h) => {
      failure = h
    },
    dispose: () => {
      handler = null
      failure = null
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    },
  }
}

/** The worker side: each job answered with its boxes, its own arrays transferred back (for the main thread's pool). */
export const installFitWorker = (scope: WorkerScopeLike): void => {
  scope.onmessage = (event) => {
    const result = computeFit(event.data as FitJob)
    scope.postMessage(result, fitTransferOf(result))
  }
}
