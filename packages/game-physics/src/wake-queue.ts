export interface WakeQueueOptions {
  /** Milliseconds of physics step a frame may reach by waking more: batches are sized so the last frame's step plus the woken bodies' cost stays under it. Default `DEFAULT_WAKE_COST_TARGET_MS`. */
  readonly costTargetMs?: number
  /** Seconds an entry waits at most, whatever the cost: a blast's debris is all awake within tens of ms. Default `DEFAULT_MAX_WAKE_DELAY`. */
  readonly maxDelay?: number
  /** Entries kept at most: over it the lowest priority (the farthest) are released at once, so the queue stays bounded. Default `DEFAULT_MAX_QUEUED_WAKES`. */
  readonly maxQueued?: number
  /** Entries released every frame at least, so a queue behind a heavy frame still drains. Default `DEFAULT_MIN_WAKES_PER_FRAME`. */
  readonly minPerFrame?: number
}

/** The B6 production bench's p99 target (spec 008, evidence T3.6d): no frame of the step above it. */
export const DEFAULT_WAKE_COST_TARGET_MS = 4
export const DEFAULT_MAX_WAKE_DELAY = 0.08
export const DEFAULT_MAX_QUEUED_WAKES = 2048
export const DEFAULT_MIN_WAKES_PER_FRAME = 8

interface Entry<TItem> {
  readonly item: TItem
  readonly priority: number
  readonly maxDelay: number
  waited: number
}

/**
 * Wakes debris in batches instead of all in the frame of a blast: the host pushes what it would wake, nearest the player first (lower priority number first), and
 * each frame `release` hands back as many as the aggregate cost measured on the previous frames leaves room for under the target. Nothing is timed per body.
 */
export class WakeQueue<TItem> {
  private entries: Array<Entry<TItem>> = []
  private readonly costTargetMs: number
  private readonly maxDelay: number
  private readonly maxQueued: number
  private readonly minPerFrame: number

  constructor(options: WakeQueueOptions = {}) {
    this.costTargetMs = options.costTargetMs ?? DEFAULT_WAKE_COST_TARGET_MS
    this.maxDelay = options.maxDelay ?? DEFAULT_MAX_WAKE_DELAY
    this.maxQueued = options.maxQueued ?? DEFAULT_MAX_QUEUED_WAKES
    this.minPerFrame = options.minPerFrame ?? DEFAULT_MIN_WAKES_PER_FRAME
  }

  get size(): number {
    return this.entries.length
  }

  /** `priority`: lower comes out first (the distance to the player, or to the blast when there is no player). `maxDelay` overrides the queue's for this entry. */
  push(priority: number, item: TItem, maxDelay?: number): void {
    this.entries.push({ item, priority, maxDelay: maxDelay ?? this.maxDelay, waited: 0 })
  }

  /**
   * One frame of `dt` seconds: `lastStepMs` is what the step of the previous frame cost, `costPerBodyMs` the world's cost of an awake body (aggregate, smoothed). What
   * waited its maximum, and what passes the queue's bound, comes out whatever the cost. `limit` caps the batch the cost sizes (what a shared `WorkBudget` leaves for
   * waking this frame), never under `minPerFrame`.
   */
  release(dt: number, lastStepMs: number, costPerBodyMs: number, limit = Infinity): TItem[] {
    if (this.entries.length === 0) return []
    for (const entry of this.entries) entry.waited += dt
    this.entries.sort((a, b) => a.priority - b.priority)
    const room = Math.floor((this.costTargetMs - lastStepMs) / Math.max(costPerBodyMs, 1e-6))
    const batch = Math.max(this.minPerFrame, Math.min(room, limit))
    const out: TItem[] = []
    const kept: Array<Entry<TItem>> = []
    for (const entry of this.entries) {
      if (out.length < batch || entry.waited >= entry.maxDelay) out.push(entry.item)
      else kept.push(entry)
    }
    // the queue stays bounded: what is over the bound, the farthest, goes now
    while (kept.length > this.maxQueued) out.push((kept.pop() as Entry<TItem>).item)
    this.entries = kept
    return out
  }

  clear(): void {
    this.entries = []
  }

  /** What waits, in queue order, for a save: the items are the host's own data (the host keeps them saveable). */
  saveState(): WakeQueueState<TItem> {
    return this.entries.map((entry) => ({ item: entry.item, priority: entry.priority, maxDelay: entry.maxDelay, waited: entry.waited }))
  }

  restoreState(state: WakeQueueState<TItem>): void {
    this.entries = state.map((entry) => ({ ...entry }))
  }
}

export type WakeQueueState<TItem> = ReadonlyArray<{ readonly item: TItem; readonly priority: number; readonly maxDelay: number; readonly waited: number }>

/** Milliseconds an awake body costs a step once the pile is awake, and in the frame it wakes (the world's step over its awake bodies; B6 production world, evidence T3.6d): until the world has been measured. */
export const DEFAULT_PHYSICS_COST_PER_BODY_MS = 0.0022
export const DEFAULT_WAKE_COST_PER_BODY_MS = 0.02

