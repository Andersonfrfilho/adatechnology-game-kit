import type { DeferredQueue, DeferredQueueOptions, FramePhase } from '@adatechnology/game-contracts'

export interface FrameContext {
  /** Seconds this phase advances (see the phase table of the design). */
  readonly dt: number
  /** Real seconds of this frame after the clamp and the snap, never scaled, not 0 when paused. */
  readonly realDt: number
  /** The fixed step, seconds (1/60 by default). */
  readonly fixedDt: number
  /** Accumulator / fixedDt after the fixed phase, in [0, 1). 0 inside and right after `advance`. */
  readonly alpha: number
  /** Frames since start. */
  readonly frame: number
  /** Fixed steps run since start: the clock of everything seeded. Inside `fixedSimulate`, the index of the step being run. */
  readonly tick: number
  /** Index of the substep inside this frame (fixedSimulate only), else 0. */
  readonly substep: number
  /** Simulated seconds since start (sum of the dt given to lateSimulate). */
  readonly simTime: number
  readonly paused: boolean
  /** true inside `advance` (a scenario steps the world): systems that do not run in a scenario step read it and skip. */
  readonly scripted: boolean
  /** false in a frame run with `simulate: false` (the display frame while a scenario steps the world), true otherwise. */
  readonly simulated: boolean
  /** true in a frame run with `freezeFixed: true`: no fixed step runs and the accumulator does not move; input, lateSimulate and the effects do. */
  readonly fixedFrozen: boolean
}

export type SystemFn = (ctx: FrameContext) => void

export interface SystemOptions {
  readonly phase: FramePhase
  /** Lower first; ties keep the order of registration. Default 0. */
  readonly order?: number
  /** For stats and errors. */
  readonly id?: string
}

export interface SchedulerOptions {
  /** Default 1/60. */
  readonly fixedDt?: number
  /** Default 4. What is left after the last substep is dropped (`stats().droppedSeconds`). */
  readonly maxSubsteps?: number
  /** Real seconds of one frame are clamped to this. Default 0.25. */
  readonly maxFrameSeconds?: number
  /** A frame time within this many ms of a whole number of fixed steps is snapped to it. Default 0.25. 0 turns it off. */
  readonly snapMs?: number
  /** Frame budget for the deferred queues, ms. Default 4. With `targetMs` it is the ceiling of a frame that has a deadline. */
  readonly budgetMs?: number
  /** Frame deadline, ms (16.6 at 60 Hz): turns on the deadline mode for the frames that carry `frameStartMs`. Absent: the quota of today. */
  readonly targetMs?: number
  /** Floor of the deadline mode, ms: the queues get at least this much of a frame. Default 1. */
  readonly minBudgetMs?: number
  /** The queue ids that may register with `mustDrain: true` (see `FrameBudgetOptions.mustDrainIds`). Default `MUST_DRAIN_QUEUE_IDS` of game-contracts. */
  readonly mustDrainIds?: ReadonlySet<string>
  /** Milliseconds clock; default `performance.now` (or `Date.now`). Tests inject a fake. */
  readonly clock?: () => number
  /**
   * Asked at the start of each frame and before each fixed step: true holds the world as `FrameRunOptions.freezeFixed` does, from that point of the frame on (the steps of
   * the frame not run yet are dropped, not kept for later: held time does not count). A host whose fixed step started heavy work it spreads over frames (a blast) holds
   * the steps until the work is done, so no step runs in between. Default: never held.
   */
  readonly holdFixed?: () => boolean
  /** A system that throws: default logs once per system id and keeps the frame going. */
  readonly onError?: (error: unknown, system: { id: string; phase: FramePhase }) => void
}

