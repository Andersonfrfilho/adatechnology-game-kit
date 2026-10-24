import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

import { afterEach, describe, expect, it } from 'vitest'

import { byteSizeOf, createShapeCache, createShapePool, generate, installShapeWorker, shapeKey, transferablesOf } from '../src'
import type { ShapeBuffers, ShapeSchema, WorkerLike } from '../src'
// @ts-expect-error plain JS fixture shared with the worker script
import { rocks } from './fixtures/rocks.mjs'

const shape = (n: number, extra: Partial<ShapeSchema> = {}): ShapeSchema => ({
  version: 1,
  name: `shape-${n}`,
  root: {
    kind: 'group',
    children: [
      { kind: 'box', size: [1, 0.5 + n * 0.01, 0.4], material: 'wood' },
      { kind: 'cylinder', radiusTop: 0.05, radiusBottom: 0.05, height: 0.8, radialSegments: 12, position: [0.3, 0.4, 0], material: 'metal' },
      { kind: 'group', part: 'lid', position: [0, 0.5, -0.2], rotation: [0.3, 0, 0], children: [{ kind: 'box', size: [1, 0.02, 0.4], position: [0, 0, 0.2], material: 'wood' }] },
      { kind: 'custom', generator: 'test.rocks', params: { count: 3 } },
    ],
  },
  lod: [{ distance: 10, detail: 0.5 }],
  ...extra,
})
const generators = { 'test.rocks': rocks }

/** Every array of a result as plain numbers, with the rest of the structure: byte equality. */
const bytesOf = (b: ShapeBuffers): unknown =>
  JSON.parse(
    JSON.stringify(b, (_k, v: unknown) => (ArrayBuffer.isView(v) ? { type: v.constructor.name, values: Array.from(v as unknown as ArrayLike<number>, (x) => (Object.is(x, -0) ? '-0' : x)) } : v)),
  )

/** An in-thread worker: structured clone and transfer, like a real one, on the next task. */
function fakeWorker(): WorkerLike & { posted: number } {
  const inside = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: unknown, t?: ArrayBuffer[]) => setTimeout(() => outside.onmessage?.({ data: structuredClone(m, { transfer: t ?? [] }) })) }
  installShapeWorker(inside, { generators })
  const outside = {
    posted: 0,
    onmessage: null as ((e: { data: unknown }) => void) | null,
    onerror: null,
    postMessage(m: unknown) {
      outside.posted++
      setTimeout(() => inside.onmessage?.({ data: structuredClone(m) }))
    },
    terminate() {},
  }
  return outside
}

describe('createShapeCache', () => {
  it('an LRU by entries and by bytes; a hit is the bytes of a miss', () => {
    const cache = createShapeCache({ maxEntries: 2 })
    const a = generate(shape(1), { generators })
    const b = generate(shape(2), { generators })
    const c = generate(shape(3), { generators })
    cache.set('a', a)
    cache.set('b', b)
    expect(cache.get('a')).toBe(a) // a is now the most recent
    cache.set('c', c)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('a') && cache.has('c')).toBe(true)
    expect(cache.stats()).toMatchObject({ entries: 2, bytes: byteSizeOf(a) + byteSizeOf(c), hits: 1, evictions: 1 })
    expect(bytesOf(cache.get('a') as ShapeBuffers)).toEqual(bytesOf(generate(shape(1), { generators })))

    const small = createShapeCache({ maxBytes: byteSizeOf(a) + 10 })
    small.set('a', a)
    small.set('b', b)
    expect(small.has('a')).toBe(false)
    expect(small.stats().bytes).toBe(byteSizeOf(b))
    small.set('huge', { ...a, levels: [...a.levels, ...b.levels] })
    expect(small.has('huge')).toBe(false)
    small.clear()
    expect(small.stats()).toMatchObject({ entries: 0, bytes: 0 })
  })
})

