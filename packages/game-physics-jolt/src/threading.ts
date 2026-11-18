/**
 * Which JoltPhysics.js build runs the world, how many job threads it gets and how contacts reach the kit.
 *
 * The multithreaded build runs the physics step's jobs on pthreads (Web Workers sharing the wasm memory), so it needs `SharedArrayBuffer`: a page
 * served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`), or the desktop app.
 * Jolt calls the contact listener from the job that finds the contact, and with worker threads that job runs on a worker. A listener written in
 * JavaScript (`ContactListenerJS`, what the kit's contact rows, sensors, friction partners, restitution mix and ignored pairs hang on) lives only on
 * the page's main thread: on a worker the binding finds no object and the step dies with "Cannot read properties of undefined (reading
 * 'hasOwnProperty')" (measured with jolt-physics 1.1.1, docs/medicoes/jolt-multithread.md). So worker threads and JS contact callbacks never go
 * together: `resolveJoltThreading` refuses the pair.
 */

/** `single`: the `wasm-compat` build (no threads, loads anywhere). `multithread`: the `wasm-compat-multithread` build (pthreads; SIMD on). */
export type JoltBuild = 'single' | 'multithread'

/** `js`: the kit's JS contact listener (every contact feature). `none`: no listener at all; only to measure the step, the kit's contact rules stop. */
export type JoltContactCallbacks = 'js' | 'none'

export type JoltEngineOptions = {
  /** Default `single`. */
  readonly build?: JoltBuild
  /** Job threads besides the caller's (Jolt's `mMaxWorkerThreads`); default 0. Above 0 needs `build: 'multithread'` and `contactCallbacks: 'none'`. */
  readonly workerThreads?: number
  /** Default `js`. */
  readonly contactCallbacks?: JoltContactCallbacks
  /**
   * Where the multithreaded build's module is, as `import()` takes it. Its pthreads load the file `jolt-physics.multithread.wasm-compat.js` next to that
   * URL, so a bundled page serves the file beside itself and passes its URL. Default the package specifier `jolt-physics/wasm-compat-multithread`.
   */
  readonly moduleUrl?: string
}

/** What a world actually runs with. */
export type JoltThreading = {
  readonly build: JoltBuild
  readonly workerThreads: number
  readonly contactCallbacks: JoltContactCallbacks
}

export const SINGLE_THREAD: JoltThreading = { build: 'single', workerThreads: 0, contactCallbacks: 'js' }
/** Jolt's own ceiling for job threads is the machine; this keeps a typo from asking for thousands of workers. */
export const MAX_WORKER_THREADS = 64
export const MULTITHREAD_MODULE = 'jolt-physics/wasm-compat-multithread'

export const JOLT_THREADING_ERROR = {
  WORKERS_NEED_MULTITHREAD_BUILD: 'JOLT_WORKERS_NEED_MULTITHREAD_BUILD',
  WORKERS_WITH_JS_CALLBACKS: 'JOLT_WORKERS_WITH_JS_CALLBACKS',
  MULTITHREAD_NEEDS_SHARED_MEMORY: 'JOLT_MULTITHREAD_NEEDS_SHARED_MEMORY',
  BAD_WORKER_COUNT: 'JOLT_BAD_WORKER_COUNT',
} as const
export type JoltThreadingErrorCode = (typeof JOLT_THREADING_ERROR)[keyof typeof JOLT_THREADING_ERROR]

export class JoltThreadingError extends Error {
  readonly code: JoltThreadingErrorCode
  constructor(code: JoltThreadingErrorCode, message: string) {
    super(message)
    this.name = 'JoltThreadingError'
    this.code = code
  }
}

/** Whether this context can run the multithreaded build: shared memory exists and, in a page, the page is cross-origin isolated. */
export const canShareMemory = (): boolean => {
  if (typeof SharedArrayBuffer === 'undefined') return false
  const scope = globalThis as { crossOriginIsolated?: boolean }
  return scope.crossOriginIsolated !== false
}

/** The threading the options ask for, checked: throws `JoltThreadingError` for a combination that cannot run. */
export const resolveJoltThreading = (options: JoltEngineOptions = {}, sharedMemory: boolean = canShareMemory()): JoltThreading => {
  const build = options.build ?? 'single'
  const workerThreads = options.workerThreads ?? 0
  const contactCallbacks = options.contactCallbacks ?? 'js'
  if (!Number.isInteger(workerThreads) || workerThreads < 0 || workerThreads > MAX_WORKER_THREADS) {
    throw new JoltThreadingError(JOLT_THREADING_ERROR.BAD_WORKER_COUNT, `workerThreads must be an integer from 0 to ${MAX_WORKER_THREADS}, got ${workerThreads}`)
  }
  if (build === 'multithread' && !sharedMemory) {
    throw new JoltThreadingError(JOLT_THREADING_ERROR.MULTITHREAD_NEEDS_SHARED_MEMORY, 'the multithreaded build needs SharedArrayBuffer: serve the page with COOP same-origin and COEP require-corp or credentialless')
  }
  if (workerThreads > 0 && build !== 'multithread') {
    throw new JoltThreadingError(JOLT_THREADING_ERROR.WORKERS_NEED_MULTITHREAD_BUILD, 'worker threads need build: multithread')
  }
  if (workerThreads > 0 && contactCallbacks === 'js') {
    throw new JoltThreadingError(
      JOLT_THREADING_ERROR.WORKERS_WITH_JS_CALLBACKS,
      'Jolt calls the contact listener from its worker threads, where the JS listener does not exist: worker threads run only with contactCallbacks: none',
    )
  }
  return { build, workerThreads, contactCallbacks }
}
