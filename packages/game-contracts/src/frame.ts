export const FRAME_PHASES = ['input', 'fixedSimulate', 'lateSimulate', 'present', 'render', 'idle'] as const
export type FramePhase = (typeof FRAME_PHASES)[number]

/**
 * Presentation work a system leaves for later frames, run in small units within a shared time budget.
 * Never simulation: nothing that consumes a seeded generator or decides an outcome may wait in a queue.
 */
export interface DeferredQueue {
  /** Stable name for stats and logs (`audio.voices`, `destruction.events`). */
  readonly id: string
  /**
   * Units waiting. 0 means idle; the budget skips the queue without calling `run`. `frame` is the budget's frame counter: a queue may
   * report 0 for the rest of a frame (the crease queue does in the frame a panel was torn). Same value for repeated calls in one frame.
   */
  pending(frame?: number): number
  /**
   * Runs units in order until `clock() >= deadline`. Contract: when `pending() > 0` it runs **at least one** unit, even with a deadline
   * already past; it never runs a unit after it saw the deadline pass. Returns how many units it ran.
   */
  run(deadline: number, clock: () => number): number
  /** Runs everything now (synchronous step, clear, dispose). */
  flush(): void
  /**
   * Called by `budget.register`: from now on the owner stops draining on its own (no MessageChannel, no drain inside `update`).
   * Never called by a getter; a queue nobody registered keeps today's internal draining.
   */
  attach?(): void
  /** Called by the unregister function and by `budget.dispose`: the owner goes back to its internal draining. */
  detach?(): void
}

/** Where a module registers a deferred queue with the host's budget. */
export interface DeferredQueueOptions {
  /** Higher runs first. See DEFERRED_PRIORITY. */
  readonly priority: number
  /** `present` runs before the render (the work must show this frame); `idle` runs after it. Default `idle`. */
  readonly phase?: 'present' | 'idle'
  /** Starvation guard: the queue runs at least one unit every this many frames, even with the budget spent. Default 4. */
  readonly minEveryFrames?: number
  /** Milliseconds of every frame kept for this queue before the others share the rest (when it has work). Default 0. */
  readonly reserveMs?: number
}

/** Default priorities and reserves of the kit's queues; a host may override any of them. */
export const DEFERRED_PRIORITY = {
  'destruction.events': { priority: 300, phase: 'present' },
  'floorplan.breach-paint': { priority: 250, phase: 'present' },
  'audio.voices': { priority: 200, phase: 'idle', reserveMs: 1 },
  'vehicles.crease': { priority: 100, phase: 'idle' },
} as const satisfies Readonly<Record<string, DeferredQueueOptions>>

export interface DeferredQueueReport {
  readonly ok: boolean
  readonly problems: readonly string[]
}

/**
 * Checks the `DeferredQueue` contract. `fill` leaves the queue with at least two units waiting (the same call is made on a fresh queue).
 * It cannot prove the queue only carries presentation work: that is a rule of review.
 */
export function checkDeferredQueue(queue: DeferredQueue, fill: () => void): DeferredQueueReport {
  const problems: string[] = []
  fill()
  const waiting = queue.pending(1)
  if (waiting < 2) problems.push(`fill() must leave at least 2 units waiting (pending is ${waiting})`)
  if (queue.pending(1) !== waiting) problems.push('pending(frame) changed between two calls in the same frame')
  const ran = queue.run(0, () => 1)
  if (ran !== 1) problems.push(`run with a deadline already past must run exactly one unit (ran ${ran})`)
  if (waiting >= 2 && queue.pending(2) !== waiting - 1) problems.push(`one unit ran but pending went from ${waiting} to ${queue.pending(2)}`)
  try {
    queue.attach?.()
    queue.attach?.()
    queue.detach?.()
    queue.detach?.()
  } catch (error) {
    problems.push(`attach/detach must be idempotent: ${error instanceof Error ? error.message : String(error)}`)
  }
  queue.flush()
  if (queue.pending(3) !== 0) problems.push(`flush must leave nothing pending (pending is ${queue.pending(3)})`)
  if (queue.run(0, () => 1) !== 0) problems.push('run on an empty queue must run no unit')
  return { ok: problems.length === 0, problems }
}
