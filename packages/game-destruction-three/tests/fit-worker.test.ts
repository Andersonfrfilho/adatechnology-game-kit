import { describe, expect, it, vi } from 'vitest'
import type { OrientedBox, WorkerLike, WorkerScopeLike } from '@adatechnology/game-shapes'

import { computeFit } from '../src/fit-job'
import type { FitResult } from '../src/fit-job'
import { createInlineFitPort, createWorkerFitPort, installFitWorker } from '../src/fit-port'
import type { FitWorkerPort } from '../src/fit-port'
import { FIT_IN_FLIGHT, FitRelay } from '../src/fit-relay'
import { detachEvery, partBoxesOfPiece, rangedHouse } from './ranged-house'
import type { RangedHouse } from './ranged-house'

// the fits made on the main thread are counted apart from the ones the (fake) worker makes
let mainFits = 0
let inWorker = false
vi.mock('@adatechnology/game-shapes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@adatechnology/game-shapes')>()
  return { ...actual, fitOrientedBoxes: (...args: Parameters<typeof actual.fitOrientedBoxes>) => (inWorker || mainFits++, actual.fitOrientedBoxes(...args)) }
})
const { fitOrientedBoxes } = await import('@adatechnology/game-shapes')

/**
 * A worker in this thread that behaves as a real one does: every message is structured-cloned with its buffers transferred (the sender's arrays are detached), and nothing
 * arrives until `deliver` runs the worker's queue and then the main thread's (an event loop that has not come round yet is a worker that has not answered).
 */
const fakeWorker = (mode: 'answers' | 'crashes' = 'answers'): WorkerLike & { deliver(): void; terminated: boolean; posted: number } => {
  const toWorker: unknown[] = []
  const toMain: unknown[] = []
  const scope: WorkerScopeLike = { onmessage: null, postMessage: (message, transfer) => toMain.push(structuredClone(message, { transfer: transfer ?? [] })) }
  installFitWorker(scope)
  const worker = {
    onmessage: null as WorkerLike['onmessage'],
    onerror: null as WorkerLike['onerror'],
    terminated: false,
    posted: 0,
    postMessage(message: unknown, transfer?: ArrayBuffer[]) {
      if (worker.terminated) return
      worker.posted++
      toWorker.push(structuredClone(message, { transfer: transfer ?? [] }))
    },
    terminate() {
      worker.terminated = true
    },
    deliver() {
      if (worker.terminated) return
      if (mode === 'crashes') {
        toWorker.length = 0
        worker.onerror?.({ message: 'boom' })
        return
      }
      inWorker = true
      try {
        for (const job of toWorker.splice(0)) scope.onmessage?.({ data: job })
      } finally {
        inWorker = false
      }
      for (const answer of toMain.splice(0)) worker.onmessage?.({ data: answer })
    },
  }
  return worker
}

type Internals = { fittedBoxes: Map<unknown, { points: number[]; triangles: number[]; boxes: OrientedBox[] }>; fitRelay: FitRelay<unknown> | undefined }
const internals = (house: RangedHouse): Internals => house.renderer as unknown as Internals

/** Every number a value holds, depth first, as the bits of its float64: equal lists are the very same numbers (-0 and NaN included). */
const bitsOf = (value: unknown): string[] => {
  const out: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'number') out.push(new BigUint64Array(new Float64Array([v]).buffer)[0]!.toString(16))
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') for (const key of Object.keys(v).sort()) walk((v as Record<string, unknown>)[key])
  }
  walk(value)
  return out
}

/** The boxes of every piece a split of every joint gives, in split order. */
const splitBoxes = (house: RangedHouse): unknown[] => {
  detachEvery(house)
  house.renderer.deferredQueue().flush()
  return ['house', ...house.world.splits.map((s) => s.newId)].map((id) => partBoxesOfPiece(house.renderer, id))
}

const POSES = [
  { position: [12.3, 0.4, -7.1], turn: 0.37 },
  { position: [0, 0, 0], turn: 0 },
  { position: [-48.25, 3.1, 101.7], turn: -2.9 },
] as const

