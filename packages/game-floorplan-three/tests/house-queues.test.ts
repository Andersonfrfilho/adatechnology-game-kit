import { describe, expect, it } from 'vitest'

import { DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import type { DeferredQueue, DeferredQueueOptions } from '@adatechnology/game-contracts'

import { registerHouseQueues } from '../src/house-queues'
import type { HouseRenderer } from '../src/types'

const queue = (id: string): DeferredQueue => ({ id }) as DeferredQueue

describe('registerHouseQueues', () => {
  it('registers the paint queue and the cut queue (the only one that must drain) and gives both back', () => {
    const registered: Array<{ id: string; options: DeferredQueueOptions }> = []
    let stopped = 0
    const budget = { register: (q: DeferredQueue, options: DeferredQueueOptions) => (registered.push({ id: q.id, options }), () => void stopped++) }
    const renderer = { deferredQueue: () => queue(DEFERRED_QUEUE_ID.BREACH_PAINT), cutQueue: () => queue(DEFERRED_QUEUE_ID.BREACH_CUT) } as unknown as HouseRenderer
    const stop = registerHouseQueues(renderer, budget)
    expect(registered.map((entry) => [entry.id, entry.options.mustDrain === true])).toEqual([[DEFERRED_QUEUE_ID.BREACH_PAINT, false], [DEFERRED_QUEUE_ID.BREACH_CUT, true]])
    stop()
    expect(stopped).toBe(2)
  })

  it('skips a renderer without queues', () => {
    expect(() => registerHouseQueues({} as HouseRenderer, { register: () => () => undefined })()).not.toThrow()
  })
})
