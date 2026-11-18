import { CommandRing, SnapshotReader, SnapshotWriter, canShareMemory, createCommandBuffer, createSnapshotBuffer } from './shared'
import type { Snapshot } from './shared'
import type { AnySimModule, SimInstance, SimModule } from '@adatechnology/game-contracts'
import type { Spawn, WorkerScopeLike } from './protocol'

/**
 * The simulation thread (spec 009, T22): the whole fixed step of a game runs in one dedicated worker, which **may wait** (for the jobs it
 * hands to other workers, for its next step), as the main thread of a native engine's simulation does. The page only pushes input into a
 * command ring and draws the newest whole snapshot, so it never waits, in a browser or in the Electron renderer.
 *
 * The same module also runs on the calling thread (`runSimInline`): the snapshot bytes are the same after the same steps and commands, which
 * is what the equivalence test checks.
 */

export interface SimLoopOptions {
  /** Seconds of one fixed step (default 1/60). */
  readonly stepSeconds?: number
  /** Stop after this many steps (tests, a replay); default: run until `stop`. */
  readonly steps?: number
  /** Steps on the clock (default) or as fast as they compute (`false`: tests, a server). */
  readonly paced?: boolean
  /** Steps the loop catches up after a stall before it drops the time instead (default 4). */
  readonly maxCatchUp?: number
}

export interface SimThreadOptions<Init> extends SimLoopOptions {
  readonly module: string
  readonly init: Init
  /** Bytes of one snapshot. */
  readonly snapshotBytes: number
  /** Numbers in one command (default 8) and commands the ring holds (default 256). */
  readonly commandWidth?: number
  readonly commandCapacity?: number
}

export interface SimThreadStats {
  /** Steps done. */
  readonly steps: number
  readonly lastStepMs: number
  readonly meanStepMs: number
  readonly maxStepMs: number
  /** Stalls the loop gave up catching up on. */
  readonly dropped: number
}

/** The page's side of a running simulation thread. */
export interface SimThread {
  /** Resolves when the module is built and the first step is about to run; rejects when the thread could not build it. */
  readonly ready: Promise<void>
  /** Resolves with the steps done when the loop ends (`steps` reached or `stop`). */
  readonly done: Promise<number>
  /** The newest whole snapshot (never waits), `null` before the first. Valid until the next `latest`. */
  latest(): Snapshot | null
  /** Queues a command for the start of the next step; `false` when the ring is full. */
  send(command: ArrayLike<number>): boolean
  stats(): SimThreadStats
  /** Ends the loop after the step it is in. */
  stop(): void
  /** Stops and terminates the worker. */
  dispose(): void
}

// control buffer: Int32 words, then Float64 numbers from byte 32
const STOP = 0
const STEPS = 1
const WAKE = 2
const DROPPED = 3
const LAST_MS = 0
const SUM_MS = 1
const MAX_MS = 2
const CONTROL_BYTES = 64

type ToSim = {
  readonly t: 'sim-start'
  readonly module: string
  readonly init: unknown
  readonly snapshot: SharedArrayBuffer
  readonly commands: SharedArrayBuffer
  readonly control: SharedArrayBuffer
  readonly loop: SimLoopOptions
}
type FromSim = { readonly t: 'sim-ready' } | { readonly t: 'sim-done'; readonly steps: number } | { readonly t: 'sim-error'; readonly error: string }

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const isThenable = (value: unknown): value is PromiseLike<void> => typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'

interface LoopIo {
  readonly ring: CommandRing
  readonly writer: SnapshotWriter
  readonly control: SharedArrayBuffer
  /** A real sleep: `Atomics.wait` in a worker; never called with `paced: false`. */
  readonly sleep: (ms: number) => void
  /** Called before each step's drain (the inline runner pushes that frame's commands). */
  readonly beforeStep?: (frame: number) => void
}