describe('the key option', () => {
  it('computed, given or skipped; the bytes do not change', () => {
    const computed = generate(shape(1), { generators })
    expect(computed.key).toBe(shapeKey(shape(1)))
    expect(generate(shape(1), { generators, key: 'mine' }).key).toBe('mine')
    const skipped = generate(shape(1), { generators, key: false })
    expect(skipped.key).toBe('')
    expect(bytesOf({ ...skipped, key: computed.key })).toEqual(bytesOf(computed))
  })
})

describe('createShapePool in the calling thread', () => {
  it('shares in-flight keys, serves the cache and keeps the input order', async () => {
    const cache = createShapeCache()
    const pool = createShapePool({ cache, generators })
    const [x, y] = await Promise.all([pool.generate(shape(1)), pool.generate(shape(1))])
    expect(x).toBe(y)
    expect(await pool.generate(shape(1))).toBe(x)
    expect(pool.stats()).toMatchObject({ workers: 0, jobs: 3, shared: 1, cacheHits: 1, inThread: 1 })
    const many = await pool.generateMany([shape(4), { schema: shape(5), options: { seed: 9 } }, shape(6)])
    expect(many.map((m) => m.name)).toEqual(['shape-4', 'shape-5', 'shape-6'])
    expect(many[1]!.key).toBe(shapeKey(shape(5), { seed: 9 }))
    expect(bytesOf(many[1]!)).toEqual(bytesOf(generate(shape(5), { seed: 9, generators })))
  })
  it('rejects with the error of generate', async () => {
    const pool = createShapePool()
    await expect(pool.generate(shape(1))).rejects.toThrow(/no generator "test.rocks"/)
  })
})

describe('createShapePool with workers', () => {
  it('fake workers: byte-equal results, the least busy worker, one job per key', async () => {
    const workers: Array<ReturnType<typeof fakeWorker>> = []
    const pool = createShapePool({ size: 3, spawn: () => { const w = fakeWorker(); workers.push(w); return w } })
    const list = Array.from({ length: 9 }, (_, i) => shape(i % 6))
    const results = await pool.generateMany(list)
    results.forEach((r, i) => expect(bytesOf(r), `shape ${i}`).toEqual(bytesOf(generate(list[i]!, { generators }))))
    expect(workers.map((w) => w.posted)).toEqual([2, 2, 2]) // six distinct keys over three workers
    expect(pool.stats()).toMatchObject({ workers: 3, jobs: 9, shared: 3, busy: 0 })
    // per-call generators are functions: that job stays here
    await pool.generate(shape(7), { generators })
    expect(pool.stats().inThread).toBe(1)
    pool.terminate()
    await expect(pool.generate(shape(1))).rejects.toThrow(/terminated/)
  })

  const workerScript = fileURLToPath(new URL('./fixtures/shape-worker.mjs', import.meta.url))
  const built = existsSync(fileURLToPath(new URL('../dist/worker.js', import.meta.url)))
  const threads: Worker[] = []
  afterEach(async () => {
    await Promise.all(threads.splice(0).map((t) => t.terminate()))
  })
  const nodeWorker = (): WorkerLike => {
    const thread = new Worker(workerScript)
    threads.push(thread)
    const like: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (m, t) => thread.postMessage(m, t),
      terminate: () => thread.terminate(),
    }
    thread.on('message', (data) => like.onmessage?.({ data }))
    thread.on('error', (error) => like.onerror?.(error))
    return like
  }

  it.runIf(built)('worker_threads: the same bytes as generate in this thread, arrays transferred', async () => {
    const pool = createShapePool({ size: 2, spawn: nodeWorker })
    const list = [shape(1), shape(2, { name: 'other' }), shape(3)]
    const results = await pool.generateMany(list.map((schema) => ({ schema, options: { seed: 'yard' } })))
    results.forEach((r, i) => expect(bytesOf(r)).toEqual(bytesOf(generate(list[i]!, { seed: 'yard', generators }))))
    expect(transferablesOf(results[0]!).length).toBeGreaterThan(0)
    await expect(pool.generate({ ...shape(1), root: { kind: 'custom', generator: 'nobody' } })).rejects.toThrow(/no generator "nobody"/)
    pool.terminate()
  })
})
