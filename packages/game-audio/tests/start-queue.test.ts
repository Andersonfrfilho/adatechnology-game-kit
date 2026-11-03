import { describe, expect, it } from 'vitest'
import { checkDeferredQueue } from '@adatechnology/game-contracts'
import { createAudioEngine } from '../src'
import { createStartQueue } from '../src/webaudio/engine-queue'

const tick = (ms = 10): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const fill = (queue: ReturnType<typeof createStartQueue>, log: string[], count = 5): void => {
  for (let i = 0; i < count; i++) queue.push({ run: () => log.push(`run${i}`), drop: () => log.push(`drop${i}`) })
}

describe('voice start queue as a deferred queue', () => {
  it('keeps the DeferredQueue contract', () => {
    const queue = createStartQueue()
    const log: string[] = []
    expect(checkDeferredQueue(queue.deferredQueue(), () => fill(queue, log))).toEqual({ ok: true, problems: [] })
  })

  it('drains by itself until a budget attaches it, and asking for the queue changes nothing', async () => {
    const queue = createStartQueue({ budgetMs: 1000 })
    const log: string[] = []
    queue.deferredQueue()
    fill(queue, log)
    await tick()
    expect(log).toHaveLength(5)
  })

  it('stops scheduling its own tasks once attached, and the budget drains the same order as the synchronous drain', async () => {
    const synchronous = createStartQueue({ budgetMs: 1000 })
    const expected: string[] = []
    fill(synchronous, expected)
    await tick()

    const queue = createStartQueue({ budgetMs: 1000 })
    const handle = queue.deferredQueue()
    const log: string[] = []
    handle.attach?.()
    fill(queue, log)
    await tick()
    expect(log).toEqual([])
    expect(handle.pending()).toBe(5)
    handle.run(Infinity, () => 0)
    expect(log).toEqual(expected)
  })

  it('goes back to draining by itself on detach', async () => {
    const queue = createStartQueue({ budgetMs: 1000 })
    const handle = queue.deferredQueue()
    const log: string[] = []
    handle.attach?.()
    fill(queue, log, 3)
    handle.detach?.()
    await tick()
    expect(log).toHaveLength(3)
  })

  it('runs one voice per call with a deadline already past, and drops what waited past the latency', async () => {
    const queue = createStartQueue({ maxLatencyMs: 2 })
    const handle = queue.deferredQueue()
    const log: string[] = []
    handle.attach?.()
    fill(queue, log, 3)
    expect(handle.run(0, () => 1)).toBe(1)
    expect(log).toEqual(['run0'])
    await tick(8)
    handle.run(Infinity, () => 0)
    expect(log).toEqual(['run0', 'drop1', 'drop2'])
  })

  it('exposes the queue on the engine only with deferredStart', () => {
    expect(createAudioEngine().deferredQueue?.()).toBeNull()
    expect(createAudioEngine({ deferredStart: {} }).deferredQueue?.()?.id).toBe('audio.voices')
  })
})
