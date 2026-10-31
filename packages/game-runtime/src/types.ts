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
  /** Frame budget for the deferred queues, ms. Default 4. */
  readonly budgetMs?: number
  /** Milliseconds clock; default `performance.now` (or `Date.now`). Tests inject a fake. */
  readonly clock?: () => number
  /** A system that throws: default logs once per system id and keeps the frame going. */
  readonly onError?: (error: unknown, system: { id: string; phase: FramePhase }) => void
}

export interface FrameRunOptions {
  /** false skips the render phase (headless tests, `room.update`). Default true. */
  readonly render?: boolean
  /** false skips input, fixedSimulate and lateSimulate (a scenario is stepping the world synchronously). Default true. */
  readonly simulate?: boolean
  /**
   * true: `realSeconds` is used as given. No clamp, no snap, no `maxSubsteps` cap (every whole fixed step runs, the remainder stays in the
   * accumulator, nothing goes to `droppedSeconds`), one `input` with `dt = realSeconds` and one `lateSimulate` with `dt = realSeconds * scale`.
   */
  readonly exact?: boolean
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
  readonly framesWaiting: number
  readonly maxFramesWaiting: number
  readonly forced: number
}

export interface BudgetStats {
  readonly ms: number
  /** Milliseconds spent by the queues in the last frame. */
  readonly spentMs: number
  /** Milliseconds the last frame went over; repaid by the next one (capped at one budget). */
  readonly debtMs: number
  readonly queues: readonly QueueStats[]
}

export interface FrameBudget {
  /** Milliseconds per frame shared by every queue. Default 4. */
  ms: number
  /** Calls `queue.attach?.()`; the returned function calls `queue.detach?.()` and takes it out. */
  register(queue: DeferredQueue, options: DeferredQueueOptions): () => void
  /** Starts a frame: counter, reserves and debt. The scheduler calls it; `drain('present')` starts one by itself when none is open. */
  beginFrame(): void
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
}
