import type { DeferredQueue, DeferredQueueOptions } from '@adatechnology/game-contracts'
import type { QueueStats } from './types'

const DEFAULT_MIN_EVERY_FRAMES = 4

export interface QueueEntry {
  readonly queue: DeferredQueue
  readonly phase: 'present' | 'idle'
  readonly priority: number
  readonly minEveryFrames: number
  readonly reserveMs: number
  reserveLeft: number
  waitingFrames: number
  maxWaitingFrames: number
  ranUnits: number
  spentMs: number
  forced: number
  lastPending: number
}

export function createQueueEntry(queue: DeferredQueue, options: DeferredQueueOptions): QueueEntry {
  return {
    queue,
    phase: options.phase ?? 'idle',
    priority: options.priority,
    minEveryFrames: options.minEveryFrames ?? DEFAULT_MIN_EVERY_FRAMES,
    reserveMs: options.reserveMs ?? 0,
    reserveLeft: 0,
    waitingFrames: 0,
    maxWaitingFrames: 0,
    ranUnits: 0,
    spentMs: 0,
    forced: 0,
    lastPending: 0,
  }
}

/** Puts the entry before the first one of lower priority, so equal priorities keep the order of registration. */
export function insertByPriority(entries: QueueEntry[], entry: QueueEntry): void {
  let index = entries.length
  while (index > 0 && (entries[index - 1] as QueueEntry).priority < entry.priority) index--
  entries.splice(index, 0, entry)
}

export function queueStats(entry: QueueEntry): QueueStats {
  return {
    id: entry.queue.id,
    pending: entry.lastPending,
    ranUnits: entry.ranUnits,
    spentMs: entry.spentMs,
    framesWaiting: entry.waitingFrames,
    maxFramesWaiting: entry.maxWaitingFrames,
    forced: entry.forced,
  }
}
