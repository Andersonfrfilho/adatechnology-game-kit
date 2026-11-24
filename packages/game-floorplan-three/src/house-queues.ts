import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import type { DeferredQueue, DeferredQueueOptions } from '@adatechnology/game-contracts'

import type { HouseRenderer } from './types.js'

/** What a frame budget offers (`FrameBudget.register` of `game-runtime`): the queue joins it, and the call gives it back. */
export type QueueBudget = { register(queue: DeferredQueue, options: DeferredQueueOptions): () => void }

/**
 * Registers the queues of a house renderer with a frame budget at the priority the contract gives them: the repainting of damaged walls, and the cutting of holes, which must drain in the
 * frame of the blast (`mustDrain`, the one class of queue this package may ask for). Returns what unregisters them.
 */
export function registerHouseQueues(renderer: HouseRenderer, budget: QueueBudget): () => void {
  const stops: Array<() => void> = []
  const paint = renderer.deferredQueue?.()
  if (paint) stops.push(budget.register(paint, DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT]))
  const cut = renderer.cutQueue?.()
  if (cut) stops.push(budget.register(cut, { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_CUT], mustDrain: true }))
  return () => stops.forEach((stop) => stop())
}
