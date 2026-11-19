import { describe, expect, it } from 'vitest'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import { createFrameBudget, createScheduler, startLoop } from '../src'
import type { Scheduler } from '../src'

type Clock = { now: () => number; advance: (ms: number) => void }
const makeClock = (): Clock => {
  let time = 0
  return { now: () => time, advance: (ms) => (time += ms) }
}

/** A queue whose unit number `n` costs `cost(n)` on the fake clock; `units` of them, then empty. */
const makeQueue = (id: string, clock: Clock, cost: number | ((index: number) => number), units = Infinity): DeferredQueue & { ran: number } => {
  let done = 0
  const queue = {
    id,
    ran: 0,
    pending: () => Math.max(0, units - done),
    run(deadline: number, now: () => number) {
      let ran = 0
      while (done < units && (ran === 0 || now() < deadline)) {
        clock.advance(typeof cost === 'number' ? cost : cost(done))
        done++
        ran++
      }
      queue.ran += ran
      return ran
    },
    flush: () => (done = units),
  }
  return queue
}

const mulberry32 = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const makeDeadlineBudget = (clock: Clock, extra: { ms?: number; targetMs?: number; minMs?: number } = {}) =>
  createFrameBudget({ ms: 8, targetMs: 16.6, clock: clock.now, ...extra })

