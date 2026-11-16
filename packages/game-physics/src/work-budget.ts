/**
 * The kinds of deferred work that draw from one frame's budget, in the fixed order they draw (spec 008, `design/orcamento-da-explosao.md` §4 E2): the events of the frame
 * first (their effects show in the frame they happen), then the loose groups that become pieces, the fragments still to spawn, the box fits ahead of a blow, the ground
 * laid under new pieces, the bodies made for them and the debris woken.
 */
export const WORK_KINDS = ['event', 'split', 'fragment', 'prefit', 'ground', 'body', 'wake'] as const
export type WorkKind = (typeof WORK_KINDS)[number]

export interface WorkBudgetOptions {
  /** Milliseconds of deferred physics work a frame may take on the reference machine (B6: no frame of physics above 5 ms, p99 at 4). Default `DEFAULT_WORK_BUDGET_MS`. */
  readonly budgetMs?: number
  /** Work units one millisecond holds on the reference machine (the calibration of the unit costs). Default `DEFAULT_WORK_UNITS_PER_MS`. */
  readonly unitsPerMs?: number
  /**
   * How much slower than the reference this machine runs the same work (1 = the reference, 4 = four times slower): the frame holds that many times fewer units, so the
   * work spreads over more frames. Picked once per session (from a measurement of the host's, or a setting) and kept in saves and replays: the clock never decides a frame.
   */
  readonly tier?: number
  /** Frames a queued unit of work waits at most, whatever the budget: past it, it runs (nothing waits for ever, a loose group does not hang for long). Default `DEFAULT_MAX_WAIT_FRAMES`. */
  readonly maxWaitFrames?: number
}

/** The B6 p99 target (spec 008): the deferred work of a frame stays under it on the reference machine. */
export const DEFAULT_WORK_BUDGET_MS = 4
/** 1 unit = 10 µs on the reference machine ("Intel Core Ultra 9 275HX, Node 24"; evidence T3.8aa): the unit costs are written in it. */
export const DEFAULT_WORK_UNITS_PER_MS = 100
/** 0.5 s at 60 Hz: the house of the T3.8aa probe was cut into its 50 pieces over ~20 frames under the room's 8 ms clock budget before this budget existed. */
export const DEFAULT_MAX_WAIT_FRAMES = 30

export interface WorkBudgetState {
  readonly left: number
  readonly frame: number
  readonly spent: ReadonlyArray<readonly [WorkKind, number]>
}

/**
 * One frame's budget of deferred work, in units, that every queue draws from in a fixed order: the arbiter of the explosion's work. Nothing here reads a clock, so the
 * same session spreads the same work over the same frames on every machine of the same tier (the Jolt run repeats only with the same order of calls).
 */
export class WorkBudget {
  /** Units each frame holds: `budgetMs × unitsPerMs / tier`. */
  readonly unitsPerFrame: number
  readonly maxWaitFrames: number
  private left: number
  private frameCount = 0
  private readonly spentBy = new Map<WorkKind, number>()

  constructor(options: WorkBudgetOptions = {}) {
    const budgetMs = options.budgetMs ?? DEFAULT_WORK_BUDGET_MS
    const unitsPerMs = options.unitsPerMs ?? DEFAULT_WORK_UNITS_PER_MS
    const tier = Math.max(options.tier ?? 1, 1e-3)
    this.unitsPerFrame = Math.max(0, Math.floor((budgetMs * unitsPerMs) / tier))
    this.maxWaitFrames = Math.max(0, Math.floor(options.maxWaitFrames ?? DEFAULT_MAX_WAIT_FRAMES))
    this.left = this.unitsPerFrame
  }

  /** A new frame: the budget is full again. */
  beginFrame(): void {
    this.left = this.unitsPerFrame
    this.frameCount++
    this.spentBy.clear()
  }

  /** Frames begun since the budget was made (or restored). */
  get frame(): number {
    return this.frameCount
  }

  /** Units left in this frame (negative after forced work went over). */
  get remaining(): number {
    return this.left
  }

