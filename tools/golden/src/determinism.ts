import { createSeededRandom } from './seededRandom'

type FrameCallback = (timestamp: number) => void

/** The slice of the global scope the tool replaces; tests pass a plain object instead of the real global. */
export type DeterminismTarget = {
  Math: { random: () => number }
  Date: { now: () => number }
  performance: { now: () => number }
  requestAnimationFrame?: (callback: FrameCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export type DeterminismOptions = {
  readonly seed: number
  /** Value reported by `Date.now()` at the start; the clock then only moves through `advance` and `stepFrames`. */
  readonly startTimeMs?: number
  readonly target?: DeterminismTarget
}

export type Determinism = {
  /** Moves the frozen clocks forward without running frames. */
  readonly advance: (milliseconds: number) => void
  /** Runs `count` animation frames, each `frameMs` apart, including callbacks scheduled by the callbacks themselves. */
  readonly stepFrames: (count: number, frameMs?: number) => void
  readonly restore: () => void
}

const DEFAULT_START_TIME_MS = 1_700_000_000_000
const DEFAULT_FRAME_MS = 1000 / 60

export function installDeterminism(options: DeterminismOptions): Determinism {
  const target = options.target ?? (globalThis as unknown as DeterminismTarget)
  const original = {
    random: target.Math.random,
    dateNow: target.Date.now,
    performanceNow: target.performance.now,
    requestAnimationFrame: target.requestAnimationFrame,
    cancelAnimationFrame: target.cancelAnimationFrame,
  }
  const startTimeMs = options.startTimeMs ?? DEFAULT_START_TIME_MS
  let elapsedMs = 0
  let nextHandle = 1
  let queue = new Map<number, FrameCallback>()

  target.Math.random = createSeededRandom(options.seed)
  target.Date.now = () => startTimeMs + elapsedMs
  target.performance.now = () => elapsedMs
  target.requestAnimationFrame = (callback) => {
    queue.set(nextHandle, callback)
    return nextHandle++
  }
  target.cancelAnimationFrame = (handle) => {
    queue.delete(handle)
  }

  function advance(milliseconds: number): void {
    elapsedMs += milliseconds
  }

  function stepFrames(count: number, frameMs = DEFAULT_FRAME_MS): void {
    for (let frame = 0; frame < count; frame++) {
      advance(frameMs)
      const due = queue
      queue = new Map()
      for (const callback of due.values()) callback(elapsedMs)
    }
  }

  function restore(): void {
    target.Math.random = original.random
    target.Date.now = original.dateNow
    target.performance.now = original.performanceNow
    if (original.requestAnimationFrame) target.requestAnimationFrame = original.requestAnimationFrame
    else delete target.requestAnimationFrame
    if (original.cancelAnimationFrame) target.cancelAnimationFrame = original.cancelAnimationFrame
    else delete target.cancelAnimationFrame
    queue.clear()
  }

  return { advance, stepFrames, restore }
}

/** Runs `run` under the seeded environment and always restores the real clocks and `Math.random` afterwards. */
export function withDeterminism<TResult>(options: DeterminismOptions, run: (environment: Determinism) => TResult): TResult {
  const environment = installDeterminism(options)
  try {
    return run(environment)
  } finally {
    environment.restore()
  }
}