/** The fixed-step loop, the same in the simulation thread and inline: drain commands, step (awaited), write the snapshot, sleep to the next step. */
async function simLoop(instance: SimInstance, options: SimLoopOptions, io: LoopIo): Promise<number> {
  const stepSeconds = options.stepSeconds ?? 1 / 60
  const stepMs = stepSeconds * 1000
  const paced = options.paced ?? true
  const maxCatchUp = options.maxCatchUp ?? 4
  const words = new Int32Array(io.control, 0, 8)
  const numbers = new Float64Array(io.control, 32, 4)
  let frame = 0
  let next = now()
  while (Atomics.load(words, STOP) === 0 && (options.steps === undefined || frame < options.steps)) {
    if (paced) {
      const wait = next - now()
      if (wait > 0.25) {
        io.sleep(wait)
        continue
      }
      if (-wait > maxCatchUp * stepMs) {
        next = now()
        Atomics.add(words, DROPPED, 1)
      }
    }
    io.beforeStep?.(frame)
    const commands = io.ring.drain()
    const started = now()
    const stepped = instance.step(frame, stepSeconds, commands)
    if (isThenable(stepped)) await stepped
    instance.write(io.writer.begin(), frame)
    io.writer.commit(frame)
    const ms = now() - started
    numbers[LAST_MS] = ms
    numbers[SUM_MS] = numbers[SUM_MS]! + ms
    if (ms > numbers[MAX_MS]!) numbers[MAX_MS] = ms
    frame++
    Atomics.store(words, STEPS, frame)
    next += stepMs
  }
  return frame
}

const statsOf = (control: SharedArrayBuffer): SimThreadStats => {
  const words = new Int32Array(control, 0, 8)
  const numbers = new Float64Array(control, 32, 4)
  const steps = Atomics.load(words, STEPS)
  return { steps, lastStepMs: numbers[LAST_MS]!, meanStepMs: steps ? numbers[SUM_MS]! / steps : 0, maxStepMs: numbers[MAX_MS]!, dropped: Atomics.load(words, DROPPED) }
}

const isToSim = (data: unknown): data is ToSim => typeof data === 'object' && data !== null && (data as { t?: unknown }).t === 'sim-start'
const isFromSim = (data: unknown): data is FromSim => typeof data === 'object' && data !== null && typeof (data as { t?: unknown }).t === 'string'

/**
 * The simulation thread's side: call it in the file of the simulation worker with every module the game may start.
 *
 * ```ts
 * // sim-worker.ts
 * import { installSimThread } from '@adatechnology/game-workers'
 * installSimThread(self, [hordeSim])
 * ```
 */
export function installSimThread(scope: WorkerScopeLike, modules: readonly AnySimModule[]): void {
  const byId = new Map(modules.map((m) => [m.id, m]))
  scope.onmessage = (event) => {
    const start = event.data
    if (!isToSim(start)) return
    const reply = (m: FromSim): void => scope.postMessage(m)
    const module = byId.get(start.module)
    if (!module) {
      reply({ t: 'sim-error', error: `installSimThread: no module ${start.module} (this thread has ${[...byId.keys()].join(', ') || 'none'})` })
      return
    }
    const words = new Int32Array(start.control, 0, 8)
    const io: LoopIo = {
      ring: new CommandRing(start.commands),
      writer: new SnapshotWriter(start.snapshot),
      control: start.control,
      // a worker may wait: this is the native engine's sleep, woken early by `stop`
      sleep: (ms) => void Atomics.wait(words, WAKE, 0, ms),
    }
    void (async () => {
      let instance: SimInstance | null = null
      try {
        instance = await module.create(start.init)
        reply({ t: 'sim-ready' })
        reply({ t: 'sim-done', steps: await simLoop(instance, start.loop, io) })
      } catch (error) {
        reply({ t: 'sim-error', error: message(error) })
      } finally {
        instance?.dispose?.()
      }
    })()
  }
}

/** Whether a simulation thread can run here: shared memory (`canShareMemory`) and workers to spawn. */
export const canRunSimThread = (): boolean => canShareMemory()

