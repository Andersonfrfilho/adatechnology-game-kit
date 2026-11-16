import type { WakeQueueState, WorkBudgetOptions } from '@adatechnology/game-physics'
import { DEFAULT_CHIP_SIZE, DEFAULT_MAX_PHYSICS_PIECES, DEFAULT_MIN_PHYSICS_PIECES, DEFAULT_PHYSICS_COST_TARGET_MS, DEFAULT_MAX_QUEUED_WAKES, DEFAULT_PHYSICS_COST_PER_BODY_MS, DEFAULT_WAKE_COST_PER_BODY_MS, DEFAULT_MAX_WAKE_DELAY, DEFAULT_MIN_WAKES_PER_FRAME, DEFAULT_WAKE_COST_TARGET_MS, WakeQueue } from '@adatechnology/game-physics'
export type { PhysicsCostMeterState } from '@adatechnology/game-physics'
export { PhysicsCostMeter, chooseForPhysics, physicsPieceCount } from '@adatechnology/game-physics'

/** What happens to debris that is far from the player and old (`FarDebrisOptions.action`): it sleeps where it lies, or shrinks away and leaves the scene. Debris at rest is already drawn merged by `settledBatches`. */
export type FarDebrisAction = 'sleep' | 'fade'

export interface FarDebrisOptions {
  /** Metres from `focus` past which debris is far. Default `BLAST_DEBRIS_DEFAULTS.far.distance`. */
  distance?: number
  /** Seconds a piece must have lived to be old. Default `BLAST_DEBRIS_DEFAULTS.far.age`. */
  age?: number
  /** What far and old debris at rest does. Default `'sleep'`. */
  action?: FarDebrisAction
  /** Seconds a faded piece takes to shrink away once its body is gone. Default `BLAST_DEBRIS_DEFAULTS.far.fadeSeconds`. */
  fadeSeconds?: number
}

/**
 * Everything the kit decides about the debris of a blast, each a number the host sets: per renderer (`RendererOptions.blastDebris`) or per explosion (`ExplodeOptions.debris`).
 * None is a constant of the code; `BLAST_DEBRIS_DEFAULTS` is what was measured (spec 008, evidence T3.6d).
 */
export interface BlastDebrisOptions {
  /**
   * Milliseconds the physics step may reach as the debris of blasts wakes: each frame wakes as many (nearest the player first, else the blast's centre) as the step cost measured
   * on the frames before leaves room for under this. A frame of a woken pile costs more than the same pile asleep; nothing is timed per body.
   */
  wakeCostTargetMs?: number
  /** Seconds a piece waits to wake at most, whatever the cost: the debris of a blast is all awake within tens of ms. */
  maxWakeDelay?: number
  /** Pieces waiting to wake at most; the farthest over it wake at once. */
  maxQueuedWakes?: number
  /** Pieces woken every frame at least, so a queue behind a heavy frame still drains. */
  minWakesPerFrame?: number
  /** Fewest pieces of one blast that enter physics, whatever the cost (the count adapts between this and `maxPhysicsPieces`). */
  minPhysicsPieces?: number
  /** Most pieces of one blast that enter physics. */
  maxPhysicsPieces?: number
  /** Milliseconds of physics step the debris of one blast may add in the frame it wakes: the count is this over the wake cost measured per body. */
  physicsCostTargetMs?: number
  /** Milliseconds one awake body costs a step, used until the world has been measured (`PhysicsFrame.stepMs`). */
  physicsCostPerBodyMs?: number
  /** The same in the frame a pile wakes in (a woken island costs several times what it costs settled): what sizes the wake batches until measured. */
  wakeCostPerBodyMs?: number
  /** Longest side (m) under which a loosened object is a chip: it goes after every big one when the blast's count is full. */
  chipSize?: number
  /** Most loose pieces alive at once, asleep or not: over it the far and old ones go first (`far`). */
  maxLivePieces?: number
  /** Which pieces are far and old, and what happens to them. They also go when the pieces alive pass `maxLivePieces`. */
  far?: FarDebrisOptions
}

export interface ResolvedBlastDebris {
  readonly wakeCostTargetMs: number
  readonly maxWakeDelay: number
  readonly maxQueuedWakes: number
  readonly minWakesPerFrame: number
  readonly minPhysicsPieces: number
  readonly maxPhysicsPieces: number
  readonly physicsCostTargetMs: number
  readonly physicsCostPerBodyMs: number
  readonly wakeCostPerBodyMs: number
  readonly chipSize: number
  readonly maxLivePieces: number
  readonly far: Required<FarDebrisOptions>
}

/** Measured on "Intel Core Ultra 9 275HX, 24 cores, Node 20" (evidence T3.6d); an AMD or weaker range gets its own row after it is measured. */
export const BLAST_DEBRIS_DEFAULTS: ResolvedBlastDebris = {
  wakeCostTargetMs: DEFAULT_WAKE_COST_TARGET_MS,
  maxWakeDelay: DEFAULT_MAX_WAKE_DELAY,
  maxQueuedWakes: DEFAULT_MAX_QUEUED_WAKES,
  minWakesPerFrame: DEFAULT_MIN_WAKES_PER_FRAME,
  minPhysicsPieces: DEFAULT_MIN_PHYSICS_PIECES,
  maxPhysicsPieces: DEFAULT_MAX_PHYSICS_PIECES,
  physicsCostTargetMs: DEFAULT_PHYSICS_COST_TARGET_MS,
  physicsCostPerBodyMs: DEFAULT_PHYSICS_COST_PER_BODY_MS,
  wakeCostPerBodyMs: DEFAULT_WAKE_COST_PER_BODY_MS,
  chipSize: DEFAULT_CHIP_SIZE,
  maxLivePieces: 600,
  far: { distance: 40, age: 30, action: 'sleep', fadeSeconds: 0.5 },
}

