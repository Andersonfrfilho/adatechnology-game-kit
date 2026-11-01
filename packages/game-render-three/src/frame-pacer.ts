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
}

export type FramePacer = {
  /** True when the GPU has finished the frame `submitted` fenced (or none was fenced): draw this frame. False: the GPU is still behind, skip the draw and keep simulating. */
  ready(): boolean
  /** Fences the frame just drawn; call it right after the render. */
  submitted(): void
  /** Draws held back so far. */
  readonly skipped: number
  dispose(): void
}

const DEFAULT_MAX_SKIPS = 3

/**
 * Keeps the GPU at most one frame behind the CPU. A frame loop that draws as fast as it can (no vsync, as the perf runs do, or a slow GPU) fills the driver's queue and
 * then blocks in the compositor for the length of the whole queue: a run of 5 ms frames and a 150 ms one. Holding back the draw while the last frame is unfinished spends that
 * time on the next simulation step instead, and the longest frame is the GPU's own. A context without fences (WebGL1) is never held back.
 */
export function createFramePacer(context: FramePacerContext | null, options: FramePacerOptions = {}): FramePacer {
  const maxSkips = options.maxSkips ?? DEFAULT_MAX_SKIPS
  let fence: WebGLSync | null = null
  let skippedInRow = 0
  let skipped = 0
  const clear = (): void => {
    if (fence && context) context.deleteSync(fence)
    fence = null
  }
  return {
    ready() {
      if (!context || !fence) return true
      const isDone = context.clientWaitSync(fence, 0, 0) !== context.TIMEOUT_EXPIRED
      if (!isDone && skippedInRow < maxSkips) {
        skippedInRow++
        skipped++
        return false
      }
      skippedInRow = 0
      clear()
      return true
    },
    submitted() {
      if (!context || typeof context.fenceSync !== 'function') return
      clear()
      fence = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
      context.flush()
    },
    get skipped() {
      return skipped
    },
    dispose: clear,
  }
}