export interface FrameRunOptions {
  /** false skips the render phase (headless tests, `room.update`). Default true. */
  readonly render?: boolean
  /** false skips input, fixedSimulate and lateSimulate (a scenario is stepping the world synchronously). Default true. */
  readonly simulate?: boolean
  /**
   * true freezes the world for this frame: no fixed step runs and the frame's time is not fed to the accumulator (the remainder from before stays as it was, so the
   * frames after it step as if this one had not happened), while input, lateSimulate (effects, sound, camera) and the queues run with the frame's `dt`. A host
   * spreading heavy simulated work over frames (a blast cast a few rays per frame) holds the ticks with it. Default false. Ignored with `simulate: false`.
   */
  readonly freezeFixed?: boolean
  /**
   * true: `realSeconds` is used as given. No clamp, no snap, no `maxSubsteps` cap (every whole fixed step runs, the remainder stays in the
   * accumulator, nothing goes to `droppedSeconds`), one `input` with `dt = realSeconds` and one `lateSimulate` with `dt = realSeconds * scale`.
   */
  readonly exact?: boolean
  /**
   * Start of this display frame, the `requestAnimationFrame` timestamp (`startLoop` fills it). With it, and a budget `targetMs`, the frame is run in the
   * deadline mode: the queues get what is left until `frameStartMs + targetMs`. A value that is not within one `targetMs` before the scheduler clock (another
   * time base, or a callback a whole frame late) is read as "now". Absent (headless, `advance`, tests): the quota of today.
   */
  readonly frameStartMs?: number
}

export interface Command {
  readonly kind: string
  readonly tick: number
  readonly payload?: unknown
}

export interface CommandBuffer {
  /** From `input`: valid from the next fixed tick (or from `tick`, for a replay). */
  push(kind: string, payload?: unknown, tick?: number): void
  /** From the first fixedSimulate system: the commands due at this tick or before, in push order. They leave the buffer. */
  take(tick: number): readonly Command[]
  /** Drops every pending command. */
  clear(): void
}

export interface QueueStats {
  readonly id: string
  readonly pending: number
  readonly ranUnits: number
  readonly spentMs: number
  /** Milliseconds this queue spent in the last frame. */
  readonly lastSpentMs: number
  /** Registered with `mustDrain`: its time is counted in `mustDrainSpentMs`, outside the deadline. */
  readonly mustDrain: boolean
  readonly framesWaiting: number
  readonly maxFramesWaiting: number
  readonly forced: number
}

export interface BudgetStats {
  /** Mode of the last frame: `deadline` only with a `targetMs` and a `frameStartMs`. */
  readonly mode: 'quota' | 'deadline'
  /** Ceiling (deadline) or quota (quota) per frame. */
  readonly ms: number
  /** Deadline of the last frame; undefined in the quota mode. */
  readonly targetMs: number | undefined
  /** What the queues could spend in the last frame: the deadline's `A` (between the floor and `ms`), or `ms` minus the debt in the quota mode. */
  readonly allowanceMs: number
  /** Moving average of the render phase used to reserve its time. */
  readonly renderEstimateMs: number
  /** Milliseconds spent in the last frame by the queues that are not `mustDrain`. */
  readonly spentMs: number
  /** Milliseconds spent in the last frame by the `mustDrain` queues (outside the deadline). */
  readonly mustDrainSpentMs: number
  /** `max(0, spentMs - max(allowanceMs, floor))`: the excess the frame spent. At most one unit that crosses the deadline plus the forced units. */
  readonly overMs: number
  /** Units the starvation guard forced in the last frame, and the cost of each. */
  readonly forcedThisFrame: number
  readonly forcedMs: readonly number[]
  /** Milliseconds the last frame went over; repaid by the next one (capped at one budget). Quota mode only. */
  readonly debtMs: number
  readonly queues: readonly QueueStats[]
}

