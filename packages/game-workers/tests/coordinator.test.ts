import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkTaskKind, createWorkerCoordinator, defineResidentKind, defineTaskKind, inThreadSpawn, WorkerTaskCancelled, WorkerTaskDropped } from '../src'
import type { Spawn, WorkerLike } from '../src'
import { nodeSpawn } from '../src/node'
// @ts-expect-error -- a plain JS fixture (the worker_threads worker loads the same file), typed by its use below
import { crash, scaler, waves } from './fixtures/kinds.mjs'

interface WavesIn {
  readonly n: number
  readonly seed: number
}
interface WavesOut {
  readonly heights: Float32Array
  readonly sum: number
}
const wavesKind = waves as ReturnType<typeof defineTaskKind<WavesIn, WavesOut>>
const scalerKind = scaler as ReturnType<typeof defineResidentKind<{ factor: number; offset: number }, Float64Array, Float64Array>>
const crashKind = crash as ReturnType<typeof defineTaskKind<{ value: number; inWorker?: boolean }, number>>

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const double = defineTaskKind<number, number>({ id: 'test.double', lane: 'sim', priority: 1, latencyFrames: 1, late: 'sync', run: (n) => n * 2 })

/** A worker that never answers: every job of it is late. */
const silentSpawn: Spawn = () => {
  const worker: WorkerLike = { onmessage: null, onerror: null, postMessage: () => undefined, terminate: () => undefined }
  return worker
}

