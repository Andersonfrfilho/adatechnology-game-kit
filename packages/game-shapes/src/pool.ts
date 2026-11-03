import type { ShapeCache } from './cache'
import { generate, shapeKey } from './generate'
import type { GenerateOptions, ShapeBuffers, ShapeGenerator, ShapeSchema } from './types'
import type { ShapeJob, ShapeReply } from './worker'

/** Anything with `postMessage` / `onmessage` / `terminate`: a browser `Worker`, a `worker_threads` wrapper, an in-thread fake. */
export interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null
  onerror?: ((event: unknown) => void) | null
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
  terminate(): unknown
}

export interface ShapePoolOptions {
  /** Workers (default 0: generate in the calling thread). */
  readonly size?: number
  /** Makes one worker that runs `installShapeWorker`. Without it the pool generates in the calling thread. */
  readonly spawn?: () => WorkerLike
  /** Results by `shapeKey`: a hit resolves at once and never reaches a worker. */
  readonly cache?: ShapeCache
  /** Generators of the `custom` nodes for the jobs made in the calling thread (the workers register their own). */
  readonly generators?: Readonly<Record<string, ShapeGenerator>>
  /** Look custom nodes up in `generators` only (for example `shapes.record()` of `createShapes`), never in the global registry; the jobs then run in the calling thread, since a worker cannot receive functions. */
  readonly isolatedGenerators?: boolean
}

export interface ShapeRequest {
  readonly schema: ShapeSchema
  readonly options?: GenerateOptions
}

export interface ShapePoolStats {
  readonly workers: number
  readonly jobs: number
  readonly cacheHits: number
  readonly shared: number
  readonly inThread: number
  readonly busy: number
}

export interface ShapePool {
  /** `generate(schema, options)` off the main thread. Same key, same promise while in flight; the result is shared (read-only). */
  generate(schema: ShapeSchema, options?: GenerateOptions): Promise<ShapeBuffers>
  /** A list spread over the workers, resolved in input order. */
  generateMany(list: readonly (ShapeSchema | ShapeRequest)[]): Promise<ShapeBuffers[]>
  stats(): ShapePoolStats
  /** Stops the workers; pending jobs reject. */
  terminate(): void
}

interface Slot {
  worker: WorkerLike
  pending: Map<number, { resolve: (b: ShapeBuffers) => void; reject: (e: Error) => void }>
}

const isRequest = (value: ShapeSchema | ShapeRequest): value is ShapeRequest => (value as ShapeRequest).schema !== undefined && (value as ShapeSchema).root === undefined

/**
 * A pool of shape workers. The schema is cheap (plain data) and is built on the main thread; the buffers are generated in a worker and
 * transferred back. With `size: 0` or no `spawn` it generates in the calling thread, with the same cache and in-flight sharing.
 */
export function createShapePool(options: ShapePoolOptions = {}): ShapePool {
  const size = options.spawn ? Math.max(0, options.size ?? 0) : 0
  const cache = options.cache
  const slots: Slot[] = []
  const inFlight = new Map<string, Promise<ShapeBuffers>>()
  let nextId = 1
  let jobs = 0
  let cacheHits = 0
  let shared = 0
  let inThread = 0
  let terminated = false

  const failAll = (slot: Slot, error: Error): void => {
    for (const job of slot.pending.values()) job.reject(error)
    slot.pending.clear()
  }
  const spawnSlot = (): Slot => {
    const slot: Slot = { worker: (options.spawn as () => WorkerLike)(), pending: new Map() }
    slot.worker.onmessage = (event) => {
      const reply = event.data as ShapeReply
      const job = slot.pending.get(reply.id)
      if (!job) return
      slot.pending.delete(reply.id)
      if (reply.ok) job.resolve(reply.buffers)
      else job.reject(new Error(reply.error))
    }
    slot.worker.onerror = (event) => {
      // a worker that crashed takes its jobs with it; a fresh one takes its place
      failAll(slot, new Error(`game-shapes worker failed: ${(event as { message?: string })?.message ?? String(event)}`))
      slot.worker.terminate()
      const index = slots.indexOf(slot)
      if (index >= 0 && !terminated) slots[index] = spawnSlot()
    }
    return slot
  }
  for (let i = 0; i < size; i++) slots.push(spawnSlot())

  const run = (schema: ShapeSchema, generateOptions: GenerateOptions): Promise<ShapeBuffers> => {
    // custom generators passed per call are functions: they cannot reach a worker, so that job runs here
    if (slots.length === 0 || generateOptions.generators || options.isolatedGenerators) {
      inThread++
      try {
        const generators = { ...(options.generators ?? {}), ...(generateOptions.generators ?? {}) }
        return Promise.resolve(generate(schema, { ...generateOptions, ...(Object.keys(generators).length ? { generators } : {}), ...(options.isolatedGenerators ? { isolatedGenerators: true } : {}) }))
      } catch (error) {
        return Promise.reject(error)
      }
    }
    let slot = slots[0] as Slot
    for (const s of slots) if (s.pending.size < slot.pending.size) slot = s
    const id = nextId++
    const job: ShapeJob = { id, schema, options: generateOptions }
    return new Promise<ShapeBuffers>((resolve, reject) => {
      slot.pending.set(id, { resolve, reject })
      slot.worker.postMessage(job)
    })
  }

  const pool: ShapePool = {
    generate(schema, generateOptions = {}) {
      if (terminated) return Promise.reject(new Error('createShapePool: the pool was terminated'))
      jobs++
      const key = shapeKey(schema, generateOptions)
      const hit = cache?.get(key)
      if (hit) {
        cacheHits++
        return Promise.resolve(hit)
      }
      const flying = inFlight.get(key)
      if (flying) {
        shared++
        return flying
      }
      const promise = run(schema, generateOptions).then(
        (buffers) => {
          inFlight.delete(key)
          cache?.set(key, buffers)
          return buffers
        },
        (error: unknown) => {
          inFlight.delete(key)
          throw error
        },
      )
      inFlight.set(key, promise)
      return promise
    },
    generateMany(list) {
      return Promise.all(list.map((item) => (isRequest(item) ? pool.generate(item.schema, item.options) : pool.generate(item))))
    },
    stats: () => ({ workers: slots.length, jobs, cacheHits, shared, inThread, busy: slots.reduce((n, s) => n + s.pending.size, 0) }),
    terminate() {
      terminated = true
      for (const slot of slots) {
        failAll(slot, new Error('createShapePool: the pool was terminated'))
        slot.worker.terminate()
      }
      slots.length = 0
    },
  }
  return pool
}
