import type { PhysicsWorld, SeamWorld } from './contract'

/** Where a phase runs: `crowd` and `actors` before each fixed step, `contacts` then `rules` once per frame after the steps. */
export type PhaseOrder = 'crowd' | 'actors' | 'contacts' | 'rules'

export interface PhysicsFrame {
  /** The loop's time (s), summed one fixed step at a time. */
  readonly time: number
  /** Fixed steps this frame runs: 0 in a short frame (`afterSteps` then sees no events, the loop cleared the old ones). */
  readonly steps: number
  /** The fraction of a step left over, 0 to 1, for interpolating drawn poses. */
  readonly alpha: number
  /** Milliseconds the last frame's fixed steps took (the world's cost, for a system that adapts to it). */
  readonly stepMs: number
}

export interface PhysicsPhase {
  /** Before each fixed step `h`: kinematic targets, controllers, inputs, forces. Anything that moves by time uses `h`, never the frame's `dt`. */
  beforeStep?(h: number, frame: PhysicsFrame): void
  /** Once per frame, after the steps: the frame's contact rows, sensor events, broken joints, rules. */
  afterSteps?(dt: number, frame: PhysicsFrame): void
}

export interface PhysicsLoop {
  readonly world: SeamWorld
  readonly frame: PhysicsFrame
  /** Order inside one `PhaseOrder` is registration order; the call returns the way to take the phase out again. */
  add(phase: PhysicsPhase, order: PhaseOrder): () => void
  /** One frame of `dt` seconds, limited to `maxDt`. The only thing that steps the world. */
  step(dt: number): void
}

export interface PhysicsLoopOptions {
  /** Longest frame (s) the loop simulates: a tab that returns after 5 s does not run 600 steps. Default 0.1. */
  readonly maxDt?: number
}

const BEFORE_ORDER: readonly PhaseOrder[] = ['crowd', 'actors']
const AFTER_ORDER: readonly PhaseOrder[] = ['contacts', 'rules']
const STEP_EPSILON = 1e-9

const looped = new WeakSet<object>()

interface MutableFrame {
  time: number
  steps: number
  alpha: number
  stepMs: number
}

/** The one loop of a world (it owns the time accumulator); a second one for the same world throws, so two systems never step it twice. */
export const createPhysicsLoop = (world: PhysicsWorld, options: PhysicsLoopOptions = {}): PhysicsLoop => {
  if (looped.has(world)) throw new Error('game-physics: this world already has a physics loop')
  looped.add(world)
  const maxDt = options.maxDt ?? 0.1
  const frame: MutableFrame = { time: 0, steps: 0, alpha: 0, stepMs: 0 }
  // copy on write: a phase added or removed while the loop runs does not disturb the pass in progress
  const phases: Record<PhaseOrder, readonly PhysicsPhase[]> = { crowd: [], actors: [], contacts: [], rules: [] }
  let accumulator = 0
  const h = world.fixedStep

  const add = (phase: PhysicsPhase, order: PhaseOrder): (() => void) => {
    phases[order] = [...phases[order], phase]
    return () => {
      phases[order] = phases[order].filter((registered) => registered !== phase)
    }
  }

  const step = (dt: number): void => {
    const clamped = Math.min(Math.max(dt, 0), maxDt)
    accumulator += clamped
    const steps = Math.floor((accumulator + STEP_EPSILON) / h)
    accumulator = Math.max(0, accumulator - steps * h)
    frame.steps = steps
    frame.alpha = accumulator / h
    world.clearEvents()
    const started = performance.now()
    for (let i = 0; i < steps; i++) {
      for (const order of BEFORE_ORDER) for (const phase of phases[order]) phase.beforeStep?.(h, frame)
      world.stepFixed(h)
      frame.time += h
    }
    frame.stepMs = performance.now() - started
    for (const order of AFTER_ORDER) for (const phase of phases[order]) phase.afterSteps?.(clamped, frame)
  }

  return { world, frame, add, step }
}

/** A `PhysicsLoop` told from a world (a seam is handed either): only the loop has `frame` and `add`. */
export const isPhysicsLoop = (value: SeamWorld | PhysicsLoop): value is PhysicsLoop => 'frame' in value && 'add' in value
