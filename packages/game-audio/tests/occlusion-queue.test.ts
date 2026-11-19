import { DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createOcclusionTracker } from '../src'
import type { OcclusionHit, OcclusionQuery } from '../src'

const BRICK: OcclusionHit = { material: 'brick', thickness: 0.12 }
const GLASS: OcclusionHit = { material: 'glass', thickness: 0.004 }
const layered: OcclusionQuery = (from) => (from[0] < 0 ? [BRICK] : from[0] < 10 ? [GLASS] : [])
const LISTENER: [number, number, number] = [0, 0, 20]
const SOURCES: readonly [number, number, number][] = [
  [-6, 0, 0],
  [4, 0, 0],
  [-12, 0, 3],
  [15, 0, 0],
]

const fill = (tracker: ReturnType<typeof createOcclusionTracker>): void => {
  SOURCES.forEach((source, index) => tracker.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 }))
}

describe('the occlusion queue', () => {
  it('keeps the DeferredQueue contract, with no budget attached', () => {
    const tracker = createOcclusionTracker({ query: layered, budget: 1, interval: 10 })
    const queue = tracker.deferredQueue()
    expect(queue.id).toBe(DEFERRED_QUEUE_ID.AUDIO_OCCLUSION)
    const report = checkDeferredQueue(queue, () => fill(tracker))
    expect(report.problems).toEqual([])
  })

  it('keeps the DeferredQueue contract once attached', () => {
    const tracker = createOcclusionTracker({ query: layered, budget: 10, interval: 10 })
    const queue = tracker.deferredQueue()
    queue.attach?.()
    expect(checkDeferredQueue(queue, () => fill(tracker)).problems).toEqual([])
  })

  it('attached, add never queries: every voice starts at the guess and the queue measures it, one unit one query', () => {
    let calls = 0
    const tracker = createOcclusionTracker({
      query: (from, to) => {
        calls++
        return layered(from, to)
      },
      budget: 10,
      interval: 10,
    })
    const queue = tracker.deferredQueue()
    queue.attach?.()
    fill(tracker)
    expect(calls).toBe(0)
    expect(queue.pending()).toBe(SOURCES.length)
    expect(queue.run(0, () => 1)).toBe(1)
    expect(calls).toBe(1)
    queue.flush()
    expect(calls).toBe(SOURCES.length)
    expect(queue.pending()).toBe(0)
  })

  it('attached, a voice the queue measures ends exactly where a synchronous measure puts it, reported by the next update', () => {
    const synchronous = createOcclusionTracker({ query: layered, budget: 100, budgetMs: Infinity, interval: 10 })
    const tracker = createOcclusionTracker({ query: layered, budget: 100, interval: 10 })
    const queue = tracker.deferredQueue()
    queue.attach?.()
    tracker.update(LISTENER, 0)
    SOURCES.forEach((source, index) => {
      synchronous.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 })
      tracker.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 })
    })
    queue.flush()
    const changes = tracker.update(LISTENER, 0.016)
    expect(changes.length).toBeGreaterThan(0)
    SOURCES.forEach((_, index) => expect(tracker.state(index + 1), `voice ${index + 1}`).toEqual(synchronous.state(index + 1)))
  })

  it('a window offers at most `budget` queries to the queue', () => {
    const tracker = createOcclusionTracker({ query: layered, budget: 2, interval: 10 })
    const queue = tracker.deferredQueue()
    queue.attach?.()
    fill(tracker)
    tracker.update(LISTENER, 0.016)
    expect(queue.pending()).toBe(SOURCES.length)
    queue.run(Infinity, () => 0)
    expect(queue.pending()).toBe(0)
    tracker.update(LISTENER, 0.032)
    expect(queue.pending()).toBe(2)
  })

  it('detached, update still measures within the milliseconds, at least one a frame, through the same queue', () => {
    let time = 0
    let calls = 0
    const tracker = createOcclusionTracker({
      clock: () => time,
      query: (from, to) => {
        calls++
        time += 0.4
        return layered(from, to)
      },
      budget: 10,
      budgetMs: 1,
      interval: 10,
    })
    const queue = tracker.deferredQueue()
    queue.attach?.()
    queue.detach?.()
    tracker.update(LISTENER, 0)
    fill(tracker)
    expect(calls).toBe(2)
    tracker.update(LISTENER, 0.016)
    expect(calls).toBe(4)
  })
})
