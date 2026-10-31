/** A sound waiting to be built: `run` builds it, `drop` gives its voice back when it waited too long to still make sense. */
export type StartJob = { readonly queuedAt: number; run(): void; drop(): void }

export type StartQueueOptions = {
  /** Most milliseconds of main-thread work one task spends building voices (at least one voice is always built). Default 2. */
  readonly budgetMs?: number
  /** A voice still waiting after this many milliseconds is dropped instead of starting late. Default 250. */
  readonly maxLatencyMs?: number
}

export type StartQueue = { push(job: Omit<StartJob, 'queuedAt'>): void; clear(): void; readonly size: number }

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

  const drain = (): void => {
    scheduled = false
    const began = nowMs()
    while (jobs.length > 0) {
      const job = jobs.shift() as StartJob
      if (nowMs() - job.queuedAt > maxLatencyMs) job.drop()
      else job.run()
      if (nowMs() - began >= budgetMs) break
    }
    if (jobs.length > 0) schedule()
  }

  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    scheduleTask(drain)
  }

  return {
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
  }
}