const COST_SMOOTHING = 0.1
/** Frames with fewer awake bodies than this say nothing about the cost of a body (the step has a floor of its own); a jump of this many awake bodies is a wake. */
const MIN_BODIES_TO_MEASURE = 16

/**
 * The world's cost per awake body from the aggregate of each frame (`PhysicsFrame.stepMs` over `activeCount`), smoothed; nothing is timed per body. Two readings: `costPerBodyMs`
 * in steady frames, and `wakeCostPerBodyMs` in the frames a pile wakes in (a woken island costs several times what the same bodies cost once settled in), which is what sizes the
 * batches of a wake queue.
 */
export class PhysicsCostMeter {
  private perBodyMs: number
  private wakePerBodyMs: number
  private lastAwake = 0

  constructor(
    private readonly priorMs: number = DEFAULT_PHYSICS_COST_PER_BODY_MS,
    private readonly wakePriorMs: number = DEFAULT_WAKE_COST_PER_BODY_MS,
  ) {
    this.perBodyMs = priorMs
    this.wakePerBodyMs = wakePriorMs
  }

  /** Back to the priors, as a world that was never measured. */
  reset(): void {
    this.perBodyMs = this.priorMs
    this.wakePerBodyMs = this.wakePriorMs
    this.lastAwake = 0
  }

  saveState(): PhysicsCostMeterState {
    return { perBodyMs: this.perBodyMs, wakePerBodyMs: this.wakePerBodyMs, lastAwake: this.lastAwake }
  }

  restoreState(state: PhysicsCostMeterState): void {
    this.perBodyMs = state.perBodyMs
    this.wakePerBodyMs = state.wakePerBodyMs
    this.lastAwake = state.lastAwake
  }

  get costPerBodyMs(): number {
    return this.perBodyMs
  }

  get wakeCostPerBodyMs(): number {
    return this.wakePerBodyMs
  }

  observe(stepMs: number, awakeBodies: number): void {
    const woke = awakeBodies - this.lastAwake >= MIN_BODIES_TO_MEASURE
    this.lastAwake = awakeBodies
    if (awakeBodies < MIN_BODIES_TO_MEASURE || stepMs <= 0) return
    const sample = stepMs / awakeBodies
    if (woke) this.wakePerBodyMs += COST_SMOOTHING * (sample - this.wakePerBodyMs)
    else this.perBodyMs += COST_SMOOTHING * (sample - this.perBodyMs)
  }
}

export interface PhysicsCostMeterState {
  readonly perBodyMs: number
  readonly wakePerBodyMs: number
  readonly lastAwake: number
}

/** Pieces of one blast that enter physics, at least and at most, and the milliseconds of step (in the frame they wake) the debris of one blast may add: the count follows the measured wake cost between them. */
export const DEFAULT_MIN_PHYSICS_PIECES = 24
export const DEFAULT_MAX_PHYSICS_PIECES = 300
export const DEFAULT_PHYSICS_COST_TARGET_MS = 5
/** Longest side (m) under which a loosened object is a chip. */
export const DEFAULT_CHIP_SIZE = 0.15

export interface PhysicsPieceBudget {
  readonly minPieces?: number
  readonly maxPieces?: number
  readonly costTargetMs?: number
}

/** How many pieces of a blast may enter physics now: what the cost target leaves after the bodies already awake (at the wake cost per body), between the minimum and the maximum. */
export const physicsPieceCount = (budget: PhysicsPieceBudget, wakeCostPerBodyMs: number, awakeBodies: number): number => {
  const room = Math.floor((budget.costTargetMs ?? DEFAULT_PHYSICS_COST_TARGET_MS) / Math.max(wakeCostPerBodyMs, 1e-6)) - awakeBodies
  return Math.min(budget.maxPieces ?? DEFAULT_MAX_PHYSICS_PIECES, Math.max(budget.minPieces ?? DEFAULT_MIN_PHYSICS_PIECES, room))
}

export interface DebrisCandidate {
  /** Longest side of its box (m). */
  readonly size: number
  /** What orders them: the distance to the player (the blast's centre when there is none); lower goes first. */
  readonly distance: number
}

/**
 * Which candidates enter physics: the big ones first (nearest first), then the chips (nearest first), up to `count`; the rest are chips without a body. A big one is never
 * passed over for a chip.
 */
export const chooseForPhysics = <TCandidate extends DebrisCandidate>(candidates: readonly TCandidate[], count: number, chipSize: number = DEFAULT_CHIP_SIZE): { physics: TCandidate[]; chips: TCandidate[] } => {
  const byDistance = (a: DebrisCandidate, b: DebrisCandidate): number => a.distance - b.distance
  const big = candidates.filter((c) => c.size >= chipSize).sort(byDistance)
  const small = candidates.filter((c) => c.size < chipSize).sort(byDistance)
  const ordered = [...big, ...small]
  return { physics: ordered.slice(0, Math.max(0, count)), chips: ordered.slice(Math.max(0, count)) }
}
