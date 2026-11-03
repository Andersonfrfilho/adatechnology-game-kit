import { describe, expect, it } from 'vitest'
import { checkDeferredQueue } from '@adatechnology/game-contracts'
import { createCreaseQueue } from '../src'
import type { CreaseWork } from '../src'

const fakeWork = (units: number, log: string[], name: string): CreaseWork & { queued: boolean; held: boolean } => {
  const work = {
    queued: false,
    held: false,
    pendingUnits: () => (work.held ? 0 : units),
    runStep: () => {
      if (units === 0) return false
      units--
      log.push(name)
      return true
    },
    finishAll: () => {
      units = 0
    },
    setQueued: (isQueued: boolean) => {
      work.queued = isQueued
    },
  }
  return work
}

describe('crease queue', () => {
  it('keeps the DeferredQueue contract', () => {
    const filled = createCreaseQueue()
    filled.track(fakeWork(5, [], 'a'))
    filled.track(fakeWork(5, [], 'b'))
    const report = checkDeferredQueue(filled.deferredQueue(), () => undefined)
    expect(report).toEqual({ ok: true, problems: [] })
  })

  it('shares the work round robin between vehicles instead of finishing the first', () => {
    const log: string[] = []
    const queue = createCreaseQueue()
    queue.track(fakeWork(4, log, 'first'))
    queue.track(fakeWork(4, log, 'second'))
    const handle = queue.deferredQueue()
    let ticks = 0
    expect(handle.run(4, () => ticks++)).toBeGreaterThan(1)
    expect(log.slice(0, 4)).toEqual(['first', 'second', 'first', 'second'])
  })

  it('counts nothing for a vehicle held in the frame of its cut, and the queue reports 0 then', () => {
    const queue = createCreaseQueue()
    const held = fakeWork(3, [], 'torn')
    held.held = true
    queue.track(held)
    expect(queue.deferredQueue().pending(7)).toBe(0)
    held.held = false
    expect(queue.deferredQueue().pending(8)).toBe(3)
  })

  it('tells the vehicles to leave the work on attach, and takes them back on detach and on untrack', () => {
    const queue = createCreaseQueue()
    const work = fakeWork(1, [], 'a')
    const untrack = queue.track(work)
    expect(work.queued).toBe(false)
    queue.deferredQueue().attach?.()
    expect(work.queued).toBe(true)
    queue.deferredQueue().detach?.()
    expect(work.queued).toBe(false)
    queue.deferredQueue().attach?.()
    untrack()
    expect(work.queued).toBe(false)
    expect(queue.deferredQueue().pending(1)).toBe(0)
  })

  it('asks to be flushed with everything finished', () => {
    const queue = createCreaseQueue()
    queue.track(fakeWork(9, [], 'a'))
    queue.track(fakeWork(9, [], 'b'))
    queue.deferredQueue().flush()
    expect(queue.deferredQueue().pending(1)).toBe(0)
  })
})
