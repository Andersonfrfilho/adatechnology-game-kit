import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, OCCLUSION_DEFAULTS, createAudioEngine, createOcclusionTracker } from '../src'
import type { OcclusionHit, OcclusionQuery, OcclusionSetup } from '../src'

const BRICK: OcclusionHit = { material: 'brick', thickness: 0.12 }
const GLASS: OcclusionHit = { material: 'glass', thickness: 0.004 }

/** A query that takes `cost` ms on a clock the test owns: each call moves the clock on. */
function timedQuery(cost: number, answer: OcclusionQuery): { readonly setup: Pick<OcclusionSetup, 'query' | 'clock'>; readonly calls: () => number } {
  let time = 0
  let calls = 0
  return {
    setup: {
      clock: () => time,
      query: (from, to) => {
        calls++
        time += cost
        return answer(from, to)
      },
    },
    calls: () => calls,
  }
}

// a wall for sources left of x = 0, glass between 0 and 10, nothing beyond: each source has its own loss
const layered: OcclusionQuery = (from) => (from[0] < 0 ? [BRICK] : from[0] < 10 ? [GLASS] : [])
const SOURCES: readonly (readonly [number, number, number])[] = [
  [-6, 0, 0],
  [4, 0, 0],
  [-12, 0, 3],
  [15, 0, 0],
  [8, 0, -4],
  [-3, 0, 9],
]
const LISTENER: [number, number, number] = [0, 0, 20]

