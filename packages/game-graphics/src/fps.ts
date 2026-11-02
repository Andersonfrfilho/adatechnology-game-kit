export interface FpsMeter {
  /** One drawn frame, with its real seconds. */
  frame(dtSeconds: number): void
  /** Frames a second over the last window (0 until the first window closes). */
  readonly fps: number
  /** Mean milliseconds between frames over the last window. */
  readonly frameMs: number
}

/** Counts the frames drawn over a short window (default half a second), for the frame counter on screen. */
export function createFpsMeter(windowS = 0.5): FpsMeter {
  let frames = 0
  let time = 0
  let fps = 0
  let frameMs = 0
  return {
    frame(dt) {
      if (!(dt > 0)) return
      frames++
      time += dt
      if (time < windowS) return
      fps = frames / time
      frameMs = (time * 1000) / frames
      frames = 0
      time = 0
    },
    get fps() {
      return fps
    },
    get frameMs() {
      return frameMs
    },
  }
}

/**
 * The shortest time between two drawn frames for a cap, milliseconds (0: no cap). A display frame comes a hair early or late, so the loop draws when this much
 * has passed less a tolerance of 1 ms: at a cap of 60 on a 60 Hz screen it then draws every frame, and on a 144 Hz screen every second or third.
 */
export const minFrameMs = (fpsCap: number): number => (fpsCap > 0 ? Math.max(0, 1000 / fpsCap - 1) : 0)

/**
 * What a frame cost, for the tuner and the calibration: the larger of the CPU work of the frame and the GPU time of its draws. The time between frames only counts
 * when it shows frames being missed (over 1.25 × the target): under vsync it never drops below the display's frame, so on its own it would say a fast machine is slow,
 * and where the GPU has no timer it is the only sign of a GPU that cannot keep up.
 */
export function frameLoad(sample: { readonly cpuMs: number; readonly gpuMs?: number | null; readonly intervalMs: number; readonly targetMs: number }): number {
  const work = Math.max(sample.cpuMs, sample.gpuMs ?? 0)
  return sample.intervalMs > sample.targetMs * 1.25 ? Math.max(work, sample.intervalMs) : work
}
