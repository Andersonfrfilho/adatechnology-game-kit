import { describe, expect, it } from 'vitest'
import { DEFERRED_PRIORITY, FRAME_PHASES, checkDeferredQueue } from '../src'
import type { DeferredQueue } from '../src'

const makeQueue = (overrides: Partial<DeferredQueue> = {}): { queue: DeferredQueue; fill: () => void } => {
  let units = 0
  const queue: DeferredQueue = {
    id: 'fake',
    pending: () => units,
    run(deadline, clock) {
      let ran = 0
      while (units > 0 && (ran === 0 || clock() < deadline)) {
        units--
        ran++
      }
      return ran
    },
    flush() {
      units = 0
    },
    ...overrides,
  }
  return { queue, fill: () => (units = 5) }
}

describe('frame contract', () => {
  it('lists the phases in the order a frame runs them', () => {
    expect(FRAME_PHASES).toEqual(['input', 'fixedSimulate', 'lateSimulate', 'present', 'render', 'idle'])
  })

  it('gives every default queue a phase that runs the queue before or after the render', () => {
    for (const options of Object.values(DEFERRED_PRIORITY)) expect(['present', 'idle']).toContain(options.phase)
    expect(DEFERRED_PRIORITY['audio.voices'].reserveMs).toBe(1)
  })

  it('accepts a queue that honours the contract', () => {
    const { queue, fill } = makeQueue()
    expect(checkDeferredQueue(queue, fill)).toEqual({ ok: true, problems: [] })
  })

  it('rejects a queue that runs nothing with a deadline already past', () => {
    const { queue, fill } = makeQueue({ run: () => 0 })
    expect(checkDeferredQueue(queue, fill).ok).toBe(false)
  })

  it('rejects a queue whose pending changes inside one frame', () => {
    let calls = 0
    const { queue, fill } = makeQueue({ pending: () => 5 - ++calls })
    expect(checkDeferredQueue(queue, fill).problems.some((problem) => problem.includes('changed between two calls'))).toBe(true)
  })

  it('rejects an attach that throws the second time', () => {
    let attached = false
    const { queue, fill } = makeQueue({
      attach: () => {
        if (attached) throw new Error('already attached')
        attached = true
      },
    })
    expect(checkDeferredQueue(queue, fill).ok).toBe(false)
  })
})
