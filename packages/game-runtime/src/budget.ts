import type { DeferredQueue, DeferredQueueOptions } from '@adatechnology/game-contracts'
import { defaultClock } from './clock'
import type { BudgetStats, FrameBudget } from './types'

const DEFAULT_MS = 4
const DEFAULT_MIN_EVERY_FRAMES = 4
const MAX_RESERVE_SHARE = 0.5

interface QueueEntry {
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

export function createFrameBudget(options: { readonly ms?: number; readonly clock?: () => number } = {}): FrameBudget {
  const clock = options.clock ?? defaultClock()
  const entries: QueueEntry[] = []
  let frame = 0
  let frameOpen = false
  let debt = 0
  let common = 0
  let spentThisFrame = 0
  let unbounded = false

  const reservedTotal = (): number => entries.reduce((sum, entry) => sum + entry.reserveMs, 0)

  const beginFrame = (): void => {
    frame++
    frameOpen = true
    spentThisFrame = 0
    let available = budget.ms
    for (const entry of entries) {
      entry.reserveLeft = 0
      if (entry.reserveMs <= 0 || entry.queue.pending(frame) <= 0) continue
      entry.reserveLeft = Math.min(entry.reserveMs, available)
      available -= entry.reserveLeft
    }
    common = Math.max(0, available - debt)
    debt = 0
  }

  const runEntry = (entry: QueueEntry, deadline: number): void => {
    const started = clock()
    const ran = entry.queue.run(deadline, clock)
    const spent = Math.max(0, clock() - started)
    entry.ranUnits += ran
    entry.spentMs += spent
    entry.waitingFrames = 0
    spentThisFrame += spent
    if (unbounded) return
    const fromReserve = Math.min(entry.reserveLeft, spent)
    entry.reserveLeft -= fromReserve
    common -= spent - fromReserve
    if (common < 0) {
      debt = Math.min(budget.ms, debt - common)
      common = 0
    }
  }

  const drainEntry = (entry: QueueEntry): void => {
    entry.lastPending = entry.queue.pending(frame)
    if (entry.lastPending <= 0) {
      entry.waitingFrames = 0
      return
    }
    if (unbounded) return runEntry(entry, Infinity)
    const allowance = entry.reserveLeft + common
    if (allowance > 0) return runEntry(entry, clock() + allowance)
    entry.waitingFrames++
    entry.maxWaitingFrames = Math.max(entry.maxWaitingFrames, entry.waitingFrames)
    if (entry.waitingFrames < entry.minEveryFrames) return
    entry.forced++
    runEntry(entry, clock())
  }

  const budget: FrameBudget = {
    ms: options.ms ?? DEFAULT_MS,
    register(queue, queueOptions: DeferredQueueOptions) {
      const reserveMs = queueOptions.reserveMs ?? 0
      if (reservedTotal() + reserveMs > budget.ms * MAX_RESERVE_SHARE) {
        throw new Error(`budget.register(${queue.id}): the reserves would pass half of the ${budget.ms} ms budget`)
      }
      const entry: QueueEntry = {
        queue,
        phase: queueOptions.phase ?? 'idle',
        priority: queueOptions.priority,
        minEveryFrames: queueOptions.minEveryFrames ?? DEFAULT_MIN_EVERY_FRAMES,
        reserveMs,
        reserveLeft: 0,
        waitingFrames: 0,
        maxWaitingFrames: 0,
        ranUnits: 0,
        spentMs: 0,
        forced: 0,
        lastPending: 0,
      }
      let index = entries.length
      while (index > 0 && (entries[index - 1] as QueueEntry).priority < entry.priority) index--
      entries.splice(index, 0, entry)
      queue.attach?.()
      return () => {
        const at = entries.indexOf(entry)
        if (at < 0) return
        entries.splice(at, 1)
        queue.detach?.()
      }
    },
    beginFrame,
    drain(phase) {
      if (phase === 'present' && !frameOpen) beginFrame()
      for (const entry of [...entries]) if (entry.phase === phase) drainEntry(entry)
      if (phase === 'idle') frameOpen = false
    },
    flushAll() {
      for (const entry of entries) entry.queue.flush()
    },
    get unbounded() {
      return unbounded
    },
    set unbounded(value: boolean) {
      unbounded = value
    },
    stats(): BudgetStats {
      return {
        ms: budget.ms,
        spentMs: spentThisFrame,
        debtMs: debt,
        queues: entries.map((entry) => ({
          id: entry.queue.id,
          pending: entry.lastPending,
          ranUnits: entry.ranUnits,
          spentMs: entry.spentMs,
          framesWaiting: entry.waitingFrames,
          maxFramesWaiting: entry.maxWaitingFrames,
          forced: entry.forced,
        })),
      }
    },
    dispose() {
      for (const entry of entries.splice(0)) entry.queue.detach?.()
    },
  }
  return budget
}
