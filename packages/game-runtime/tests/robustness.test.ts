import { describe, expect, it } from 'vitest'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import { createFrameBudget, createScheduler, startLoop } from '../src'

const H = 1 / 60

const throwingQueue = (id: string): DeferredQueue => ({
  id,
  pending: () => 1,
  run: () => {
    throw new Error(`${id} broke`)
  },
  flush: () => undefined,
})

const countingQueue = (id: string): DeferredQueue & { ran: number } => {
  const queue = {
    id,
    ran: 0,
    pending: () => 1,
    run: () => {
      queue.ran++
      return 1
    },
    flush: () => undefined,
  }
  return queue
}

describe('exception safety', () => {
  it('a queue that throws is reported, counts 0 units and the next frame still runs', () => {
    const errors: string[] = []
    const scheduler = createScheduler({ onError: (error, system) => errors.push(`${system.id}: ${(error as Error).message}`) })
    const healthy = countingQueue('healthy')
    scheduler.budget.register(throwingQueue('bad'), { priority: 10, phase: 'idle' })
    scheduler.budget.register(healthy, { priority: 1, phase: 'idle' })
    let frames = 0
    scheduler.add(() => frames++, { phase: 'input' })
    scheduler.frame(H)
    scheduler.frame(H)
    expect(frames).toBe(2)
    expect(healthy.ran).toBeGreaterThan(1)
    expect(errors).toEqual(['queue:bad: bad broke', 'queue:bad: bad broke'])
    expect(scheduler.stats().budget.queues.find((queue) => queue.id === 'bad')?.ranUnits).toBe(0)
  })

  it('without an onError a throwing queue is logged once per id', () => {
    const logged: unknown[][] = []
    const original = console.error
    console.error = (...args: unknown[]) => void logged.push(args)
    try {
      const budget = createFrameBudget()
      budget.register(throwingQueue('loud'), { priority: 1 })
      for (let frame = 0; frame < 3; frame++) {
        budget.beginFrame()
        budget.drain('idle')
      }
    } finally {
      console.error = original
    }
    expect(logged).toHaveLength(1)
  })

  it('leaves the scheduler usable after a frame that failed outside any system', () => {
    const scheduler = createScheduler()
    const broken: DeferredQueue = { id: 'broken', pending: () => { throw new Error('pending broke') }, run: () => 0, flush: () => undefined }
    const stop = scheduler.budget.register(broken, { priority: 1 })
    expect(() => scheduler.frame(H)).toThrow('pending broke')
    stop()
    const log: number[] = []
    scheduler.add((ctx) => log.push(ctx.frame), { phase: 'input' })
    expect(() => scheduler.frame(H)).not.toThrow()
    expect(log).toHaveLength(1)
  })
})

describe('time guards', () => {
  it('treats NaN, Infinity and negative frame times as no time', () => {
    const scheduler = createScheduler()
    const dts: number[] = []
    scheduler.add((ctx) => dts.push(ctx.realDt), { phase: 'input' })
    for (const bad of [Number.NaN, -1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) scheduler.frame(bad)
    scheduler.frame(Number.NaN, { exact: true })
    expect(dts.every((dt) => dt === 0)).toBe(true)
    expect(scheduler.stats().tick).toBe(0)
    expect(Number.isFinite(scheduler.stats().droppedSeconds)).toBe(true)
  })

  it('advance with a NaN or negative dt falls back to the fixed step', () => {
    const scheduler = createScheduler()
    scheduler.advance(2 * H, { dt: Number.NaN })
    scheduler.advance(Number.NaN, { dt: -3 })
    expect(scheduler.stats().tick).toBe(3)
  })

  it('never runs backwards with a negative timeScale and reads NaN as real time', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    scheduler.timeScale = -2
    expect(scheduler.timeScale).toBe(0)
    scheduler.frame(5 * H)
    expect(scheduler.stats().tick).toBe(0)
    scheduler.timeScale = Number.NaN
    expect(scheduler.timeScale).toBe(1)
    scheduler.frame(H)
    expect(scheduler.stats().tick).toBe(1)
  })
})

describe('loop clock', () => {
  it('measures the first frame after the tab comes back from now, not from before it left', () => {
    const scheduler = createScheduler()
    let callback: ((nowMs: number) => void) | undefined
    const reported: number[] = []
    const listeners: Array<() => void> = []
    const fakeDocument = { visibilityState: 'visible', addEventListener: (_: string, listener: () => void) => listeners.push(listener), removeEventListener: () => undefined }
    const realDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document?: unknown }).document = fakeDocument
    const realNow = performance.now.bind(performance)
    try {
      const stop = startLoop(scheduler, { startMs: 0, requestFrame: (next) => ((callback = next), 1), onFrame: (seconds) => reported.push(seconds) })
      callback?.(16)
      performance.now = () => 60_000
      for (const listener of listeners) listener()
      callback?.(60_016)
      stop()
    } finally {
      performance.now = realNow
      ;(globalThis as { document?: unknown }).document = realDocument
    }
    expect(reported[0]).toBeCloseTo(0.016)
    expect(reported[1]).toBeCloseTo(0.016)
  })
})

describe('teardown and registration', () => {
  it('rejects the same queue twice and keeps the first registration', () => {
    const budget = createFrameBudget()
    const queue = countingQueue('once')
    const stop = budget.register(queue, { priority: 1 })
    expect(() => budget.register(queue, { priority: 2 })).toThrow('already registered')
    expect(budget.stats().queues).toHaveLength(1)
    stop()
    expect(() => budget.register(queue, { priority: 2 })).not.toThrow()
  })

  it('dispose rejects later frames, drops the waiting systems and ignores new ones', () => {
    const scheduler = createScheduler()
    const log: string[] = []
    scheduler.add(() => {
      scheduler.add(() => log.push('waiting'), { phase: 'input' })
      log.push('first')
    }, { phase: 'input' })
    scheduler.frame(H)
    scheduler.dispose()
    expect(() => scheduler.frame(H)).toThrow('disposed')
    expect(() => scheduler.advance(H)).toThrow('disposed')
    scheduler.add(() => log.push('late'), { phase: 'input' })
    expect(log).toEqual(['first'])
  })

  it('dispose from inside a frame finishes that frame and leaves no waiting system alive', () => {
    const scheduler = createScheduler()
    const log: string[] = []
    scheduler.add(() => {
      scheduler.add(() => log.push('waiting'), { phase: 'idle' })
      scheduler.dispose()
    }, { phase: 'input' })
    scheduler.add(() => log.push('after'), { phase: 'idle' })
    scheduler.frame(H)
    expect(log).toEqual([])
    expect(() => scheduler.frame(H)).toThrow('disposed')
  })
})
