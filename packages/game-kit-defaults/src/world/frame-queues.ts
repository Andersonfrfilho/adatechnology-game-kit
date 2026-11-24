import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import { DEFAULT_WORK_BUDGET_MS } from '@adatechnology/game-destruction-three'
import type { DeferredQueueRegistration, ExplosionWorkOptions } from '@adatechnology/game-destruction-three'
import type { StaticBatchQueue } from '@adatechnology/game-render-three'
import type { FrameBudget } from '@adatechnology/game-runtime'

/** Frame deadline (ms) when the player has no frame cap: the monitor most players have. */
export const DEFAULT_FRAME_TARGET_MS = 1000 / 60

export type FrameQueuesParams = {
  readonly budget: FrameBudget
  readonly destruction: { deferredQueues(): readonly DeferredQueueRegistration[] }
  readonly audio: { deferredQueue?(): DeferredQueue | null; occlusionQueue?(): DeferredQueue | null } | null
  readonly film: { deferredQueue(): DeferredQueue }
  readonly staticBatchQueue: StaticBatchQueue
  /** The renderer runs a `workBudget`: its events run every frame there is work, in units (the clock does not pick the frame). */
  readonly hasWorkBudget: boolean
}

/** Registers the queues the room owns with the frame budget (the modules register their own through `ModuleHost.defer`). */
export function registerFrameQueues({ budget, destruction, audio, film, staticBatchQueue, hasWorkBudget }: FrameQueuesParams): void {
  const voices = audio?.deferredQueue?.()
  if (voices) budget.register(voices, DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.AUDIO_VOICES])
  const occlusion = audio?.occlusionQueue?.()
  if (occlusion) budget.register(occlusion, DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.AUDIO_OCCLUSION])
  for (const { queue, options } of destruction.deferredQueues()) {
    const isEvents = queue.id === DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS
    budget.register(queue, hasWorkBudget && isEvents ? { ...options, minEveryFrames: 1 } : options)
  }
  budget.register(film.deferredQueue(), DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.FLUID_FILM])
  budget.register(staticBatchQueue.deferredQueue(), DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.STATIC_BATCH])
}

/** D4: the tier comes from the host (default 1) and the work step never passes the ceiling of the frame. */
export function workBudgetOf({ workBudget, ceilingMs }: { readonly workBudget: ExplosionWorkOptions; readonly ceilingMs: number }): ExplosionWorkOptions {
  return { tier: 1, ...workBudget, budgetMs: Math.min(workBudget.budgetMs ?? DEFAULT_WORK_BUDGET_MS, ceilingMs) }
}

/** The deadline of a frame: the host's own, else the player's FPS cap (the loop's gap is one ms under it), else 60 Hz. */
export function frameTargetOf({ hostTargetMs, capGapMs = 0 }: { readonly hostTargetMs: number | undefined; readonly capGapMs?: number }): number {
  return hostTargetMs ?? (capGapMs > 0 ? capGapMs + 1 : DEFAULT_FRAME_TARGET_MS)
}
