/**
 * The worker coordinator as the packages see it: a package declares its heavy work as a task kind (a pure function of plain data) or a
 * resident kind (an instance pinned to one worker), and takes a `WorkerCoordinator` through its options. The implementation is
 * `@adatechnology/game-workers`; nothing in a package makes a `Worker` of its own (CLAUDE.md §14).
 */

/**
 * The pools a kind runs in. `sim`: physics and anything the next frames read; the result is applied in a fixed frame and computed on the
 * main thread when the worker is late, so it is the same whichever thread made it. `build`: generation at load (shapes, colliders,
 * normals), no frame deadline. `background`: the living world far from the player, the lowest priority, never takes a `sim` worker.
 */
export const WORKER_LANES = ['sim', 'build', 'background'] as const
export type WorkerLane = (typeof WORKER_LANES)[number]

/**
 * What happens when no worker answers in time (or there is none). `sync`: the main thread runs the same kernel and the late answer is
 * thrown away (the only rule of the `sim` lane). `drop`: the job is given up and its promise rejects with `WorkerTaskDropped`.
 * `keep-waiting`: it waits for a worker (a fresh one after a crash); with no worker at all it runs on the main thread.
 */
export const WORKER_LATE_RULES = ['sync', 'drop', 'keep-waiting'] as const
export type WorkerLateRule = (typeof WORKER_LATE_RULES)[number]

/** How a kind is scheduled: the defaults the kind declares, any of which a game may override by id (`CoordinatorOptions.kinds`). */
export interface WorkerKindSchedule {
  readonly lane: WorkerLane
  /** Higher runs first, as `DEFERRED_PRIORITY`. */
  readonly priority: number
  /** Frames between the frame a job is submitted in and the frame its result is applied in (`sim` lane; default 1). */
  readonly latencyFrames?: number
  readonly late: WorkerLateRule
}

/**
 * A job with no state: plain data in, plain data out, through `run`, the same function in the worker and on the main thread. `run` reads
 * nothing but its input (a seed travels inside it), so the bytes out are the same whichever thread ran it.
 */
export interface TaskKind<In, Out> extends WorkerKindSchedule {
  /** `package.thing`, unique in a coordinator: `destruction.ground-tiles`. */
  readonly id: string
  readonly kind: 'task'
  run(input: In): Out
  /** The buffers of the output to transfer back (zero copy). The input is copied, never transferred, when `late` is `sync` (unless `transferAwaitedInput`): the main thread may still need it. */
  transferOutput?(value: Out): readonly ArrayBuffer[]
  /** The buffers of the input to transfer when `late` is not `sync` (and on awaited jobs of a `sync` kind with `transferAwaitedInput`). */
  transferInput?(value: In): readonly ArrayBuffer[]
  /**
   * With `late: 'sync'`, transfer the input (`transferInput`) on awaited jobs (`run`) too, instead of copying it: for a caller that keeps its own copy of the input for its
   * own fallback (the ground tiles). Once sent, such a job is never run on the main thread (its input is gone): a worker that dies holding it rejects its promise with an
   * error named `WORKER_INPUT_LOST` (`isWorkerInputLost`: the caller makes it from its own copy), one that answers with an error rejects with that error. Jobs read through
   * `submit`/`collect` still copy their input.
   * Needs `transferInput`.
   */
  readonly transferAwaitedInput?: boolean
  /** One input each worker runs once at `warm` (the JIT compiles the kernel before the first real job). */
  readonly warmup?: In
}

/** One instance of a resident kind: built from `init` once per worker, then stepped. */
export interface ResidentInstance<Step, Result> {
  step(input: Step): Result
  dispose?(): void
}

/**
 * A kind with an instance pinned to one worker (the crowd physics, a region of the world). With `late: 'sync'` the step must be a pure
 * function of `init` and the step's input (the state lives on the main thread and travels each step), so a main-thread instance gives the
 * same result; a resident that keeps its own state in the worker uses `drop` or `keep-waiting`.
 */
export interface ResidentKind<Init, Step, Result> extends WorkerKindSchedule {
  readonly id: string
  readonly kind: 'resident'
  create(init: Init): ResidentInstance<Step, Result>
  transferOutput?(value: Result): readonly ArrayBuffer[]
  transferInput?(value: Step): readonly ArrayBuffer[]
}

/** A kind of any input and output, for registries (the methods are bivariant, so every `TaskKind<In, Out>` is one). */
export type AnyTaskKind = TaskKind<unknown, unknown>
export type AnyResidentKind = ResidentKind<unknown, unknown, unknown>
export type AnyWorkerKind = AnyTaskKind | AnyResidentKind

/** Where a result came from. `worker`: on time. `main`: the main thread ran it (late worker, crash, or no worker). */
export type WorkerResultSource = 'worker' | 'main'

/** A job of the `sim` lane: its result is read in `dueFrame`, never before, whichever thread made it. */
export interface TaskHandle<Out> {
  readonly dueFrame: number
  /**
   * The result in `frame` (>= `dueFrame`, an error before it): the worker's when it is back, otherwise the kernel run here now and the
   * late answer thrown away. The same value on every later call.
   */
  collect(frame: number): Out
  /** Resolves when the result exists (worker or main thread); for the `build` and `background` lanes. */
  readonly promise: Promise<Out>
  /** Where the collected result came from; `null` before `collect` or the promise settles. */
  readonly source: WorkerResultSource | null
  /** Drops a job not yet collected: it leaves the queue, or its answer is thrown away. */
  cancel(): void
}

export interface ResidentHandle<Step, Result> {
  readonly id: string
  /** Steps the instance with `input` in `frame`; read the result with `collect(dueFrame)`. The input is the coordinator's from here on. */
  step(input: Step, at?: { readonly frame?: number; readonly latencyFrames?: number }): TaskHandle<Result>
  dispose(): void
}

