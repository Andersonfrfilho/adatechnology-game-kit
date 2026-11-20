export const FRAME_PHASES = ['input', 'fixedSimulate', 'lateSimulate', 'present', 'render', 'idle'] as const
export type FramePhase = (typeof FRAME_PHASES)[number]

/**
 * Presentation work a system leaves for later frames, run in small units within a shared time budget.
 * Never simulation: nothing that consumes a seeded generator or decides an outcome may wait in a queue.
 */
export interface DeferredQueue {
  /** Stable name for stats and logs (see `DEFERRED_QUEUE_ID`). */
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
  /** The queue runs to empty in the drain of its phase, outside the frame deadline and the budget (the blow's visible effect). Counted apart. Default false. */
  readonly mustDrain?: boolean
}

/** The ids of the kit's queues: what `DeferredQueue.id` says and what `DEFERRED_PRIORITY` is keyed by. */
export const DEFERRED_QUEUE_ID = {
  DESTRUCTION_EVENTS: 'destruction.events',
  BREACH_PAINT: 'floorplan.breach-paint',
  BREACH_CUT: 'floorplan.breach-cut',
  AUDIO_VOICES: 'audio.voices',
  VEHICLE_CREASE: 'vehicles.crease',
  AUDIO_OCCLUSION: 'audio.occlusion',
  FLUID_FILM: 'fluids.film',
  VEHICLE_LOD_BATCH: 'vehicles.lod-batch',
  SETTLED_BATCH: 'destruction.settled-batch',
  STATIC_BATCH: 'render.static-batch',
  ANIMALS_STATIC_BATCH: 'animals.static-batch',
  CHARACTERS_STATIC_BATCH: 'characters.static-batch',
  HOUSE_SHADOW_BATCH: 'floorplan.shadow-batch',
  DESTRUCTION_PREFIT: 'destruction.prefit',
} as const

/** Default priorities and reserves of the kit's queues; a host may override any of them. */
export const DEFERRED_PRIORITY = {
  [DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS]: { priority: 300, phase: 'present' },
  // every frame: the walls cut since the last frame are painted once each, and a hole must show in the frame of the blast
  [DEFERRED_QUEUE_ID.BREACH_CUT]: { priority: 260, phase: 'present', minEveryFrames: 1 },
  [DEFERRED_QUEUE_ID.BREACH_PAINT]: { priority: 250, phase: 'present', minEveryFrames: 1 },
  [DEFERRED_QUEUE_ID.AUDIO_VOICES]: { priority: 200, phase: 'idle', reserveMs: 1 },
  [DEFERRED_QUEUE_ID.AUDIO_OCCLUSION]: { priority: 190, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.FLUID_FILM]: { priority: 120, phase: 'idle', minEveryFrames: 2 },
  [DEFERRED_QUEUE_ID.VEHICLE_CREASE]: { priority: 100, phase: 'idle' },
  [DEFERRED_QUEUE_ID.VEHICLE_LOD_BATCH]: { priority: 90, phase: 'idle', minEveryFrames: 4 },
  [DEFERRED_QUEUE_ID.SETTLED_BATCH]: { priority: 70, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.STATIC_BATCH]: { priority: 60, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.ANIMALS_STATIC_BATCH]: { priority: 60, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.CHARACTERS_STATIC_BATCH]: { priority: 60, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.HOUSE_SHADOW_BATCH]: { priority: 50, phase: 'idle', minEveryFrames: 8 },
  [DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT]: { priority: 40, phase: 'idle', minEveryFrames: 30 },
} as const satisfies Readonly<Record<string, DeferredQueueOptions>>

/** The queues that may register with `mustDrain: true`: a new one needs the owner's decision (CLAUDE.md §15), and `budget.register` throws for any other. */
export const MUST_DRAIN_QUEUE_IDS: ReadonlySet<string> = new Set([DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS, DEFERRED_QUEUE_ID.BREACH_CUT])

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

/** Drains a queue no budget registered (D2): runs it until `budgetMs` from now. The one place outside game-runtime that times deferred work. */
export function drainDetached(queue: DeferredQueue, budgetMs: number, clock: () => number = () => performance.now()): number {
  return queue.run(clock() + budgetMs, clock)
}