export interface FrameBudget {
  /** Milliseconds per frame shared by every queue. Default 4. */
  ms: number
  /** Calls `queue.attach?.()`; the returned function calls `queue.detach?.()` and takes it out. */
  register(queue: DeferredQueue, options: DeferredQueueOptions): () => void
  /** Frame deadline, ms (mutable: the host changes it with the monitor or the frame cap). Undefined: the quota mode. */
  targetMs: number | undefined
  /** Mode of the frame in course (or the last one): `deadline` only with a `targetMs` and a `frameStartMs`. */
  readonly mode: 'quota' | 'deadline'
  /**
   * Starts a frame: counter, reserves and debt. The scheduler calls it; `drain('present')` starts one by itself when none is open (quota mode).
   * With `frameStartMs` (the clock's time base) and a `targetMs` the frame has a deadline and no debt.
   */
  beginFrame(frameStartMs?: number): void
  /** The scheduler reports the milliseconds of the render phase of a frame; it feeds the estimate (clamped to `[0, targetMs]`). */
  recordRender(ms: number): void
  /** Called by a system of the frame whose render was not a typical one (frame pacer skipped it, warm-up ran): the frame's render sample is dropped. */
  skipRenderSample(): void
  /** Drains the queues of one phase; the scheduler calls it, a host without the scheduler may too. */
  drain(phase: 'present' | 'idle'): void
  /** Every queue to empty, now (synchronous step, clear). */
  flushAll(): void
  /** Unbounded: every drain runs every queue to empty (scenarios, goldens). */
  unbounded: boolean
  stats(): BudgetStats
  /** Detaches every queue (each owner goes back to its internal draining). */
  dispose(): void
}

export interface SchedulerStats {
  readonly frame: number
  readonly tick: number
  readonly substepsLastFrame: number
  readonly droppedSeconds: number
  /** Milliseconds per phase in the last frame. */
  readonly phaseMs: Readonly<Record<FramePhase, number>>
  readonly budget: BudgetStats
}

/** Measurement hook around every system of every phase (set by a probe, never by a game); without one the cost is a property read per system. */
export interface SystemProbe {
  enter(id: string): void
  leave(id: string): void
}

export interface Scheduler {
  add(system: SystemFn, options: SystemOptions): () => void
  /** Runs one frame with `realSeconds` of wall time. */
  frame(realSeconds: number, options?: FrameRunOptions): void
  /**
   * Advances `seconds` of simulation synchronously, in steps of `dt` (default fixedDt), with no render, `ctx.scripted = true` and the budget
   * unbounded (every queue drained each step). Resets the accumulator before and after (`alpha = 0`). For scenarios and tests.
   */
  advance(seconds: number, options?: { readonly dt?: number }): void
  pause(): void
  resume(): void
  readonly paused: boolean
  /** 1 = real time, 0.25 = slow motion. Scales fixedSimulate's accumulator and lateSimulate/present dt. */
  timeScale: number
  /** Forgets the accumulator and the snap residue (after the tab comes back, after a reset). */
  resetClock(): void
  readonly budget: FrameBudget
  /** Set by a measuring tool to time each system; undefined (the default) times nothing. */
  systemProbe: SystemProbe | undefined
  /** Commands the input phase leaves for the next fixed tick. */
  readonly commands: CommandBuffer
  stats(): SchedulerStats
  dispose(): void
}

export interface LoopOptions {
  /** Default `globalThis.requestAnimationFrame` / `cancelAnimationFrame`; a host without them passes its own (tests, workers). */
  readonly requestFrame?: (callback: (nowMs: number) => void) => number
  readonly cancelFrame?: (handle: number) => void
  /** Timestamp the first frame is measured from; default `performance.now()`. */
  readonly startMs?: number
  /** Called first in every frame with the unclamped real seconds (the room's metrics). */
  readonly onFrame?: (realSeconds: number) => void
  /** true: this frame only presents and renders (a scenario is stepping the world). */
  readonly skipSimulation?: () => boolean
  /**
   * The least milliseconds between two frames that run (a frame cap): a display frame that comes sooner is skipped and its time goes to the next one. Asked on
   * every display frame, so the cap may change while the loop runs; 0 or absent runs every display frame.
   */
  readonly minFrameMs?: () => number
}