export interface WorkerKindStats {
  readonly id: string
  readonly lane: WorkerLane
  readonly submitted: number
  /** Answers that came back from a worker, on time or late. */
  readonly answered: number
  /** Results that came from a worker before they were needed. */
  readonly onTime: number
  /** Results the main thread computed (late worker, crash, no worker). */
  readonly fallback: number
  readonly dropped: number
  readonly cancelled: number
  readonly failed: number
  /** Milliseconds inside the worker, summed over `answered`. */
  readonly workerMs: number
  /** Milliseconds on the main thread, summed (fallbacks). */
  readonly mainMs: number
  /** Milliseconds waiting in the queue before a worker took the job, summed. */
  readonly queueMs: number
}

export interface WorkerCoordinatorStats {
  readonly workers: number
  readonly lanes: Readonly<Record<WorkerLane, number>>
  readonly queued: number
  readonly running: number
  readonly respawned: number
  readonly kinds: readonly WorkerKindStats[]
}

export interface WorkerCoordinator {
  /** A `sim` job submitted in `at.frame` (default: the last `tick`), due `latencyFrames` later. The input is the coordinator's from here on: do not change it. */
  submit<In, Out>(kind: TaskKind<In, Out>, input: In, at?: { readonly frame?: number; readonly latencyFrames?: number }): TaskHandle<Out>
  /**
   * A job awaited instead of collected: a `build` or `background` job, or a `sim` job in the simulation thread (which may wait; with no worker
   * it runs on this thread). A promise, cancelled through `signal`.
   */
  run<In, Out>(kind: TaskKind<In, Out>, input: In, signal?: AbortSignal): Promise<Out>
  /** An instance of a resident kind on one worker (or on the main thread when there is none). */
  resident<Init, Step, Result>(kind: ResidentKind<Init, Step, Result>, init: Init): ResidentHandle<Step, Result>
  /** The frame now; the runtime calls it at the start of each fixed step. Jobs are ordered by priority, then by the nearest due frame. */
  tick(frame: number): void
  /** Starts the workers and runs each kind's `warmup` in every worker; rejects when a worker does not know one of the kinds. */
  warm(kinds: readonly AnyWorkerKind[]): Promise<void>
  /** The schedule a kind runs with here (its own, with the game's overrides). */
  scheduleOf(kind: AnyWorkerKind): WorkerKindSchedule
  stats(): WorkerCoordinatorStats
  dispose(): void
}

/** The ids of the kit's kinds (`TaskKind.id` / `ResidentKind.id`), what `WORKER_KIND_DEFAULTS` is keyed by. */
export const WORKER_KIND_ID = {
  GROUND_TILES: 'destruction.ground-tiles',
  CROWD_PHYSICS: 'crowd.physics',
  PIECE_BOXES: 'destruction.piece-boxes',
  STATIC_COLLIDERS: 'destruction.static-colliders',
  SHAPES_GENERATE: 'shapes.generate',
  WORLD_REGION: 'world.region',
} as const

/** Default schedule of the kit's kinds; each kind carries its own copy, a game overrides any of them by id. */
export const WORKER_KIND_DEFAULTS = {
  [WORKER_KIND_ID.GROUND_TILES]: { lane: 'sim', priority: 300, latencyFrames: 2, late: 'sync' },
  [WORKER_KIND_ID.CROWD_PHYSICS]: { lane: 'sim', priority: 250, latencyFrames: 1, late: 'sync' },
  [WORKER_KIND_ID.PIECE_BOXES]: { lane: 'sim', priority: 200, latencyFrames: 2, late: 'sync' },
  [WORKER_KIND_ID.STATIC_COLLIDERS]: { lane: 'build', priority: 150, late: 'sync' },
  [WORKER_KIND_ID.SHAPES_GENERATE]: { lane: 'build', priority: 100, late: 'sync' },
  [WORKER_KIND_ID.WORLD_REGION]: { lane: 'background', priority: 10, latencyFrames: 10, late: 'drop' },
} as const satisfies Readonly<Record<string, WorkerKindSchedule>>

/** The name of the error an awaited job with a transferred input (`transferAwaitedInput`) rejects with when its worker died holding it. */
export const WORKER_INPUT_LOST = 'WorkerTaskInputLost'

/** Whether a rejection is that of a job whose transferred input was lost with its worker (`WORKER_INPUT_LOST`): the caller's own fallback makes it, nothing else is wrong. */
export const isWorkerInputLost = (error: unknown): boolean => error instanceof Error && error.name === WORKER_INPUT_LOST

/*
 * The simulation thread (spec 009, T22): a game's whole fixed step in one worker that may wait. A package declares its simulation as a
 * `SimModule`; `@adatechnology/game-workers` runs it (`installSimThread`, `startSimThread`, `runSimInline`).
 */

/** One running simulation, built in the simulation thread from the start message's `init`. */
export interface SimInstance {
  /**
   * One fixed step. It may return a promise: the loop waits for it (jobs handed to the coordinator are awaited, not raced against a frame),
   * so the result never depends on how fast the other workers were.
   */
  step(frame: number, dt: number, commands: readonly Float64Array[]): void | Promise<void>
  /** Writes the state the page draws into `out` (the snapshot's bytes, `snapshotBytes` long). */
  write(out: Uint8Array, frame: number): void
  dispose?(): void
}

/** What the simulation thread can build, by id (the worker's file registers every module the game starts). */
export interface SimModule<Init> {
  /** `package.thing`: `crowd.horde`. */
  readonly id: string
  create(init: Init): SimInstance | Promise<SimInstance>
}
export type AnySimModule = SimModule<unknown>
