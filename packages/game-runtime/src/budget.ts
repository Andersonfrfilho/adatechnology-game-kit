import type { DeferredQueueOptions } from '@adatechnology/game-contracts'
import { createQueueEntry, insertByPriority, queueStats, type QueueEntry } from './budget-entry'
import { defaultClock } from './clock'
import { createRenderEstimate } from './render-estimate'
import type { BudgetStats, FrameBudget } from './types'

const DEFAULT_MS = 4
const DEFAULT_MIN_MS = 1
const MAX_RESERVE_SHARE = 0.5

export interface FrameBudgetOptions {
  /** Quota per frame; with `targetMs`, the ceiling of a frame that has a deadline. Default 4. */
  readonly ms?: number
  /** Frame deadline, ms: with it, a frame that carries `frameStartMs` runs in the deadline mode. Absent: quota. */
  readonly targetMs?: number | undefined
  /** Floor of the deadline mode, ms. Default 1. */
  readonly minMs?: number | undefined
  readonly clock?: () => number
  /** A queue that throws in `run`: default logs once per queue id. The frame goes on and the queue counts 0 units. */
  readonly onError?: (error: unknown, queue: { readonly id: string; readonly phase: 'present' | 'idle' }) => void
}

export function createFrameBudget(options: FrameBudgetOptions = {}): FrameBudget {
  const clock = options.clock ?? defaultClock()
  const entries: QueueEntry[] = []
  const reportedQueues = new Set<string>()
  let frame = 0
  let frameOpen = false
  let debt = 0
  let common = 0
  let spentThisFrame = 0
  let mustDrainSpent = 0
  let unbounded = false
  let mode: 'quota' | 'deadline' = 'quota'
  let allowance = 0
  let isAllowanceReady = false
  let frameStart = 0
  let frameTarget = 0
  let isRenderSkipped = false
  const forcedMs: number[] = []
  const minMs = options.minMs ?? DEFAULT_MIN_MS
  const renderEstimate = createRenderEstimate()

  const reservedTotal = (): number => entries.reduce((sum, entry) => sum + entry.reserveMs, 0)

  /** Takes each reserve (of a queue with work) out of `pool`; returns what is left for the shared part. */
  const carveReserves = (pool: number): number => {
    for (const entry of entries) {
      entry.reserveLeft = 0
      if (entry.reserveMs <= 0 || entry.mustDrain || entry.queue.pending(frame) <= 0) continue
      entry.reserveLeft = Math.min(entry.reserveMs, pool)
      pool -= entry.reserveLeft
    }
    return pool
  }

  const beginFrame = (frameStartMs?: number): void => {
    frame++
    frameOpen = true
    spentThisFrame = 0
    mustDrainSpent = 0
    forcedMs.length = 0
    isRenderSkipped = false
    for (const entry of entries) entry.lastSpentMs = 0
    const target = budget.targetMs
    if (target !== undefined && frameStartMs !== undefined && !unbounded) {
      const now = clock()
      const lag = now - frameStartMs
      mode = 'deadline'
      frameTarget = target
      frameStart = lag >= 0 && lag <= target ? frameStartMs : now
      isAllowanceReady = false
      allowance = 0
      common = 0
      debt = 0
      return
    }
    mode = 'quota'
    allowance = Math.max(0, budget.ms - debt)
    common = Math.max(0, carveReserves(budget.ms) - debt)
    debt = 0
  }

  /** Deadline mode: what the queues may spend, computed once per frame after the `mustDrain` queues ran and the simulation and physics are in the clock. */
  const ensureAllowance = (): void => {
    if (isAllowanceReady) return
    isAllowanceReady = true
    const left = frameStart + frameTarget - renderEstimate.value - clock()
    allowance = Math.max(minMs, Math.min(budget.ms, left))
    common = carveReserves(allowance)
  }

  /** Deadline mode, start of the idle drain: the render that really ran replaces the estimate, and the floor holds for the whole frame. */
  const refreshForIdle = (): void => {
    for (const entry of entries) if (entry.phase === 'present') entry.reserveLeft = 0
    const realLeft = frameStart + frameTarget - clock()
    const total = Math.max(Math.min(allowance - spentThisFrame, realLeft), minMs - spentThisFrame)
    common = Math.max(0, total - entries.reduce((sum, entry) => sum + entry.reserveLeft, 0))
  }

  const reportError = (error: unknown, entry: QueueEntry): void => {
    if (options.onError) return options.onError(error, { id: entry.queue.id, phase: entry.phase })
    if (reportedQueues.has(entry.queue.id)) return
    reportedQueues.add(entry.queue.id)
    console.error(`game-runtime: queue ${entry.queue.id} threw`, error)
  }

  const runQueue = (entry: QueueEntry, deadline: number): number => {
    try {
      return entry.queue.run(deadline, clock)
    } catch (error) {
      reportError(error, entry)
      return 0
    }
  }

  const runEntry = (entry: QueueEntry, deadline: number): number => {
    const started = clock()
    const ran = runQueue(entry, deadline)
    const spent = Math.max(0, clock() - started)
    entry.ranUnits += ran
    entry.spentMs += spent
    entry.lastSpentMs += spent
    entry.waitingFrames = 0
    if (entry.mustDrain) {
      mustDrainSpent += spent
      return spent
    }
    spentThisFrame += spent
    if (unbounded) return spent
    const fromReserve = Math.min(entry.reserveLeft, spent)
    entry.reserveLeft -= fromReserve
    common -= spent - fromReserve
    if (common < 0) {
      if (mode === 'quota') debt = Math.min(budget.ms, debt - common)
      common = 0
    }
    return spent
  }

  const drainMustDrain = (entry: QueueEntry): void => {
    entry.lastPending = entry.queue.pending(frame)
    if (entry.lastPending <= 0) {
      entry.waitingFrames = 0
      return
    }
    runEntry(entry, Infinity)
  }

  const drainEntry = (entry: QueueEntry): void => {
    entry.lastPending = entry.queue.pending(frame)
    if (entry.lastPending <= 0) {
      entry.waitingFrames = 0
      return
    }
    if (unbounded) {
      runEntry(entry, Infinity)
      return
    }
    const share = entry.reserveLeft + common
    if (share > 0) {
      runEntry(entry, clock() + share)
      return
    }
    entry.waitingFrames++
    entry.maxWaitingFrames = Math.max(entry.maxWaitingFrames, entry.waitingFrames)
    if (entry.waitingFrames < entry.minEveryFrames) return
    entry.forced++
    forcedMs.push(runEntry(entry, clock()))
  }

  const budget: FrameBudget = {
    ms: options.ms ?? DEFAULT_MS,
    register(queue, queueOptions: DeferredQueueOptions) {
      if (entries.some((candidate) => candidate.queue === queue)) throw new Error(`budget.register(${queue.id}): this queue is already registered`)
      const reserveMs = queueOptions.reserveMs ?? 0
      if (reservedTotal() + reserveMs > budget.ms * MAX_RESERVE_SHARE) {
        throw new Error(`budget.register(${queue.id}): the reserves would pass half of the ${budget.ms} ms budget`)
      }
      if (budget.targetMs !== undefined && reservedTotal() + reserveMs > minMs) {
        throw new Error(`budget.register(${queue.id}): with a deadline the reserves come out of the ${minMs} ms floor and would pass it`)
      }
      const entry = createQueueEntry(queue, queueOptions)
      insertByPriority(entries, entry)
      queue.attach?.()
      return () => {
        const at = entries.indexOf(entry)
        if (at < 0) return
        entries.splice(at, 1)
        queue.detach?.()
      }
    },
    targetMs: options.targetMs,
    get mode() {
      return mode
    },
    beginFrame,
    recordRender(ms) {
      if (budget.targetMs === undefined || isRenderSkipped || !Number.isFinite(ms)) return
      renderEstimate.add(Math.min(Math.max(ms, 0), budget.targetMs))
    },
    skipRenderSample() {
      isRenderSkipped = true
    },
    drain(phase) {
      if (phase === 'present' && !frameOpen) beginFrame()
      for (const entry of [...entries]) if (entry.mustDrain && entry.phase === phase) drainMustDrain(entry)
      if (mode === 'deadline' && !unbounded) {
        ensureAllowance()
        if (phase === 'idle') refreshForIdle()
      }
      for (const entry of [...entries]) if (!entry.mustDrain && entry.phase === phase) drainEntry(entry)
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
        mode,
        ms: budget.ms,
        targetMs: mode === 'deadline' ? frameTarget : undefined,
        allowanceMs: allowance,
        renderEstimateMs: renderEstimate.value,
        spentMs: spentThisFrame,
        mustDrainSpentMs: mustDrainSpent,
        overMs: Math.max(0, spentThisFrame - Math.max(allowance, minMs)),
        forcedThisFrame: forcedMs.length,
        forcedMs: [...forcedMs],
        debtMs: debt,
        queues: entries.map(queueStats),
      }
    },
    dispose() {
      for (const entry of entries.splice(0)) entry.queue.detach?.()
    },
  }
  return budget
}