describe('deadline mode', () => {
  it('1: without targetMs the budget is the quota and says so', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    budget.register(makeQueue('q', clock, 1), { priority: 1 })
    budget.beginFrame(clock.now())
    budget.drain('present')
    budget.drain('idle')
    expect(budget.mode).toBe('quota')
    expect(budget.stats()).toMatchObject({ mode: 'quota', targetMs: undefined, allowanceMs: 4, spentMs: 4, mustDrainSpentMs: 0 })
  })

  it('2: gives what is left until the deadline after the simulation and the render estimate', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock)
    const queue = makeQueue('q', clock, 1)
    budget.register(queue, { priority: 1, phase: 'present' })
    budget.beginFrame(clock.now())
    budget.recordRender(3)
    budget.drain('present')
    budget.beginFrame(clock.now())
    clock.advance(10)
    budget.drain('present')
    const stats = budget.stats()
    expect(stats.mode).toBe('deadline')
    expect(stats.targetMs).toBe(16.6)
    expect(stats.allowanceMs).toBeCloseTo(3.6)
    expect(stats.renderEstimateMs).toBe(3)
    expect(stats.spentMs).toBe(4)
    expect(stats.overMs).toBeCloseTo(0.4)
    expect(stats.overMs).toBeLessThanOrEqual(1)
  })

  it('3: with no simulation and no render the allowance is the ceiling', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock)
    budget.register(makeQueue('q', clock, 1), { priority: 1 })
    budget.beginFrame(clock.now())
    budget.drain('present')
    budget.drain('idle')
    expect(budget.stats()).toMatchObject({ allowanceMs: 8, spentMs: 8, overMs: 0 })
  })

  it('4: a simulation past the deadline leaves the floor, and a unit may cross it', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock)
    budget.register(makeQueue('q', clock, 2), { priority: 1 })
    budget.beginFrame(clock.now())
    clock.advance(20)
    budget.drain('present')
    budget.drain('idle')
    const stats = budget.stats()
    expect(stats.allowanceMs).toBe(1)
    expect(stats.spentMs).toBe(2)
    expect(stats.overMs).toBe(1)
  })

  it('5: the render estimate is a moving average of weight 0.125, seeded by the first sample; a frame without render leaves it', () => {
    const clock = makeClock()
    const scheduler = createScheduler({ clock: clock.now, budgetMs: 8, targetMs: 16.6 })
    let renderMs = 2
    scheduler.add(() => clock.advance(renderMs), { phase: 'render' })
    const estimates: number[] = []
    for (const ms of [2, 2, 2, 10]) {
      renderMs = ms
      scheduler.frame(1 / 60, { frameStartMs: clock.now() })
      estimates.push(scheduler.stats().budget.renderEstimateMs)
    }
    expect(estimates[0]).toBe(2)
    expect(estimates[2]).toBe(2)
    expect(estimates[3]).toBeCloseTo(3)
    scheduler.frame(1 / 60, { render: false, frameStartMs: clock.now() })
    expect(scheduler.stats().budget.renderEstimateMs).toBeCloseTo(3)
  })

  it('5b: a sample is clamped to [0, targetMs]; a skipped sample leaves the average', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock)
    budget.recordRender(500)
    expect(budget.stats().renderEstimateMs).toBe(16.6)
    const fresh = makeDeadlineBudget(makeClock())
    fresh.recordRender(-1)
    expect(fresh.stats().renderEstimateMs).toBe(0)
    fresh.recordRender(Number.NaN)
    fresh.recordRender(4)
    fresh.beginFrame(0)
    fresh.skipRenderSample()
    fresh.recordRender(10)
    expect(fresh.stats().renderEstimateMs).toBeCloseTo(0.5)
  })

  it('5c: a system of the render phase can drop the frame sample (pacer skipped the render, warm-up ran)', () => {
    const clock = makeClock()
    const scheduler = createScheduler({ clock: clock.now, budgetMs: 8, targetMs: 16.6 })
    let isTypical = true
    scheduler.add(() => (isTypical ? clock.advance(2) : (clock.advance(9), scheduler.budget.skipRenderSample())), { phase: 'render' })
    scheduler.frame(1 / 60, { frameStartMs: clock.now() })
    isTypical = false
    scheduler.frame(1 / 60, { frameStartMs: clock.now() })
    expect(scheduler.stats().budget.renderEstimateMs).toBe(2)
  })

  it('6: the idle drain gets only up to the real deadline after a render bigger than the estimate; the floor holds for the frame', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock)
    budget.recordRender(2)
    const idle = makeQueue('idle', clock, 1)
    budget.register(idle, { priority: 1, phase: 'idle' })
    budget.beginFrame(clock.now())
    budget.drain('present')
    clock.advance(13)
    budget.drain('idle')
    expect(budget.stats().allowanceMs).toBe(8)
    expect(idle.ran).toBe(4)
    expect(budget.stats().spentMs).toBe(4)

    const lateClock = makeClock()
    const floorBudget = makeDeadlineBudget(lateClock)
    const present = makeQueue('present', lateClock, 0.5, 1)
    const after = makeQueue('after', lateClock, 0.25)
    floorBudget.register(present, { priority: 2, phase: 'present' })
    floorBudget.register(after, { priority: 1, phase: 'idle' })
    floorBudget.beginFrame(lateClock.now())
    floorBudget.drain('present')
    lateClock.advance(20)
    floorBudget.drain('idle')
    expect(after.ran).toBe(2)
  })

  it('7 and 19: the reserve comes out of the floor and holds with the allowance at the floor; the reserves may not pass the floor', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { minMs: 1 })
    const present = makeQueue('present', clock, 10)
    const voices = makeQueue('voices', clock, 0.25)
    budget.register(present, { priority: 300, phase: 'present', minEveryFrames: 1 })
    budget.register(voices, { priority: 200, phase: 'idle', reserveMs: 1 })
    expect(() => budget.register(makeQueue('greedy', clock, 1), { priority: 1, reserveMs: 0.5 })).toThrow(/floor/)
    budget.beginFrame(clock.now())
    clock.advance(20)
    budget.drain('present')
    budget.drain('idle')
    expect(budget.stats().allowanceMs).toBe(1)
    expect(voices.ran).toBe(4)
    expect(present.ran).toBe(1)
  })

  it('8: the starvation guard forces one unit every minEveryFrames and counts it', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { ms: 4 })
    const high = makeQueue('high', clock, 1)
    const low = makeQueue('low', clock, 1)
    budget.register(high, { priority: 10 })
    budget.register(low, { priority: 1, minEveryFrames: 4 })
    const forcedFrames: number[] = []
    let forcedCosts: number[] = []
    for (let frame = 0; frame < 12; frame++) {
      budget.beginFrame(clock.now())
      budget.drain('present')
      budget.drain('idle')
      if (budget.stats().forcedThisFrame > 0) forcedFrames.push(frame)
      forcedCosts = [...forcedCosts, ...budget.stats().forcedMs]
    }
    expect(low.ran).toBe(3)
    expect(forcedFrames).toHaveLength(3)
    expect(forcedCosts).toEqual([1, 1, 1])
    expect(budget.stats().queues.find((entry) => entry.id === 'low')?.forced).toBe(3)
  })

  it('9: debt exists in quota, not in deadline, and the allowance never falls under the floor', () => {
    const quotaClock = makeClock()
    const quota = createFrameBudget({ ms: 4, clock: quotaClock.now })
    quota.register(makeQueue('q', quotaClock, 10), { priority: 1 })
    quota.beginFrame()
    quota.drain('idle')
    expect(quota.stats().debtMs).toBe(4)
    quota.beginFrame()
    expect(quota.stats().allowanceMs).toBe(0)

    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { ms: 4 })
    budget.register(makeQueue('q', clock, 10), { priority: 1 })
    for (let frame = 0; frame < 3; frame++) {
      budget.beginFrame(clock.now())
      budget.drain('present')
      budget.drain('idle')
      expect(budget.stats().debtMs).toBe(0)
      expect(budget.stats().allowanceMs).toBeGreaterThanOrEqual(1)
    }
  })

  it('11: a targetMs changed while running is used by the next frame', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { ms: 20 })
    budget.beginFrame(clock.now())
    budget.drain('present')
    expect(budget.stats()).toMatchObject({ targetMs: 16.6, allowanceMs: 16.6 })
    budget.targetMs = 6.94
    budget.beginFrame(clock.now())
    budget.drain('present')
    expect(budget.stats()).toMatchObject({ targetMs: 6.94, allowanceMs: 6.94 })
  })

  it('12: a queue with minEveryFrames 1 runs in every frame with work, with the deadline spent', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { ms: 4 })
    const hog = makeQueue('hog', clock, 1)
    const work = makeQueue('work', clock, 1)
    budget.register(hog, { priority: 10 })
    budget.register(work, { priority: 1, minEveryFrames: 1 })
    for (let frame = 0; frame < 5; frame++) {
      budget.beginFrame(clock.now())
      budget.drain('present')
      budget.drain('idle')
    }
    expect(work.ran).toBe(5)
  })

  it('13: the C2 holds for 1000 random frames: spent <= max(left, floor) + one crossing unit + the forced units', () => {
    const random = mulberry32(20260719)
    const clock = makeClock()
    const target = 16.6
    const budget = makeDeadlineBudget(clock, { ms: 8, minMs: 1 })
    const unitMax = 3
    const unitCost = (): number => 0.1 + random() * (unitMax - 0.1)
    const queues = [
      makeQueue('present.a', clock, unitCost),
      makeQueue('present.b', clock, unitCost),
      makeQueue('idle.a', clock, unitCost),
      makeQueue('idle.b', clock, unitCost),
      makeQueue('idle.c', clock, unitCost),
    ]
    budget.register(queues[0] as DeferredQueue, { priority: 300, phase: 'present', minEveryFrames: 3 })
    budget.register(queues[1] as DeferredQueue, { priority: 250, phase: 'present', minEveryFrames: 5 })
    budget.register(queues[2] as DeferredQueue, { priority: 200, phase: 'idle', minEveryFrames: 2 })
    budget.register(queues[3] as DeferredQueue, { priority: 100, phase: 'idle', minEveryFrames: 4 })
    budget.register(queues[4] as DeferredQueue, { priority: 50, phase: 'idle', minEveryFrames: 8 })
    let estimate = 0
    let isSeeded = false
    let forcedFrames = 0
    let overFrames = 0
    for (let frame = 0; frame < 1000; frame++) {
      const start = clock.now()
      budget.beginFrame(start)
      clock.advance(random() * 20)
      const left = start + target - estimate - clock.now()
      budget.drain('present')
      clock.advance(random() * 12)
      const renderMs = Math.min(Math.max(random() * 12, 0), target)
      budget.recordRender(renderMs)
      estimate = isSeeded ? estimate + (renderMs - estimate) * 0.125 : renderMs
      isSeeded = true
      budget.drain('idle')
      const stats = budget.stats()
      const expectedAllowance = Math.max(1, Math.min(8, left))
      expect(stats.allowanceMs).toBeCloseTo(expectedAllowance, 9)
      const forced = stats.forcedMs.reduce((sum, ms) => sum + ms, 0)
      expect(stats.spentMs).toBeLessThanOrEqual(Math.max(expectedAllowance, 1) + unitMax + forced + 1e-9)
      expect(stats.overMs).toBeLessThanOrEqual(unitMax + forced + 1e-9)
      forcedFrames += stats.forcedThisFrame > 0 ? 1 : 0
      overFrames += stats.overMs > 0 ? 1 : 0
    }
    expect(forcedFrames).toBeGreaterThan(0)
    expect(overFrames).toBeGreaterThan(0)
  })

  it('14: advance() is unbounded as always and ignores the deadline', () => {
    const clock = makeClock()
    const scheduler = createScheduler({ clock: clock.now, budgetMs: 4, targetMs: 16.6 })
    const queue = makeQueue('q', clock, 2, 50)
    scheduler.budget.register(queue, { priority: 1 })
    scheduler.advance(1 / 60)
    expect(queue.pending()).toBe(0)
    expect(scheduler.stats().budget.mode).toBe('quota')
  })

  it('15: the scheduler passes targetMs and the floor to the budget', () => {
    const clock = makeClock()
    const plain = createScheduler({ clock: clock.now, budgetMs: 8 })
    plain.frame(1 / 60, { frameStartMs: clock.now() })
    expect(plain.stats().budget).toMatchObject({ mode: 'quota', targetMs: undefined, ms: 8 })

    const timed = createScheduler({ clock: clock.now, budgetMs: 8, targetMs: 16.6, minBudgetMs: 2 })
    timed.frame(1 / 60, { frameStartMs: clock.now() })
    expect(timed.stats().budget).toMatchObject({ mode: 'deadline', targetMs: 16.6, allowanceMs: 8 })
    timed.budget.targetMs = 5
    timed.add(() => clock.advance(30), { phase: 'lateSimulate' })
    timed.frame(1 / 60, { frameStartMs: clock.now() })
    expect(timed.stats().budget.allowanceMs).toBe(2)
  })

  it('16: a frame without frameStartMs is the quota, with debt, even with targetMs', () => {
    const clock = makeClock()
    const scheduler = createScheduler({ clock: clock.now, budgetMs: 4, targetMs: 16.6 })
    scheduler.budget.register(makeQueue('q', clock, 10), { priority: 1, phase: 'present' })
    scheduler.frame(1 / 60, { render: false, exact: true })
    expect(scheduler.stats().budget).toMatchObject({ mode: 'quota', targetMs: undefined, debtMs: 4 })
    scheduler.frame(1 / 60, { render: false, exact: true })
    expect(scheduler.stats().budget.allowanceMs).toBe(0)
  })

  it('17: a mustDrain queue drains whole outside the deadline, counted apart; the others fall to the floor and the guard keeps them going', () => {
    const clock = makeClock()
    const budget = makeDeadlineBudget(clock, { ms: 4, targetMs: 3 })
    const events = makeQueue('destruction.events', clock, 5, 4)
    const high = makeQueue('idle.high', clock, 1)
    const low = makeQueue('idle.low', clock, 1)
    budget.register(events, { priority: 300, phase: 'present', mustDrain: true })
    budget.register(high, { priority: 10, phase: 'idle' })
    budget.register(low, { priority: 1, phase: 'idle', minEveryFrames: 2 })
    budget.beginFrame(clock.now())
    budget.drain('present')
    budget.drain('idle')
    let stats = budget.stats()
    expect(events.pending()).toBe(0)
    expect(stats).toMatchObject({ mustDrainSpentMs: 20, allowanceMs: 1, spentMs: 1, overMs: 0 })
    expect(stats.queues.find((entry) => entry.id === 'destruction.events')).toMatchObject({ mustDrain: true, lastSpentMs: 20 })
    budget.beginFrame(clock.now())
    budget.drain('present')
    budget.drain('idle')
    stats = budget.stats()
    expect(low.ran).toBe(1)
    expect(stats.forcedThisFrame).toBe(1)
    expect(stats.mustDrainSpentMs).toBe(0)
  })

  it('18: startLoop gives the rAF timestamp as frameStartMs; a frame skipped by the cap calls nothing', () => {
    const calls: { seconds: number; frameStartMs: number | undefined; simulate: boolean | undefined }[] = []
    const scheduler = { frame: (seconds: number, run?: { frameStartMs?: number; simulate?: boolean }) => calls.push({ seconds, frameStartMs: run?.frameStartMs, simulate: run?.simulate }), resetClock: () => undefined } as unknown as Scheduler
    let callback: ((nowMs: number) => void) | undefined
    let gap = 0
    const stop = startLoop(scheduler, { startMs: 0, requestFrame: (next) => ((callback = next), 1), minFrameMs: () => gap })
    callback?.(100)
    gap = 50
    callback?.(120)
    callback?.(160)
    stop()
    expect(calls).toEqual([
      { seconds: 0.1, frameStartMs: 100, simulate: undefined },
      { seconds: 0.06, frameStartMs: 160, simulate: undefined },
    ])
  })

  it('time base: a timestamp up to one frame behind the clock counts the callback lag; another base is read as now', () => {
    const clock = makeClock()
    clock.advance(1000)
    const budget = makeDeadlineBudget(clock)
    budget.beginFrame(998)
    budget.drain('present')
    expect(budget.stats().allowanceMs).toBeCloseTo(8)
    const narrow = makeDeadlineBudget(clock, { ms: 20 })
    narrow.beginFrame(998)
    narrow.drain('present')
    expect(narrow.stats().allowanceMs).toBeCloseTo(14.6)
    const other = makeDeadlineBudget(clock, { ms: 20 })
    other.beginFrame(5_000_000)
    other.drain('present')
    expect(other.stats().allowanceMs).toBeCloseTo(16.6)
  })
})