describe('createWorkerCoordinator', () => {
  it('rejects a sim kind whose late rule is not sync, and a bad id', () => {
    expect(() => defineTaskKind({ id: 'test.bad', lane: 'sim', priority: 1, late: 'drop', run: () => 0 })).toThrow(/sync/)
    expect(() => defineTaskKind({ id: 'Bad', lane: 'build', priority: 1, late: 'sync', run: () => 0 })).toThrow(/package\.thing/)
  })

  it('with no worker runs the kernel at collect, and never before the due frame', () => {
    const workers = createWorkerCoordinator()
    expect(workers.plan.total).toBe(0)
    const handle = workers.submit(double, 21, { frame: 10 })
    expect(handle.dueFrame).toBe(11)
    expect(() => handle.collect(10)).toThrow(/before its due frame/)
    expect(handle.collect(11)).toBe(42)
    expect(handle.source).toBe('main')
    expect(handle.collect(12)).toBe(42)
    expect(workers.stats().kinds[0]).toMatchObject({ id: 'test.double', submitted: 1, fallback: 1, onTime: 0 })
  })

  it('takes the worker answer when it is back in time', async () => {
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([wavesKind]), workers: 2 })
    await workers.warm([wavesKind])
    const handle = workers.submit(wavesKind, { n: 64, seed: 7 }, { frame: 0 })
    await tick(5)
    const out = handle.collect(2)
    expect(handle.source).toBe('worker')
    expect(out.heights).toEqual(wavesKind.run({ n: 64, seed: 7 }).heights)
    expect(workers.stats().kinds.find((k) => k.id === 'test.waves')).toMatchObject({ onTime: 1, fallback: 0 })
    workers.dispose()
  })

  it('a late worker: the kernel runs here, the same bytes, and the late answer is thrown away', async () => {
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([wavesKind], { delayMs: 30 }), workers: 1 })
    const handle = workers.submit(wavesKind, { n: 32, seed: 3 }, { frame: 5 })
    const out = handle.collect(7)
    expect(handle.source).toBe('main')
    await tick(60)
    expect(handle.collect(8)).toBe(out)
    expect(handle.source).toBe('main')
    const stats = workers.stats().kinds.find((k) => k.id === 'test.waves')
    expect(stats).toMatchObject({ onTime: 0, fallback: 1 })
    expect(workers.stats().running).toBe(0)
    workers.dispose()
  })

  it('orders the queue by priority, then by the nearest due frame', async () => {
    const order: string[] = []
    const make = (id: string, priority: number) => defineTaskKind<string, string>({ id: `test.${id}`, lane: 'sim', priority, latencyFrames: 3, late: 'sync', run: (s) => (order.push(s), s) })
    const low = make('low', 1)
    const high = make('high', 9)
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([low, high]), workers: 1, inFlightPerWorker: 1 })
    const blocker = workers.submit(low, 'first', { frame: 0 })
    const a = workers.submit(low, 'low-late', { frame: 2 })
    const b = workers.submit(low, 'low-soon', { frame: 1 })
    const c = workers.submit(high, 'high', { frame: 2 })
    await tick(20)
    for (const h of [blocker, a, b, c]) h.collect(10)
    expect(order).toEqual(['first', 'high', 'low-soon', 'low-late'])
    workers.dispose()
  })

  it('build jobs resolve their promise; drop rejects with no worker; cancel leaves the queue', async () => {
    const triple = defineTaskKind<number, number>({ id: 'test.triple', lane: 'build', priority: 1, late: 'sync', run: (n) => n * 3 })
    const far = defineTaskKind<number, number>({ id: 'test.far', lane: 'background', priority: 1, late: 'drop', run: (n) => n })
    const none = createWorkerCoordinator()
    await expect(none.run(triple, 5)).resolves.toBe(15)
    await expect(none.run(far, 1)).rejects.toBeInstanceOf(WorkerTaskDropped)

    const workers = createWorkerCoordinator({ spawn: silentSpawn, workers: 1, inFlightPerWorker: 1 })
    void workers.run(triple, 1)
    const controller = new AbortController()
    const queued = workers.run(triple, 2, controller.signal)
    controller.abort()
    await expect(queued).rejects.toBeInstanceOf(WorkerTaskCancelled)
    expect(workers.stats().queued).toBe(0)
    workers.dispose()
  })

  it('lets the game change a kind schedule by id, checked', () => {
    const workers = createWorkerCoordinator({ kinds: { 'test.double': { priority: 77, latencyFrames: 4 } } })
    expect(workers.scheduleOf(double)).toMatchObject({ priority: 77, latencyFrames: 4, lane: 'sim' })
    expect(workers.submit(double, 1, { frame: 0 }).dueFrame).toBe(4)
    const bad = createWorkerCoordinator({ kinds: { 'test.double': { late: 'drop' } } })
    expect(() => bad.submit(double, 1)).toThrow(/sync/)
  })

  it('a resident steps in order on its worker, and on the main thread when it is late', async () => {
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([scalerKind]), workers: 1 })
    const resident = workers.resident(scalerKind, { factor: 2, offset: 1 })
    const a = resident.step(Float64Array.of(1, 2), { frame: 0 })
    const b = resident.step(Float64Array.of(3), { frame: 1 })
    await tick(10)
    expect([...a.collect(1)]).toEqual([3, 5])
    expect([...b.collect(2)]).toEqual([7])
    expect(a.source).toBe('worker')
    const late = resident.step(Float64Array.of(10), { frame: 2 })
    expect([...late.collect(3)]).toEqual([21])
    expect(late.source).toBe('main')
    resident.dispose()
    workers.dispose()
  })

  it('transferAwaitedInput: an awaited sync job transfers its input; collected jobs and other kinds still copy it; a failed one rejects', async () => {
    const sum = (input: Float64Array): number => input.reduce((a, b) => a + b, 0)
    const moving = defineTaskKind<Float64Array, number>({ id: 'test.moving', lane: 'sim', priority: 1, late: 'sync', run: sum, transferInput: (input) => [input.buffer as ArrayBuffer], transferAwaitedInput: true })
    const copying = defineTaskKind<Float64Array, number>({ id: 'test.copying', lane: 'sim', priority: 1, late: 'sync', run: sum, transferInput: (input) => [input.buffer as ArrayBuffer] })
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([moving, copying]), workers: 1 })
    const moved = Float64Array.of(1, 2, 3)
    await expect(workers.run(moving, moved)).resolves.toBe(6)
    expect(moved.length).toBe(0)
    const kept = Float64Array.of(1, 2)
    await expect(workers.run(copying, kept)).resolves.toBe(3)
    expect(kept.length).toBe(2)
    const collected = Float64Array.of(4, 5)
    const handle = workers.submit(moving, collected, { frame: 0 })
    await tick(5)
    expect(handle.collect(1)).toBe(9)
    expect(collected.length).toBe(2)
    workers.dispose()

    // a worker that cannot run it: a copied sync job runs here, a transferred one rejects (its input is gone)
    const unknowing = createWorkerCoordinator({ spawn: inThreadSpawn([]), workers: 1 })
    await expect(unknowing.run(copying, Float64Array.of(1, 1))).resolves.toBe(2)
    await expect(unknowing.run(moving, Float64Array.of(1, 1))).rejects.toThrow(/no task kind/)
    expect(unknowing.stats().kinds.find((k) => k.id === 'test.moving')).toMatchObject({ failed: 1, fallback: 0 })
    unknowing.dispose()
    // with no worker it is never sent: it runs here, input and all
    await expect(createWorkerCoordinator().run(moving, Float64Array.of(2, 2))).resolves.toBe(4)
  })

  it('warm says which kinds a worker does not know', async () => {
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([wavesKind]), workers: 1 })
    await expect(workers.warm([wavesKind, double])).rejects.toThrow(/test\.double/)
    workers.dispose()
  })
})

describe('worker_threads', () => {
  const script = new URL('./fixtures/node-worker.mjs', import.meta.url)

  it('gives the same bytes as the main thread (checkTaskKind)', async () => {
    const samples = [{ n: 1, seed: 0 }, { n: 257, seed: 99 }, { n: 4096, seed: 123456789 }]
    const report = await checkTaskKind(wavesKind, samples, [nodeSpawn(fileURLToPath(script))])
    expect(report.problems).toEqual([])
  })

  it('a worker that dies is replaced and its jobs run again', async () => {
    const workers = createWorkerCoordinator({ spawn: nodeSpawn(fileURLToPath(script)), workers: 1 })
    await workers.warm([crashKind])
    // the job kills its worker; the replacement gets it again and dies again; then the main thread runs it
    await expect(workers.run(crashKind, { value: 4, inWorker: true })).resolves.toBe(8)
    expect(workers.stats().respawned).toBe(2)
    expect(workers.stats().kinds.find((k) => k.id === 'test.crash')).toMatchObject({ fallback: 1 })
    await expect(workers.run(crashKind, { value: 5 })).resolves.toBe(10)
    workers.dispose()
  }, 15_000)
})
