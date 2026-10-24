import { generate } from './generate'
import { transferablesOf } from './merge'
import type { GenerateOptions, ShapeBuffers, ShapeGenerator, ShapeSchema } from './types'

/** A job the pool posts: `options` without `generators` (functions do not cross threads; register them in the worker script). */
export interface ShapeJob {
  readonly id: number
  readonly schema: ShapeSchema
  readonly options?: Omit<GenerateOptions, 'generators'>
}

export type ShapeReply = { readonly id: number; readonly ok: true; readonly buffers: ShapeBuffers } | { readonly id: number; readonly ok: false; readonly error: string }

/** What a worker scope looks like: `self` in a browser worker, a `worker_threads` `parentPort` wrapper in Node, or an in-thread fake. */
export interface WorkerScopeLike {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
}

export interface ShapeWorkerOptions {
  /** Generators of the `custom` nodes, the same ones the main thread registers. */
  readonly generators?: Readonly<Record<string, ShapeGenerator>>
  /** Transfer the arrays back (default true: zero copy, the worker keeps nothing). */
  readonly transfer?: boolean
}

/**
 * The worker side of `createShapePool`: answers each job with `generate(schema, options)`, transferring every array.
 *
 * ```ts
 * // shape-worker.ts
 * import { installShapeWorker } from '@adatechnology/game-shapes/worker'
 * installShapeWorker(self as never, { generators: myGenerators })
 * ```
 */
export function installShapeWorker(scope: WorkerScopeLike, options: ShapeWorkerOptions = {}): void {
  const transfer = options.transfer !== false
  scope.onmessage = (event) => {
    const job = event.data as ShapeJob
    try {
      const buffers = generate(job.schema, { ...(job.options ?? {}), ...(options.generators ? { generators: options.generators } : {}) })
      const reply: ShapeReply = { id: job.id, ok: true, buffers }
      scope.postMessage(reply, transfer ? transferablesOf(buffers) : [])
    } catch (error) {
      const reply: ShapeReply = { id: job.id, ok: false, error: error instanceof Error ? error.message : String(error) }
      scope.postMessage(reply)
    }
  }
}