describe('the fit worker: the boxes of ranged parts fitted off the main thread', () => {
  it('fits the very same bits as the main thread for every part of the catalogue, at every pose, after the arrays crossed by transfer', () => {
    let compared = 0
    for (const pose of POSES) {
      const worker = fakeWorker()
      const house = rangedHouse({ copies: 2, ...pose, renderer: { fitWorker: createWorkerFitPort(worker) } })
      house.renderer.deferredQueue().flush()
      worker.deliver()
      const kept = internals(house).fittedBoxes
      expect(kept.size).toBe(house.partIds.length)
      for (const entry of kept.values()) {
        expect(bitsOf(entry.boxes)).toEqual(bitsOf(fitOrientedBoxes(entry.points, entry.triangles)))
        expect(entry.boxes.length).toBeGreaterThan(0)
        compared++
      }
    }
    expect(compared).toBe(POSES.length * 8)
  })

  it('computeFit reads the typed arrays as the number lists the main thread fits', () => {
    const points = [0.1, 0.2, 0.3, 1.7, -0.25, 0.3, 0.1, 2.2, 0.31, 1.7, 2.2, -0.29, -0, 0.5, 1e-9]
    const triangles = [0, 1, 2, 1, 3, 2, 2, 3, 4]
    const result = computeFit({ id: 1, points: Float64Array.from(points), triangles: Uint32Array.from(triangles) })
    expect(result.ok).toBe(true)
    expect(bitsOf(result.ok ? result.boxes : [])).toEqual(bitsOf(fitOrientedBoxes(points, triangles)))
  })

  it('fills the cache the split reads: the split fits on the main thread only what it fits with the cache filled there, and the pieces get the same boxes', () => {
    for (const pose of POSES) {
      const worker = fakeWorker()
      const withWorker = rangedHouse({ ...pose, renderer: { fitWorker: createWorkerFitPort(worker) } })
      const reference = rangedHouse({ ...pose })
      reference.renderer.deferredQueue().flush()
      // what the split fits even with every part fitted ahead: the loose pieces read in their own frame, not the house's
      const referenceStart = mainFits
      const referenceBoxes = splitBoxes(reference)
      const referenceSplitFits = mainFits - referenceStart
      const before = mainFits
      withWorker.renderer.deferredQueue().flush()
      expect(mainFits).toBe(before)
      expect(worker.posted).toBe(1 + withWorker.partIds.length)
      worker.deliver()
      const relay = internals(withWorker).fitRelay!
      expect(relay.stats).toMatchObject({ posted: 4, answered: 4, taken: 4, stale: 0, failed: 0 })
      const boxes = splitBoxes(withWorker)
      expect(mainFits - before).toBe(referenceSplitFits)
      expect(bitsOf(boxes)).toEqual(bitsOf(referenceBoxes))
      expect(boxes.filter(Boolean).length).toBeGreaterThan(0)
    }
  })

  it('fits on the main thread what the worker has not answered when the house splits, and keeps that fit over the late answer', () => {
    const worker = fakeWorker()
    const slow = rangedHouse({ renderer: { fitWorker: createWorkerFitPort(worker) } })
    const reference = rangedHouse({ renderer: { fitBoxesAhead: false } })
    slow.renderer.deferredQueue().flush()
    const before = mainFits
    const boxes = splitBoxes(slow)
    expect(mainFits).toBeGreaterThan(before)
    expect(bitsOf(boxes)).toEqual(bitsOf(splitBoxes(reference)))
    const cached = new Map(internals(slow).fittedBoxes)
    worker.deliver()
    const relay = internals(slow).fitRelay!
    // the parts the split fitted keep that fit; a part it did not need (still in the house) takes the answer
    expect(relay.stats.stale).toBeGreaterThan(0)
    expect(relay.stats.taken + relay.stats.stale).toBe(4)
    for (const [mv, entry] of cached) expect(internals(slow).fittedBoxes.get(mv)).toBe(entry)
  })

  it('stops posting to a worker that crashed, terminates it, and fits on the main thread with the same result', () => {
    const worker = fakeWorker('crashes')
    const crashing = rangedHouse({ renderer: { fitWorker: createWorkerFitPort(worker) } })
    const reference = rangedHouse({ renderer: { fitBoxesAhead: false } })
    worker.deliver()
    expect(worker.terminated).toBe(true)
    const relay = internals(crashing).fitRelay!
    expect(relay.live).toBe(false)
    const posted = worker.posted
    const before = mainFits
    crashing.renderer.deferredQueue().flush()
    expect(worker.posted).toBe(posted)
    expect(mainFits - before).toBe(4)
    expect(bitsOf(splitBoxes(crashing))).toEqual(bitsOf(splitBoxes(reference)))
  })

  it('takes nothing from an answer that failed in the worker: the part is fitted at the split', () => {
    let handler: ((result: FitResult) => void) | null = null
    const failing: FitWorkerPort = {
      transport: 'inline',
      postFit: (job) => handler?.({ id: job.id, ok: false, error: 'no', points: job.points, triangles: job.triangles }),
      onFit: (h) => {
        handler = h
      },
      onFailure: () => undefined,
      dispose: () => undefined,
    }
    const house = rangedHouse({ renderer: { fitWorker: failing } })
    const reference = rangedHouse({ renderer: { fitBoxesAhead: false } })
    house.renderer.deferredQueue().flush()
    expect(internals(house).fittedBoxes.size).toBe(0)
    expect(internals(house).fitRelay!.stats.failed).toBe(4)
    expect(bitsOf(splitBoxes(house))).toEqual(bitsOf(splitBoxes(reference)))
  })

  it(`posts at most ${FIT_IN_FLIGHT} fits waiting for an answer: past that the parts are fitted here, and every one is fitted once`, () => {
    const worker = fakeWorker()
    const copies = Math.ceil((FIT_IN_FLIGHT + 8) / 4)
    const house = rangedHouse({ copies, renderer: { fitWorker: createWorkerFitPort(worker) } })
    const before = mainFits
    house.renderer.deferredQueue().flush()
    const relay = internals(house).fitRelay!
    // the warm-up fit is one of those waiting
    expect(relay.inFlight).toBe(FIT_IN_FLIGHT)
    expect(mainFits - before).toBe(house.partIds.length - (FIT_IN_FLIGHT - 1))
    worker.deliver()
    expect(relay.inFlight).toBe(0)
    expect(internals(house).fittedBoxes.size).toBe(house.partIds.length)
  })

  it('the inline port answers at once and gives the same cache as the main thread', () => {
    const inline = rangedHouse({ renderer: { fitWorker: createInlineFitPort() } })
    const reference = rangedHouse()
    inline.renderer.deferredQueue().flush()
    reference.renderer.deferredQueue().flush()
    const a = [...internals(inline).fittedBoxes.values()].map((e) => e.boxes)
    const b = [...internals(reference).fittedBoxes.values()].map((e) => e.boxes)
    expect(a.length).toBe(4)
    expect(bitsOf(a)).toEqual(bitsOf(b))
  })

  it('reuses its buffers, drops the answers of an unbound object, and keeps nothing once disposed', () => {
    const worker = fakeWorker()
    const house = rangedHouse({ renderer: { fitWorker: createWorkerFitPort(worker) } })
    worker.deliver()
    const relay = internals(house).fitRelay!
    // the warm-up's two buffers came back to the pool
    expect(relay.pooled).toBe(2)
    house.renderer.deferredQueue().flush()
    house.renderer.unbind('house')
    worker.deliver()
    expect(relay.stats.cancelled).toBe(4)
    expect(relay.stats.taken).toBe(0)
    expect(internals(house).fittedBoxes.size).toBe(0)
    expect(relay.pooled).toBeGreaterThan(0)
    expect(relay.pooled).toBeLessThanOrEqual(16)
    house.renderer.dispose()
    expect(worker.terminated).toBe(true)
    expect(worker.onmessage).toBeNull()
    expect(relay.live).toBe(false)
    expect(relay.inFlight).toBe(0)
    expect(relay.pooled).toBe(0)
  })
})
