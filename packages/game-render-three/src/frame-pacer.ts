/** The part of a WebGL2 context the pacer reads; the renderer's `getContext()` satisfies it. */
export type FramePacerContext = {
  readonly SYNC_GPU_COMMANDS_COMPLETE: number
  readonly TIMEOUT_EXPIRED: number
  fenceSync(condition: number, flags: number): WebGLSync | null
  clientWaitSync(sync: WebGLSync, flags: number, timeout: number): number
  deleteSync(sync: WebGLSync | null): void
  flush(): void
}

export type FramePacerOptions = {
  /** Most frames in a row the pacer may hold back before it lets one through (default 3), so a stuck fence cannot freeze the picture. */
  readonly maxSkips?: number
  /** Frames the GPU may be behind before a draw is held back (default 2). The browser reports a fence only some 20 ms after the GPU finished it, so 1 would cap every GPU at one frame per report. */
  readonly framesInFlight?: number
}

export type FramePacer = {
  /** True when fewer than `framesInFlight` drawn frames are unfinished: draw this frame. False: the GPU is too far behind, skip the draw and keep simulating. */
  ready(): boolean
  /** Fences the frame just drawn; call it right after the render. */
  submitted(): void
  /** Draws held back so far. */
  readonly skipped: number
  dispose(): void
}

const DEFAULT_MAX_SKIPS = 3
const DEFAULT_FRAMES_IN_FLIGHT = 2

/**
 * Keeps the GPU a few frames behind the CPU at most. A frame loop that draws as fast as it can (no vsync, as the perf runs do, or a slow GPU) fills the driver's queue and
 * then blocks in the compositor for the length of the whole queue: a run of 5 ms frames and a 150 ms one. Holding back the draw while the last frame is unfinished spends that
 * time on the next simulation step instead, and the longest frame is the GPU's own. A context without fences (WebGL1) is never held back.
 */
export function createFramePacer(context: FramePacerContext | null, options: FramePacerOptions = {}): FramePacer {
  const maxSkips = options.maxSkips ?? DEFAULT_MAX_SKIPS
  const framesInFlight = options.framesInFlight ?? DEFAULT_FRAMES_IN_FLIGHT
  const fences: WebGLSync[] = []
  let skippedInRow = 0
  let skipped = 0
  const dropOldest = (): void => {
    const oldest = fences.shift()
    if (oldest && context) context.deleteSync(oldest)
  }
  return {
    ready() {
      if (!context) return true
      while (fences.length > 0 && context.clientWaitSync(fences[0] as WebGLSync, 0, 0) !== context.TIMEOUT_EXPIRED) dropOldest()
      if (fences.length >= framesInFlight && skippedInRow < maxSkips) {
        skippedInRow++
        skipped++
        return false
      }
      skippedInRow = 0
      if (fences.length >= framesInFlight) dropOldest()
      return true
    },
    submitted() {
      if (!context || typeof context.fenceSync !== 'function') return
      const fence = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
      if (fence) fences.push(fence)
      context.flush()
    },
    get skipped() {
      return skipped
    },
    dispose() {
      while (fences.length > 0) dropOldest()
    },
  }
}
