import { DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import type { DeferredQueue } from '@adatechnology/game-contracts'

/** A sound waiting to be built: `run` builds it, `drop` gives its voice back when it waited too long to still make sense. */
export type StartJob = { readonly queuedAt: number; run(): void; drop(): void }

export type StartQueueOptions = {
  /** Most milliseconds of main-thread work one task spends building voices (at least one voice is always built). Default 2. */
  readonly budgetMs?: number
  /** A voice still waiting after this many milliseconds is dropped instead of starting late. Default 250. */
  readonly maxLatencyMs?: number
}

export type StartQueue = {
  push(job: Omit<StartJob, 'queuedAt'>): void
  /** Puts jobs in front of everything waiting, in the order given: each is still one job of the queue's budget, and none waits behind later sounds. */
  pushFront?(batch: readonly Omit<StartJob, 'queuedAt'>[]): void
  /** The queue's own clock, in milliseconds, so a caller can stamp a request without a clock of its own. */
  now?(): number
  /** Whether something stamped at `stamp` has waited past the latency limit. */
  stale?(stamp: number): boolean
  clear(): void
  readonly size: number
  /** The same queue as a `DeferredQueue` for a shared frame budget. Asking for it changes nothing: the queue drains by itself until a budget attaches it. */
  deferredQueue?(): DeferredQueue
}

const nowMs = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now())

function scheduleTask(task: () => void): void {
  if (typeof MessageChannel === 'undefined') {
    setTimeout(task, 0)
    return
  }
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    task()
  }
  channel.port2.postMessage(0)
}

/** Builds voices in small timed slices between frames, so a burst (an explosion's debris, glass and metal) never lands inside one frame. */
/** The queue this package makes always has its `deferredQueue`; a third-party `StartQueue` may leave it out. */
export type OwnStartQueue = StartQueue & { deferredQueue(): DeferredQueue; pushFront(batch: readonly Omit<StartJob, 'queuedAt'>[]): void; now(): number; stale(stamp: number): boolean }

export function createStartQueue(options: StartQueueOptions = {}): OwnStartQueue {
  const budgetMs = options.budgetMs ?? 2
  const maxLatencyMs = options.maxLatencyMs ?? 250
  let jobs: StartJob[] = []
  let scheduled = false
  // true once a frame budget owns the draining: nothing schedules a task by itself
  let attached = false

  // the age of the job that is running: jobs it puts in front are as old as it is
  let running: number | undefined
  const runNext = (): void => {
    const job = jobs.shift() as StartJob
    running = job.queuedAt
    if (nowMs() - job.queuedAt > maxLatencyMs) job.drop()
    else job.run()
    running = undefined
  }

  const drain = (): void => {
    scheduled = false
    if (attached) return
    const began = nowMs()
    while (jobs.length > 0) {
      runNext()
      if (nowMs() - began >= budgetMs) break
    }
    if (jobs.length > 0) schedule()
  }

  const schedule = (): void => {
    if (scheduled || attached) return
    scheduled = true
    scheduleTask(drain)
  }

  const queue: OwnStartQueue = {
    push(job) {
      jobs.push({ ...job, queuedAt: nowMs() })
      schedule()
    },
    pushFront(batch) {
      const queuedAt = running ?? nowMs()
      jobs.splice(0, 0, ...batch.map((job) => ({ ...job, queuedAt })))
      schedule()
    },
    clear() {
      for (const job of jobs) job.drop()
      jobs = []
    },
    get size() {
      return jobs.length
    },
    now: nowMs,
    stale: (stamp) => nowMs() - stamp > maxLatencyMs,
    deferredQueue: () => deferredQueue,
  }

  const deferredQueue: DeferredQueue = {
    id: DEFERRED_QUEUE_ID.AUDIO_VOICES,
    pending: () => jobs.length,
    run(deadline, clock) {
      let ran = 0
      while (jobs.length > 0) {
        runNext()
        ran++
        if (clock() >= deadline) break
      }
      return ran
    },
    flush() {
      while (jobs.length > 0) runNext()
    },
    attach() {
      attached = true
    },
    detach() {
      attached = false
      if (jobs.length > 0) schedule()
    },
  }
  return queue
}