/** The defaults with `options` over them: a number left out is the default. */
export const resolveBlastDebris = (...layers: ReadonlyArray<BlastDebrisOptions | undefined>): ResolvedBlastDebris => {
  let out: ResolvedBlastDebris = BLAST_DEBRIS_DEFAULTS
  for (const layer of layers) {
    if (!layer) continue
    const { far, ...rest } = layer
    const defined = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined))
    out = { ...out, ...defined, far: { ...out.far, ...Object.fromEntries(Object.entries(far ?? {}).filter(([, value]) => value !== undefined)) } }
  }
  return out
}

/** What one frame's step cost: `PhysicsFrame.stepMs` and the bodies the world had awake. */
export interface DebrisCostSample {
  readonly stepMs: number
  readonly active: number
}

/**
 * Where the cost the debris policy adapts to comes from (`RendererOptions.debrisCost`). `measured` (the default, as the owner decided in D4) reads the loop's wall-clock step
 * time, so the batch sizes and piece counts depend on the machine's speed; `record` collects each frame's sample. `fixed` never reads the clock: batches and counts come only
 * from the configured numbers (`wakeCostTargetMs`, `physicsCostPerBodyMs`, `wakeCostPerBodyMs`...), the same on every machine (tests, lockstep). `replay` feeds a recorded list,
 * frame by frame, in place of the clock, so a session recorded on one machine plays the same decisions on another.
 */
export type DebrisCostOptions =
  | { readonly source: 'measured'; readonly record?: DebrisCostSample[] }
  | { readonly source: 'fixed' }
  | { readonly source: 'replay'; readonly samples: readonly DebrisCostSample[] }

/** The debris waiting to wake: one queue for every blast in flight, nearest the player first. */
export class BlastWakes {
  private readonly queue: WakeQueue<() => void>

  constructor(options: ResolvedBlastDebris) {
    this.queue = new WakeQueue({ costTargetMs: options.wakeCostTargetMs, maxDelay: options.maxWakeDelay, maxQueued: options.maxQueuedWakes, minPerFrame: options.minWakesPerFrame })
  }

  get pending(): number {
    return this.queue.size
  }

  push(priority: number, apply: () => void, maxDelay: number): void {
    this.queue.push(priority, apply, maxDelay)
  }

  /** One frame: wakes what the cost leaves room for (at most `limit`, what a shared work budget leaves) and returns how many woke. */
  advance(dt: number, lastStepMs: number, costPerBodyMs: number, limit = Infinity): number {
    const woken = this.queue.release(dt, lastStepMs, costPerBodyMs, limit)
    for (const apply of woken) apply()
    return woken.length
  }

  clear(): void {
    this.queue.clear()
  }

  /** The waiting pieces' priority, delay and `apply` (the host keeps what `apply` stands for saveable). */
  saveState(): WakeQueueState<() => void> {
    return this.queue.saveState()
  }

  restoreState(state: WakeQueueState<() => void>): void {
    this.queue.restoreState(state)
  }
}

/**
 * Work units (`WorkBudget`, 1 unit = 10 µs on the reference machine) each kind of the explosion's deferred work is charged. Every one is an estimate from the size of the work,
 * never from what a cache holds: a split is charged as if none of its boxes were fitted ahead (spec 008, `design/orcamento-da-explosao.md` §7 D2), so the schedule does not
 * depend on how far a fit ahead got.
 */
export interface WorkUnitCosts {
  /** Units of one split whatever its size (making the new object, its piece and its bookkeeping). */
  readonly perSplit?: number
  /** Units per vertex of the loose group's meshes (its box fits and measure). */
  readonly perVertex?: number
  /** Units per vertex of a merged mesh the group is cut out of (the host mesh is rebuilt, normals and all). */
  readonly perHostVertex?: number
  /** Units per part of the object it is cut from (the world rebuilds both halves). */
  readonly perObjectPart?: number
  /** Units per fragment spawned. */
  readonly perFragment?: number
  /** Units charged per event applied (its effects show in the frame it happens, so it never waits; it only leaves less for the rest). */
  readonly perEvent?: number
  /** Units per body woken from the blast's wake queue. */
  readonly perWake?: number
}

/** The frame budget of the explosion's work (`RendererOptions.workBudget`): the budget, the machine's tier, the frames a loose group may wait, and the unit costs. */
export interface ExplosionWorkOptions extends WorkBudgetOptions {
  readonly costs?: WorkUnitCosts
}

/** First calibration on the main of 2026-11-15 (evidence T3.8aa); to be measured again on top of the box fits ahead, the batched bodies and the ground budget. */
export const WORK_UNIT_DEFAULTS: Required<WorkUnitCosts> = {
  perSplit: 120,
  perVertex: 0.05,
  perHostVertex: 0.01,
  perObjectPart: 0.3,
  perFragment: 4,
  perEvent: 40,
  perWake: 2,
}

export const resolveWorkUnitCosts = (costs: WorkUnitCosts | undefined): Required<WorkUnitCosts> => ({
  ...WORK_UNIT_DEFAULTS,
  ...Object.fromEntries(Object.entries(costs ?? {}).filter(([, value]) => value !== undefined)),
})

/** What a split is estimated to cost, in units, from the sizes of its work. */
export const splitWorkUnits = (costs: Required<WorkUnitCosts>, size: { readonly vertices: number; readonly hostVertices: number; readonly objectParts: number }): number =>
  costs.perSplit + costs.perVertex * size.vertices + costs.perHostVertex * size.hostVertices + costs.perObjectPart * size.objectParts
