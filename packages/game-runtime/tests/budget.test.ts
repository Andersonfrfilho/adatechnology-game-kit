import { describe, expect, it } from 'vitest'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import { createFrameBudget, createScheduler, startLoop } from '../src'

const makeClock = (): { now: () => number; advance: (ms: number) => void } => {
  let time = 0
  return { now: () => time, advance: (ms) => (time += ms) }
}

/** A queue whose every unit costs `unitMs` on the fake clock and that never empties unless `units` runs out. */
const makeQueue = (id: string, clock: ReturnType<typeof makeClock>, unitMs: number, units = Infinity): DeferredQueue & { ran: number; calls: number; attached: number; detached: number } => {
  const queue = {
    id,
    ran: 0,
    calls: 0,
    attached: 0,
    detached: 0,
    pending: () => units,
    run(deadline: number, now: () => number) {
      queue.calls++
      let ran = 0
      while (units > 0 && (ran === 0 || now() < deadline)) {
        clock.advance(unitMs)
        units--
        ran++
      }
      queue.ran += ran
      return ran
    },
    flush: () => (units = 0),
    attach: () => queue.attached++,
    detach: () => queue.detached++,
  }
  return queue
}

describe('budget', () => {
  it('runs the higher priority first and spends the whole budget on it', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const [high, mid, low] = [makeQueue('high', clock, 1), makeQueue('mid', clock, 1), makeQueue('low', clock, 1)]
    budget.register(low, { priority: 1 })
    budget.register(high, { priority: 30 })
    budget.register(mid, { priority: 20 })
    budget.beginFrame()
    budget.drain('idle')
    expect([high.ran, mid.ran, low.ran]).toEqual([4, 0, 0])
  })

  it('keeps a reserve for an idle queue when present spends everything, and the debt does not cut it', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const present = makeQueue('present', clock, 10)
    const idle = makeQueue('idle', clock, 0.25)
    budget.register(present, { priority: 300, phase: 'present' })
    budget.register(idle, { priority: 200, phase: 'idle', reserveMs: 1 })
    for (let frame = 0; frame < 5; frame++) {
      const before = idle.ran
      budget.beginFrame()
      budget.drain('present')
      budget.drain('idle')
      expect(idle.ran - before).toBe(4)
    }
    expect(() => budget.register(makeQueue('greedy', clock, 1), { priority: 1, reserveMs: 1.5 })).toThrow(/half/)
  })

  it('forces one unit every minEveryFrames for a queue starved by a full higher one', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const high = makeQueue('high', clock, 1)
    const low = makeQueue('low', clock, 1)
    budget.register(high, { priority: 10 })
    budget.register(low, { priority: 1, minEveryFrames: 4 })
    for (let frame = 0; frame < 12; frame++) {
      budget.beginFrame()
      budget.drain('idle')
    }
    expect(low.ran).toBe(3)
    expect(budget.stats().queues.find((entry) => entry.id === 'low')?.forced).toBe(3)
    expect(budget.stats().queues.find((entry) => entry.id === 'low')?.maxFramesWaiting).toBe(4)
  })

  it('carries a 10 ms unit as a debt of one budget: the next frame has no common time', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const big = makeQueue('big', clock, 10)
    budget.register(big, { priority: 1, minEveryFrames: 100 })
    budget.beginFrame()
    budget.drain('idle')
    expect(big.ran).toBe(1)
    expect(budget.stats().debtMs).toBe(4)
    budget.beginFrame()
    budget.drain('idle')
    expect(big.ran).toBe(1)
    budget.beginFrame()
    budget.drain('idle')
    expect(big.ran).toBe(2)
  })

  it('spends present first and gives idle what is left', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const present = makeQueue('present', clock, 1)
    const idle = makeQueue('idle', clock, 1)
    budget.register(idle, { priority: 999, phase: 'idle', minEveryFrames: 100 })
    budget.register(present, { priority: 1, phase: 'present' })
    budget.beginFrame()
    budget.drain('present')
    budget.drain('idle')
    expect([present.ran, idle.ran]).toEqual([4, 0])
  })

  it('attaches on register, detaches on the returned function and on dispose, and never on its own', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ clock: clock.now })
    const first = makeQueue('first', clock, 1)
    const second = makeQueue('second', clock, 1)
    expect(first.attached + first.detached).toBe(0)
    const unregister = budget.register(first, { priority: 1 })
    budget.register(second, { priority: 2 })
    expect([first.attached, second.attached]).toEqual([1, 1])
    unregister()
    unregister()
    expect(first.detached).toBe(1)
    budget.dispose()
    expect([first.detached, second.detached]).toEqual([1, 1])
  })

  it('does not call run in a frame where pending(frame) says 0, not even to avoid starvation', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    let frameSeen = 0
    const held = { ...makeQueue('held', clock, 1), pending: (frame?: number) => ((frameSeen = frame ?? 0), 0) }
    budget.register(held, { priority: 1, minEveryFrames: 1 })
    for (let frame = 0; frame < 3; frame++) {
      budget.beginFrame()
      budget.drain('idle')
    }
    expect(held.calls).toBe(0)
    expect(frameSeen).toBe(3)
  })

  it('drains everything with unbounded and flushAll empties the queues', () => {
    const clock = makeClock()
    const budget = createFrameBudget({ ms: 4, clock: clock.now })
    const queue = makeQueue('q', clock, 1, 50)
    budget.register(queue, { priority: 1 })
    budget.unbounded = true
    budget.beginFrame()
    budget.drain('idle')
    expect(queue.ran).toBe(50)
    const other = makeQueue('o', clock, 1, 9)
    budget.register(other, { priority: 1 })
    budget.flushAll()
    expect(other.pending()).toBe(0)
  })
})

describe('loop', () => {
  it('drives frames from the display callbacks, reports the unclamped time and stops', () => {
    const scheduler = createScheduler({ maxFrameSeconds: 0.05, snapMs: 0 })
    let pendingCallback: ((nowMs: number) => void) | undefined
    const reported: number[] = []
    const dts: number[] = []
    let skip = false
    scheduler.add((ctx) => dts.push(ctx.realDt), { phase: 'input' })
    let simulated = 0
    scheduler.add((ctx) => void (ctx.simulated && simulated++), { phase: 'present' })
    const stop = startLoop(scheduler, {
      startMs: 0,
      requestFrame: (callback) => ((pendingCallback = callback), 1),
      cancelFrame: () => (pendingCallback = undefined),
      onFrame: (seconds) => reported.push(seconds),
      skipSimulation: () => skip,
    })
    pendingCallback?.(100)
    skip = true
    pendingCallback?.(116)
    stop()
    expect(reported).toEqual([0.1, 0.016])
    expect(dts).toEqual([0.05])
    expect(simulated).toBe(1)
    expect(pendingCallback).toBeUndefined()
  })
})