  /** Units each kind took this frame. */
  spent(kind: WorkKind): number {
    return this.spentBy.get(kind) ?? 0
  }

  /** Takes `units` when they fit in what is left of the frame; else takes nothing and says no. */
  tryTake(kind: WorkKind, units: number): boolean {
    if (units > this.left) return false
    this.take(kind, units)
    return true
  }

  /** Takes `units` whatever is left: work that may not wait (an event's effects, a unit past its wait). The frame may go over; what draws after it finds nothing left. */
  take(kind: WorkKind, units: number): void {
    this.left -= units
    this.spentBy.set(kind, (this.spentBy.get(kind) ?? 0) + units)
  }

  /** How many items of `unitsEach` fit in what is left, at least `atLeast`. */
  fits(unitsEach: number, atLeast = 0): number {
    return Math.max(atLeast, Math.floor(Math.max(0, this.left) / Math.max(unitsEach, 1e-9)))
  }

  saveState(): WorkBudgetState {
    return { left: this.left, frame: this.frameCount, spent: [...this.spentBy.entries()] }
  }

  restoreState(state: WorkBudgetState): void {
    this.left = state.left
    this.frameCount = state.frame
    this.spentBy.clear()
    for (const [kind, units] of state.spent) this.spentBy.set(kind, units)
  }
}

/** One queued unit of work, as data (an id and numbers), never a closure: a save in the middle of a blast keeps it. */
export interface QueuedWork<TItem> {
  readonly item: TItem
  /** Lower goes first: the distance to the player (or to the blast), read once when it was queued. */
  readonly priority: number
  /** A stable tie-break (an id): the same order on every run. */
  readonly key: string
  /** Units it costs, estimated when it was queued from the size of the work (never from what a cache holds). */
  readonly units: number
  waited: number
}

export type WorkQueueState<TItem> = ReadonlyArray<QueuedWork<TItem>>

/**
 * Work waiting its turn under a `WorkBudget`: each frame, what waited `maxWaitFrames` runs whatever the cost, then the rest in priority order while it fits, at least one
 * a frame so the queue always drains.
 */
export class WorkQueue<TItem> {
  private entries: Array<QueuedWork<TItem>> = []

  constructor(private readonly kind: WorkKind) {}

  get size(): number {
    return this.entries.length
  }

  push(item: TItem, priority: number, key: string, units: number): void {
    this.entries.push({ item, priority, key, units, waited: 0 })
  }

  /** Whether an entry with this key waits. */
  has(key: string): boolean {
    return this.entries.some((entry) => entry.key === key)
  }

  /** Drops what `drop` says (work that no longer exists). */
  remove(drop: (item: TItem) => boolean): void {
    this.entries = this.entries.filter((entry) => !drop(entry.item))
  }

  /** This frame's turn: the items to run now, in the order to run them; the rest wait one frame more. */
  release(budget: WorkBudget): TItem[] {
    if (this.entries.length === 0) return []
    this.entries.sort((a, b) => a.priority - b.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    const out: TItem[] = []
    const kept: Array<QueuedWork<TItem>> = []
    for (const entry of this.entries) {
      if (entry.waited >= budget.maxWaitFrames) {
        budget.take(this.kind, entry.units)
        out.push(entry.item)
      } else kept.push(entry)
    }
    const waiting: Array<QueuedWork<TItem>> = []
    for (const entry of kept) {
      const fits = budget.tryTake(this.kind, entry.units)
      if (fits || out.length === 0) {
        if (!fits) budget.take(this.kind, entry.units)
        out.push(entry.item)
      } else waiting.push(entry)
    }
    for (const entry of waiting) entry.waited++
    this.entries = waiting
    return out
  }

  clear(): void {
    this.entries = []
  }

  saveState(): WorkQueueState<TItem> {
    return this.entries.map((entry) => ({ ...entry }))
  }

  restoreState(state: WorkQueueState<TItem>): void {
    this.entries = state.map((entry) => ({ ...entry }))
  }
}