/** Starts `options.module` in a new worker from `spawn` (a worker that calls `installSimThread`). Throws where memory cannot be shared. */
export function startSimThread<Init>(spawn: Spawn, options: SimThreadOptions<Init>): SimThread {
  if (!canShareMemory()) throw new Error('startSimThread: no shared memory here (SharedArrayBuffer and cross-origin isolation: COOP/COEP, always on in Electron)')
  const snapshot = createSnapshotBuffer(options.snapshotBytes)
  const commands = createCommandBuffer(options.commandWidth ?? 8, options.commandCapacity ?? 256)
  const control = new SharedArrayBuffer(CONTROL_BYTES)
  const words = new Int32Array(control, 0, 8)
  const reader = new SnapshotReader(snapshot)
  const ring = new CommandRing(commands)
  const worker = spawn()
  let readyResolve!: () => void
  let readyReject!: (error: Error) => void
  let doneResolve!: (steps: number) => void
  let doneReject!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => ((readyResolve = resolve), (readyReject = reject)))
  const done = new Promise<number>((resolve, reject) => ((doneResolve = resolve), (doneReject = reject)))
  // a caller that awaits only `ready` sees the failure there: `done`'s copy of it is not an unhandled rejection
  done.catch(() => {})
  const fail = (error: Error): void => {
    readyReject(error)
    doneReject(error)
  }
  worker.onmessage = (event) => {
    const data = event.data
    if (!isFromSim(data)) return
    if (data.t === 'sim-ready') readyResolve()
    else if (data.t === 'sim-done') doneResolve(data.steps)
    else fail(new Error(data.error))
  }
  worker.onerror = (event) => fail(event instanceof Error ? event : new Error(`simulation thread failed: ${message((event as { message?: unknown }).message ?? event)}`))
  const loop: SimLoopOptions = {
    ...(options.stepSeconds !== undefined ? { stepSeconds: options.stepSeconds } : {}),
    ...(options.steps !== undefined ? { steps: options.steps } : {}),
    ...(options.paced !== undefined ? { paced: options.paced } : {}),
    ...(options.maxCatchUp !== undefined ? { maxCatchUp: options.maxCatchUp } : {}),
  }
  const start: ToSim = { t: 'sim-start', module: options.module, init: options.init, snapshot, commands, control, loop }
  worker.postMessage(start)
  const stop = (): void => {
    Atomics.store(words, STOP, 1)
    Atomics.notify(words, WAKE)
  }
  return {
    ready,
    done,
    latest: () => reader.latest(),
    send: (command) => ring.push(command),
    stats: () => statsOf(control),
    stop,
    dispose: () => {
      stop()
      worker.terminate()
    },
  }
}

/**
 * The same module and loop on this thread, unpaced: the snapshot after `steps` steps, with `commands[frame]` pushed before that step. The
 * reference the simulation thread must match byte for byte, and the fallback where memory cannot be shared.
 */
export async function runSimInline<Init>(
  module: SimModule<Init>,
  init: Init,
  options: { readonly steps: number; readonly snapshotBytes: number; readonly stepSeconds?: number; readonly commands?: readonly (readonly ArrayLike<number>[])[]; readonly commandWidth?: number },
): Promise<Uint8Array> {
  const snapshot = createSnapshotBuffer(options.snapshotBytes)
  const control = new SharedArrayBuffer(CONTROL_BYTES)
  const ring = new CommandRing(createCommandBuffer(options.commandWidth ?? 8, 4096))
  const instance = await module.create(init)
  try {
    await simLoop(instance, { steps: options.steps, paced: false, ...(options.stepSeconds !== undefined ? { stepSeconds: options.stepSeconds } : {}) }, {
      ring,
      writer: new SnapshotWriter(snapshot),
      control,
      sleep: () => {},
      beforeStep: (frame) => {
        for (const command of options.commands?.[frame] ?? []) if (!ring.push(command)) throw new Error('runSimInline: more commands in one frame than the ring holds')
      },
    })
  } finally {
    instance.dispose?.()
  }
  return new SnapshotReader(snapshot).latest()!.bytes.slice()
}