describe('the occlusion tracker, time budget', () => {
  it('has a typed default of one millisecond a frame', () => {
    expect(OCCLUSION_DEFAULTS.budgetMs).toBe(1)
  })

  it('add never queries once the frame has spent its milliseconds: the voice starts at a guess', () => {
    const timed = timedQuery(2, layered)
    const tracker = createOcclusionTracker({ ...timed.setup, budget: 10, budgetMs: 1 })
    tracker.add({ id: 1, source: [-6, 0, 0], level: 1, listener: LISTENER, now: 0 })
    expect(timed.calls()).toBe(1)
    // the one query took 2 ms of a 1 ms budget: the rest wait, whatever the count budget says
    for (let id = 2; id <= 6; id++) tracker.add({ id, source: SOURCES[id - 1] as [number, number, number], level: 1, listener: LISTENER, now: 0 })
    expect(timed.calls()).toBe(1)
  })

  it('with no milliseconds at all, add only guesses', () => {
    const timed = timedQuery(0.01, layered)
    const tracker = createOcclusionTracker({ ...timed.setup, budgetMs: 0 })
    const state = tracker.add({ id: 1, source: [-6, 0, 0], level: 1, listener: LISTENER, now: 0 })
    expect(timed.calls()).toBe(0)
    expect(state.lossDb).toBe(0)
  })

  it('update measures the waiting voices within the milliseconds, at least one a frame, oldest first', () => {
    const timed = timedQuery(0.4, layered)
    const tracker = createOcclusionTracker({ ...timed.setup, budget: 10, budgetMs: 1, interval: 10 })
    tracker.update(LISTENER, 0)
    SOURCES.forEach((source, index) => tracker.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 }))
    // 0.4 ms each: add queries only while one more fits in the 1 ms (0.4, 0.8; a third would end at 1.2)
    expect(timed.calls()).toBe(2)
    const measured: number[] = []
    for (let frame = 1; frame <= 3; frame++) {
      const before = timed.calls()
      tracker.update(LISTENER, frame * 0.016)
      measured.push(timed.calls() - before)
    }
    // update queries while the frame has time left (0, 0.4, 0.8 ms spent before each), then the last one the next frame
    expect(measured).toEqual([3, 1, 0])
    const slow = timedQuery(5, layered)
    const heavy = createOcclusionTracker({ ...slow.setup, budget: 10, budgetMs: 1, interval: 10 })
    heavy.add({ id: 1, source: [-6, 0, 0], level: 1, listener: LISTENER, now: 0 })
    for (let id = 2; id <= 4; id++) heavy.add({ id, source: SOURCES[id - 1] as [number, number, number], level: 1, listener: LISTENER, now: 0 })
    // one 5 ms query a frame: never more than one, never none, until every voice has its measure
    const perFrame: number[] = []
    for (let frame = 1; frame <= 4; frame++) {
      const before = slow.calls()
      heavy.update(LISTENER, frame * 0.016)
      perFrame.push(slow.calls() - before)
    }
    expect(perFrame).toEqual([1, 1, 1, 0])
  })

  it('a voice measured late ends exactly where the old synchronous measure put it', () => {
    const synchronous = createOcclusionTracker({ query: layered, budget: 100, budgetMs: Infinity })
    const timed = timedQuery(3, layered)
    const deferred = createOcclusionTracker({ ...timed.setup, budget: 100, budgetMs: 1, interval: 10 })
    deferred.update(LISTENER, 0)
    SOURCES.forEach((source, index) => {
      synchronous.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 })
      deferred.add({ id: index + 1, source: [...source], level: 1, listener: LISTENER, now: 0 })
    })
    for (let frame = 1; frame <= SOURCES.length; frame++) deferred.update(LISTENER, frame * 0.016)
    SOURCES.forEach((_, index) => {
      const id = index + 1
      expect(deferred.state(id), `voice ${id}`).toEqual(synchronous.state(id))
    })
    // the voices do not all share one loss, so matching states is not a coincidence of one answer
    expect(synchronous.state(2)?.lossDb).not.toBe(synchronous.state(1)?.lossDb)
  })

  it('a slow query makes the next add wait for update; cheap ones bring add back to measuring at once, and every voice ends at its measure', () => {
    let cost = 0.05
    let time = 0
    let calls = 0
    const query: OcclusionQuery = (from, to) => {
      calls++
      time += cost
      return layered(from, to)
    }
    const tracker = createOcclusionTracker({ query, clock: () => time, budget: 100, budgetMs: 1, interval: 10 })
    const synchronous = createOcclusionTracker({ query: layered, budget: 100, budgetMs: Infinity, interval: 10 })
    let id = 0
    const play = (source: [number, number, number], frame: number): boolean => {
      id++
      const before = calls
      tracker.add({ id, source, level: 1, listener: LISTENER, now: frame * 0.016 })
      synchronous.add({ id, source, level: 1, listener: LISTENER, now: frame * 0.016 })
      return calls > before
    }
    // the first query of the session always runs, and cheap ones stay synchronous
    expect(play([-6, 0, 0], 0)).toBe(true)
    expect(play([4, 0, 0], 0)).toBe(true)
    // a vehicle on the path: 300 ms, measured at once because nothing said it would be slow
    cost = 300
    tracker.update(LISTENER, 0.016)
    expect(play([-12, 0, 3], 1)).toBe(true)
    // the next frame has its whole millisecond, but a query has been costing far more: the voice waits for update
    cost = 0.05
    tracker.update(LISTENER, 0.032)
    expect(play([15, 0, 0], 2)).toBe(false)
    expect(play([8, 0, -4], 2)).toBe(false)
    // update still measures, at least one a frame; the cheap answers bring the running cost back under the budget
    let frame = 3
    for (; frame < 40; frame++) {
      tracker.update(LISTENER, frame * 0.016)
      if (play([-3, 0, 9 + frame], frame)) break
    }
    expect(frame).toBeLessThan(40)
    for (let more = 0; more < 5; more++) tracker.update(LISTENER, (frame + 1 + more) * 0.016)
    for (let voice = 1; voice <= id; voice++) expect(tracker.state(voice), `voice ${voice}`).toEqual(synchronous.state(voice))
  })

  it('a guess within half a decibel of the measure still takes the measure', () => {
    const near: OcclusionHit = { lossDb: 42.2 }
    const query: OcclusionQuery = (from) => (from[0] < 0.5 ? [BRICK] : [near])
    const tracker = createOcclusionTracker({ query, budget: 1, budgetMs: Infinity, interval: 10 })
    tracker.add({ id: 1, source: [0, 0, 0], level: 1, listener: LISTENER, now: 0 })
    const guessed = tracker.add({ id: 2, source: [1, 0, 0], level: 1, listener: LISTENER, now: 0 })
    expect(guessed.lossDb).toBe(42)
    const changes = tracker.update(LISTENER, 0.016)
    expect(changes.map((change) => change.id)).toEqual([2])
    expect(tracker.state(2)?.lossDb).toBeCloseTo(42.2, 9)
  })
})

describe('the engine attaches a voice without querying once the frame is spent', () => {
  it('play past the milliseconds starts from the guess, and the listener update measures it to the same loss', () => {
    const timed = timedQuery(2, () => [BRICK])
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ banks: [GAME_SFX_BANK], createContext: () => recorder.context, occlusion: { ...timed.setup, budget: 10, budgetMs: 1, interval: 10 } })
    engine.play('sfx_pistol', { position: [10, 0, 0] })
    expect(timed.calls()).toBe(1)
    engine.play('sfx_pistol', { position: [40, 0, 0] })
    expect(timed.calls()).toBe(1)
    expect(engine.occludedVoices().map((voice) => voice.lossDb)).toEqual([42, 0])
    engine.setListener({ position: [0, 0, 0], yaw: 0 })
    expect(timed.calls()).toBe(2)
    expect(engine.occludedVoices().map((voice) => voice.lossDb)).toEqual([42, 42])
  })
})
