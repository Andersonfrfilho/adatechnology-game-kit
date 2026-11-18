import { WORKER_LANES } from '@adatechnology/game-contracts'
import type {
  AnyWorkerKind,
  ResidentHandle,
  ResidentInstance,
  ResidentKind,
  TaskHandle,
  TaskKind,
  WorkerCoordinator,
  WorkerCoordinatorStats,
  WorkerKindSchedule,
  WorkerKindStats,
  WorkerLane,
  WorkerLateRule,
  WorkerResultSource,
} from '@adatechnology/game-contracts'
import { checkSchedule } from './define'
import { planWorkers } from './plan'
import type { WorkerPlan, WorkerPlanOptions } from './plan'
import { isFromWorker } from './protocol'
import type { Spawn, ToWorker, WorkerLike } from './protocol'

export interface CoordinatorOptions extends WorkerPlanOptions {
  /** Makes one worker (`browserSpawn`, `sourceSpawn`, `nodeSpawn`, `inThreadSpawn`). Without it every job runs on the main thread. */
  readonly spawn?: Spawn
  /** The game's overrides of a kind's schedule, by kind id. */
  readonly kinds?: Readonly<Record<string, Partial<WorkerKindSchedule>>>
  /** Jobs a worker holds at once (default 2): the rest wait in the coordinator's queue, where a more urgent one can pass them. */
  readonly inFlightPerWorker?: number
  /** The machine's cores for the automatic count (default `navigator.hardwareConcurrency`). */
  readonly cores?: number
  /** Clock in milliseconds (default `performance.now`). */
  readonly now?: () => number
}

/** The promise of a job given up by `late: 'drop'` rejects with it. */
export class WorkerTaskDropped extends Error {
  constructor(kind: string) {
    super(`worker job of ${kind} dropped: no worker took it`)
    this.name = 'WorkerTaskDropped'
  }
}

/** The promise of a cancelled job rejects with it. */
export class WorkerTaskCancelled extends Error {
  constructor(kind: string) {
    super(`worker job of ${kind} cancelled`)
    this.name = 'WorkerTaskCancelled'
  }
}

type JobState = 'queued' | 'running' | 'done' | 'settled' | 'cancelled'

type KindCounters = { -readonly [K in keyof WorkerKindStats]: WorkerKindStats[K] }

interface Resident {
  readonly rid: number
  readonly kind: ResidentKind<unknown, unknown, unknown>
  readonly schedule: WorkerKindSchedule
  readonly init: unknown
  slot: Slot | null
  local: ResidentInstance<unknown, unknown> | null
  disposed: boolean
}

interface Job {
  readonly id: number
  readonly seq: number
  readonly kindId: string
  readonly counters: KindCounters
  readonly lane: WorkerLane
  readonly priority: number
  readonly late: WorkerLateRule
  readonly dueFrame: number
  readonly message: ToWorker
  readonly transfer: readonly ArrayBuffer[]
  readonly runHere: () => unknown
  readonly resident: Resident | null
  readonly queuedAt: number
  state: JobState
  /** Workers that died holding it: a job that keeps killing its worker runs here (or fails) instead of killing the next one. */
  crashes: number
  output: unknown
  error: Error | null
  source: WorkerResultSource | null
  slot: Slot | null
  readonly settle: { resolve: (value: unknown) => void; reject: (error: Error) => void }
  readonly promise: Promise<unknown>
}

interface Slot {
  readonly index: number
  readonly home: WorkerLane
  readonly serves: readonly WorkerLane[]
  worker: WorkerLike
  readonly running: Map<number, Job>
  /** Steps of the residents pinned here, in order. */
  readonly own: Job[]
  readonly residents: Set<Resident>
  readonly hello: Map<number, (kinds: readonly string[]) => void>
  alive: boolean
}

const MAX_CRASHES = 2
const MAX_RESPAWNS = 5

const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Higher priority first, then the nearest due frame, then the order of submission. */
const before = (a: Job, b: Job): boolean => a.priority > b.priority || (a.priority === b.priority && (a.dueFrame < b.dueFrame || (a.dueFrame === b.dueFrame && a.seq < b.seq)))

const insertSorted = (queue: Job[], job: Job): void => {
  let i = queue.length
  while (i > 0 && before(job, queue[i - 1]!)) i--
  queue.splice(i, 0, job)
}

