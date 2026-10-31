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
  clear(): void
  readonly size: number
  /** The same queue as a `DeferredQueue` for a shared frame budget. Asking for it changes nothing: the queue drains by itself until a budget attaches it. */
  deferredQueue(): DeferredQueue
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
export function createStartQueue(options: StartQueueOptions = {}): StartQueue {
  const budgetMs = options.budgetMs ?? 2
  const maxLatencyMs = options.maxLatencyMs ?? 250
  let jobs: StartJob[] = []
  let scheduled = false
  // true once a frame budget owns the draining: nothing schedules a task by itself
  let attached = false

  const runNext = (): void => {
    const job = jobs.shift() as StartJob
    if (nowMs() - job.queuedAt > maxLatencyMs) job.drop()
    else job.run()
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

  const queue: StartQueue = {
    push(job) {
      jobs.push({ ...job, queuedAt: nowMs() })
      schedule()
    },
    clear() {
      for (const job of jobs) job.drop()
      jobs = []
    },
    get size() {
      return jobs.length
    },
    deferredQueue: () => deferredQueue,
  }

  const deferredQueue: DeferredQueue = {
    id: 'audio.voices',
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
