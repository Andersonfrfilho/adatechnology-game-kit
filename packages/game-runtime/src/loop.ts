import type { LoopOptions, Scheduler } from './types'

/** Drives `scheduler.frame` from the display's frames; listens to `visibilitychange` when there is a document. Returns the stop function. */
export function startLoop(scheduler: Scheduler, options: LoopOptions = {}): () => void {
  const requestFrame = options.requestFrame ?? globalThis.requestAnimationFrame?.bind(globalThis)
  const cancelFrame = options.cancelFrame ?? globalThis.cancelAnimationFrame?.bind(globalThis)
  if (!requestFrame) throw new Error('startLoop: no requestAnimationFrame here, pass requestFrame')
  let last: number = options.startMs ?? (typeof performance !== 'undefined' ? performance.now() : 0)
  let handle = 0
  let stopped = false

  const onFrame = (nowMs: number): void => {
    if (stopped) return
    handle = requestFrame(onFrame)
    const realSeconds = (nowMs - last) / 1000
    last = nowMs
    options.onFrame?.(realSeconds)
    scheduler.frame(realSeconds, options.skipSimulation?.() ? { simulate: false } : undefined)
  }

  const onVisibility = (): void => {
    if (document.visibilityState !== 'visible') return
    // the first frame back measures from now, not from before the tab went away
    if (typeof performance !== 'undefined') last = performance.now()
    scheduler.resetClock()
  }
  const hasDocument = typeof document !== 'undefined' && typeof document.addEventListener === 'function'
  if (hasDocument) document.addEventListener('visibilitychange', onVisibility)
  handle = requestFrame(onFrame)

  return () => {
    stopped = true
    cancelFrame?.(handle)
    if (hasDocument) document.removeEventListener('visibilitychange', onVisibility)
  }
}