/**
 * The coordinator of every worker of a game (see the `game-workers` README). `sim` jobs are applied in a fixed frame: `collect(dueFrame)`
 * gives the worker's answer when it is back and runs the same kernel here when it is not, so the result never depends on timing. The main
 * thread never waits for a worker.
 */
export function createWorkerCoordinator(options: CoordinatorOptions = {}): WorkerCoordinator & { readonly plan: WorkerPlan } {
  const now = options.now ?? defaultNow
  const perWorker = Math.max(1, Math.floor(options.inFlightPerWorker ?? 2))
  const overrides = options.kinds ?? {}
  const plan: WorkerPlan = options.spawn ? planWorkers(options, options.cores) : { total: 0, lanes: { sim: 0, build: 0, background: 0 }, homes: [], serves: [] }
  const queues: Record<WorkerLane, Job[]> = { sim: [], build: [], background: [] }
  const mainQueue: Job[] = []
  const counters = new Map<string, KindCounters>()
  const residents = new Set<Resident>()
  const slots: Slot[] = []
  let frame = 0
  let nextId = 1
  let nextRid = 1
  let respawned = 0
  const deathsAt = new Map<number, number>()
  let disposed = false
  let mainTimer: ReturnType<typeof setTimeout> | null = null

  const countersOf = (kind: AnyWorkerKind, lane: WorkerLane): KindCounters => {
    let c = counters.get(kind.id)
    if (!c) counters.set(kind.id, (c = { id: kind.id, lane, submitted: 0, answered: 0, onTime: 0, fallback: 0, dropped: 0, cancelled: 0, failed: 0, workerMs: 0, mainMs: 0, queueMs: 0 }))
    return c
  }

  const scheduleOf = (kind: AnyWorkerKind): WorkerKindSchedule => {
    const own = overrides[kind.id]
    if (!own) return kind
    const merged: WorkerKindSchedule = { lane: own.lane ?? kind.lane, priority: own.priority ?? kind.priority, latencyFrames: own.latencyFrames ?? kind.latencyFrames, late: own.late ?? kind.late }
    checkSchedule(kind.id, merged)
    return merged
  }

  // ── workers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const makeSlot = (index: number, home: WorkerLane, serves: readonly WorkerLane[]): Slot | null => {
    let worker: WorkerLike
    try {
      worker = (options.spawn as Spawn)()
    } catch {
      return null
    }
    const slot: Slot = { index, home, serves, worker, running: new Map(), own: [], residents: new Set(), hello: new Map(), alive: true }
    worker.onmessage = (event) => onReply(slot, event.data)
    worker.onerror = () => onCrash(slot)
    return slot
  }

  for (let i = 0; i < plan.serves.length; i++) {
    const slot = makeSlot(i, plan.homes[i]!, plan.serves[i]!)
    if (slot) slots.push(slot)
  }
  const served = (lane: WorkerLane): boolean => slots.some((slot) => slot.serves.includes(lane))
  const homeOf = (lane: WorkerLane): Slot | null => {
    let best: Slot | null = null
    for (const slot of slots) {
      if (!slot.alive || !slot.serves.includes(lane)) continue
      const own = slot.home === lane ? 0 : 1
      const bestOwn = best && best.home === lane ? 0 : 1
      if (!best || own < bestOwn || (own === bestOwn && slot.residents.size < best.residents.size)) best = slot
    }
    return best
  }

  const send = (slot: Slot, job: Job): void => {
    job.state = 'running'
    job.slot = slot
    job.counters.queueMs += now() - job.queuedAt
    slot.running.set(job.id, job)
    slot.worker.postMessage(job.message, job.transfer)
  }

  const dispatch = (): void => {
    if (disposed) return
    for (const slot of slots) {
      while (slot.alive && slot.running.size < perWorker) {
        let job = slot.own.shift()
        if (!job) for (const lane of slot.serves) if ((job = queues[lane].shift())) break
        if (!job) break
        send(slot, job)
      }
    }
  }

  const onReply = (slot: Slot, data: unknown): void => {
    if (!isFromWorker(data)) return
    if (data.t === 'hello') {
      slot.hello.get(data.id)?.(data.kinds)
      slot.hello.delete(data.id)
      return
    }
    const job = slot.running.get(data.id)
    if (!job) return
    slot.running.delete(data.id)
    job.counters.workerMs += data.ms
    job.counters.answered++
    if (job.state === 'running') {
      if (data.ok) {
        job.state = 'done'
        job.output = data.output
        job.source = 'worker'
        // a job with no frame to wait for is on time as soon as it is back
        if (job.lane !== 'sim' && !job.resident) finish(job)
        else job.settle.resolve(job.output)
      } else {
        job.counters.failed++
        if (job.late === 'sync') runOnMain(job)
        else fail(job, new Error(data.error))
      }
    }
    dispatch()
  }

  const onCrash = (slot: Slot): void => {
    if (!slot.alive) return
    slot.alive = false
    slot.worker.terminate()
    const deaths = (deathsAt.get(slot.index) ?? 0) + 1
    deathsAt.set(slot.index, deaths)
    // a worker that keeps dying (a script that does not load) is not replaced forever: its lanes fall back to the others, or the main thread
    const replacement = disposed || deaths > MAX_RESPAWNS ? null : makeSlot(slot.index, slot.home, slot.serves)
    if (replacement) {
      respawned++
      slots[slots.indexOf(slot)] = replacement
    } else slots.splice(slots.indexOf(slot), 1)
    for (const resident of slot.residents) {
      resident.slot = replacement
      if (replacement) {
        replacement.residents.add(resident)
        replacement.worker.postMessage({ t: 'create', rid: resident.rid, kind: resident.kind.id, init: resident.init } satisfies ToWorker)
      }
    }
    // what the dead worker held goes back in line, steps of a resident first and in their order
    const waiting = [...slot.own]
    const back = [...slot.running.values()].filter((job) => job.state === 'running').sort((a, b) => a.seq - b.seq)
    slot.own.length = 0
    for (const job of back) job.crashes++
    for (const job of [...back, ...waiting]) {
      job.state = 'queued'
      job.slot = null
      if (job.crashes >= MAX_CRASHES) {
        job.counters.failed++
        if (job.late === 'sync') runOnMain(job)
        else fail(job, new Error(`${job.kindId}: its worker died ${job.crashes} times running it`))
      } else if (job.resident) {
        if (replacement) replacement.own.push(job)
        // no worker for it any more: it is run here when it is collected
      } else if (served(job.lane)) insertSorted(queues[job.lane], job)
      else toMain(job)
    }
    dispatch()
  }

  // ── results ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const finish = (job: Job): void => {
    if (job.source === 'worker') job.counters.onTime++
    job.state = 'settled'
    job.settle.resolve(job.output)
  }
  const fail = (job: Job, error: Error): void => {
    job.state = 'settled'
    job.error = error
    job.settle.reject(error)
  }
  const unqueue = (job: Job): void => {
    for (const queue of [queues[job.lane], mainQueue, job.resident?.slot?.own ?? []]) {
      const at = queue.indexOf(job)
      if (at >= 0) queue.splice(at, 1)
    }
  }
  /** The kernel here, now: a late worker, a crash, or no worker. A running job's answer is thrown away when it comes. */
  const runOnMain = (job: Job): void => {
    unqueue(job)
    const started = now()
    try {
      job.output = job.runHere()
      job.source = 'main'
      job.counters.fallback++
      job.counters.mainMs += now() - started
      finish(job)
    } catch (error) {
      job.counters.mainMs += now() - started
      fail(job, error instanceof Error ? error : new Error(String(error)))
    }
  }

  const drainMain = (): void => {
    mainTimer = null
    const job = mainQueue.shift()
    if (job && job.state === 'queued') runOnMain(job)
    if (mainQueue.length && !disposed) mainTimer = setTimeout(drainMain, 0)
  }
  /** A `build` or `background` job no worker can take: dropped, or run here one per macrotask, by priority. */
  const toMain = (job: Job): void => {
    if (job.late === 'drop') {
      job.counters.dropped++
      fail(job, new WorkerTaskDropped(job.kindId))
      return
    }
    insertSorted(mainQueue, job)
    if (!mainTimer) mainTimer = setTimeout(drainMain, 0)
  }

  // ── jobs ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  interface JobSpec {
    readonly kind: AnyWorkerKind
    readonly schedule: WorkerKindSchedule
    readonly dueFrame: number
    readonly message: (id: number) => ToWorker
    readonly transfer: readonly ArrayBuffer[]
    readonly runHere: () => unknown
    readonly resident: Resident | null
  }
  const makeJob = (spec: JobSpec): Job => {
    let settle: Job['settle'] = { resolve: () => undefined, reject: () => undefined }
    const promise = new Promise<unknown>((resolve, reject) => (settle = { resolve, reject }))
    // a job read only through `collect` must not leave an unhandled rejection behind
    promise.catch(() => undefined)
    const id = nextId++
    const job: Job = {
      id,
      seq: id,
      kindId: spec.kind.id,
      counters: countersOf(spec.kind, spec.schedule.lane),
      lane: spec.schedule.lane,
      priority: spec.schedule.priority,
      late: spec.schedule.late,
      dueFrame: spec.dueFrame,
      message: spec.message(id),
      transfer: spec.transfer,
      runHere: spec.runHere,
      resident: spec.resident,
      queuedAt: now(),
      state: 'queued',
      crashes: 0,
      output: undefined,
      error: null,
      source: null,
      slot: null,
      settle,
      promise,
    }
    job.counters.submitted++
    return job
  }

  const handleOf = <Out>(job: Job): TaskHandle<Out> => ({
    dueFrame: job.dueFrame,
    promise: job.promise as Promise<Out>,
    get source() {
      return job.source
    },
    collect(at: number): Out {
      if (at < job.dueFrame) throw new Error(`${job.kindId}: collected in frame ${at}, before its due frame ${job.dueFrame}`)
      if (job.state === 'cancelled') throw new WorkerTaskCancelled(job.kindId)
      if (job.state === 'done') finish(job)
      else if (job.state === 'queued' || job.state === 'running') runOnMain(job)
      if (job.error) throw job.error
      return job.output as Out
    },
    cancel(): void {
      if (job.state !== 'queued' && job.state !== 'running') return
      unqueue(job)
      job.state = 'cancelled'
      job.counters.cancelled++
      job.settle.reject(new WorkerTaskCancelled(job.kindId))
    },
  })

  const enqueue = (job: Job): void => {
    if (disposed) throw new Error('worker coordinator: disposed')
    if (job.resident) {
      if (job.resident.slot) job.resident.slot.own.push(job)
      // a resident with no worker runs here, at its collect
    } else if (served(job.lane)) insertSorted(queues[job.lane], job)
    else if (job.lane !== 'sim') toMain(job)
    // a sim job no worker serves waits for its collect, where it runs here
    dispatch()
  }

  const latencyOf = (schedule: WorkerKindSchedule, at?: { readonly latencyFrames?: number }): number => Math.max(1, Math.floor(at?.latencyFrames ?? schedule.latencyFrames ?? 1))

  const taskJob = <In, Out>(kind: TaskKind<In, Out>, input: In, at?: { readonly frame?: number; readonly latencyFrames?: number }): Job => {
    const schedule = scheduleOf(kind as TaskKind<unknown, unknown>)
    const submitted = at?.frame ?? frame
    const job = makeJob({
      kind: kind as TaskKind<unknown, unknown>,
      schedule,
      dueFrame: schedule.lane === 'sim' ? submitted + latencyOf(schedule, at) : Number.POSITIVE_INFINITY,
      message: (id) => ({ t: 'task', id, kind: kind.id, input }),
      transfer: schedule.late === 'sync' ? [] : [...(kind.transferInput?.(input) ?? [])],
      runHere: () => kind.run(input),
      resident: null,
    })
    return job
  }

  const coordinator: WorkerCoordinator & { readonly plan: WorkerPlan } = {
    plan,
    submit<In, Out>(kind: TaskKind<In, Out>, input: In, at?: { readonly frame?: number; readonly latencyFrames?: number }): TaskHandle<Out> {
      const job = taskJob(kind, input, at)
      enqueue(job)
      return handleOf<Out>(job)
    },

    run<In, Out>(kind: TaskKind<In, Out>, input: In, signal?: AbortSignal): Promise<Out> {
      const job = taskJob(kind, input)
      enqueue(job)
      // nobody collects an awaited job: a `sim` kind with no worker to serve it runs here, as the other lanes do (the simulation thread awaits its jobs)
      if (job.lane === 'sim' && job.state === 'queued' && !served('sim')) toMain(job)
      const handle = handleOf<Out>(job)
      if (signal) {
        if (signal.aborted) handle.cancel()
        else signal.addEventListener('abort', () => handle.cancel(), { once: true })
      }
      return handle.promise
    },

    resident<Init, Step, Result>(kind: ResidentKind<Init, Step, Result>, init: Init): ResidentHandle<Step, Result> {
      const any = kind as unknown as ResidentKind<unknown, unknown, unknown>
      const schedule = scheduleOf(any)
      const resident: Resident = { rid: nextRid++, kind: any, schedule, init, slot: homeOf(schedule.lane), local: null, disposed: false }
      residents.add(resident)
      resident.slot?.residents.add(resident)
      resident.slot?.worker.postMessage({ t: 'create', rid: resident.rid, kind: kind.id, init } satisfies ToWorker)
      const local = (): ResidentInstance<unknown, unknown> => (resident.local ??= any.create(init))
      return {
        id: kind.id,
        step(input: Step, at?: { readonly frame?: number; readonly latencyFrames?: number }): TaskHandle<Result> {
          if (resident.disposed) throw new Error(`${kind.id}: resident disposed`)
          const submitted = at?.frame ?? frame
          const job = makeJob({
            kind: any,
            schedule,
            dueFrame: submitted + latencyOf(schedule, at),
            message: (id) => ({ t: 'step', id, rid: resident.rid, input }),
            transfer: schedule.late === 'sync' ? [] : [...(kind.transferInput?.(input) ?? [])],
            runHere: () => local().step(input),
            resident,
          })
          enqueue(job)
          return handleOf<Result>(job)
        },
        dispose(): void {
          if (resident.disposed) return
          resident.disposed = true
          residents.delete(resident)
          resident.slot?.residents.delete(resident)
          if (resident.slot?.alive) resident.slot.worker.postMessage({ t: 'dispose', rid: resident.rid } satisfies ToWorker)
          resident.local?.dispose?.()
        },
      }
    },

    tick(at: number): void {
      frame = at
      dispatch()
    },

    async warm(kinds: readonly AnyWorkerKind[]): Promise<void> {
      for (const kind of kinds) scheduleOf(kind)
      await Promise.all(
        slots.map(async (slot) => {
          const id = nextId++
          const known = await new Promise<readonly string[]>((resolve) => {
            slot.hello.set(id, resolve)
            slot.worker.postMessage({ t: 'hello', id } satisfies ToWorker)
          })
          const missing = kinds.filter((kind) => !known.includes(kind.id)).map((kind) => kind.id)
          if (missing.length) throw new Error(`worker ${slot.index} does not know ${missing.join(', ')}: add them to its installWorkerHost`)
        }),
      )
      // each worker runs each warm-up once, straight to it (the queue would give them all to the first free worker)
      const warmups: Promise<unknown>[] = []
      for (const kind of kinds) {
        if (kind.kind !== 'task' || kind.warmup === undefined) continue
        for (const slot of slots) {
          const job = makeJob({ kind, schedule: scheduleOf(kind), dueFrame: Number.NEGATIVE_INFINITY, message: (id) => ({ t: 'task', id, kind: kind.id, input: kind.warmup }), transfer: [], runHere: () => kind.run(kind.warmup), resident: null })
          job.counters.submitted--
          send(slot, job)
          warmups.push(job.promise.catch(() => undefined))
        }
      }
      await Promise.all(warmups)
    },

    scheduleOf,

    stats(): WorkerCoordinatorStats {
      let running = 0
      for (const slot of slots) running += slot.running.size
      const lanes = { sim: 0, build: 0, background: 0 }
      for (const slot of slots) lanes[slot.home]++
      return {
        workers: slots.length,
        lanes,
        queued: WORKER_LANES.reduce((n, lane) => n + queues[lane].length, 0) + mainQueue.length + slots.reduce((n, slot) => n + slot.own.length, 0),
        running,
        respawned,
        kinds: [...counters.values()].map((c) => ({ ...c })),
      }
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      if (mainTimer) clearTimeout(mainTimer)
      const pending = [...WORKER_LANES.flatMap((lane) => queues[lane]), ...mainQueue, ...slots.flatMap((slot) => [...slot.own, ...slot.running.values()])]
      for (const job of pending) if (job.state === 'queued' || job.state === 'running') fail(job, new Error('worker coordinator: disposed'))
      for (const slot of slots) {
        slot.alive = false
        slot.worker.terminate()
      }
      for (const resident of residents) resident.local?.dispose?.()
      residents.clear()
      slots.length = 0
    },
  }
  return coordinator
}
