import type { GraphicsTier } from './tuner'

export interface BenchmarkOptions {
  /** How long it measures, seconds (default 3). */
  readonly durationS?: number
  /** The first frames of a scene compile programs and upload textures: they are left out (default 0.4 s). */
  readonly warmupS?: number
  /** The frame the machine should hold, milliseconds (default 1000 / 60). */
  readonly targetMs?: number
}

export interface BenchmarkResult {
  readonly tier: GraphicsTier
  /** Median and 90th percentile of the frame load measured, milliseconds. */
  readonly p50Ms: number
  readonly p90Ms: number
  readonly frames: number
}

export interface Benchmark {
  /** One frame: its seconds and its load in milliseconds. Returns true once the measure is over. */
  frame(dtSeconds: number, loadMs: number): boolean
  /** Share of the measure done, 0 to 1. */
  readonly progress: number
  readonly done: boolean
  /** The result once done (or what it has so far, when asked to stop early); null without a single frame measured. */
  result(): BenchmarkResult | null
}

/** Tier from the median load over the target frame: well under half a frame is Ultra, over a whole frame is Baixa. */
export function tierOf(p50Ms: number, targetMs: number): GraphicsTier {
  const r = p50Ms / targetMs
  return r < 0.45 ? 'ultra' : r < 0.75 ? 'high' : r < 1.1 ? 'medium' : 'low'
}

const percentile = (sorted: readonly number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0

/**
 * The short test of the loading screen: the host draws its scene at the best step for a few seconds and feeds each frame here; the median load says
 * where the automatic mode starts, so the first minute of play is not spent climbing down from Ultra.
 */
export function createBenchmark(options: BenchmarkOptions = {}): Benchmark {
  const duration = options.durationS ?? 3
  const warmup = options.warmupS ?? 0.4
  const targetMs = options.targetMs ?? 1000 / 60
  const samples: number[] = []
  let elapsed = 0
  const bench: Benchmark = {
    frame(dt, loadMs) {
      if (bench.done) return true
      if (dt > 0) elapsed += dt
      if (elapsed > warmup && Number.isFinite(loadMs) && loadMs > 0) samples.push(loadMs)
      return bench.done
    },
    get progress() {
      return Math.min(1, elapsed / (duration + warmup))
    },
    get done() {
      return elapsed >= duration + warmup
    },
    result() {
      if (samples.length === 0) return null
      const sorted = [...samples].sort((a, b) => a - b)
      const p50Ms = percentile(sorted, 0.5)
      return { tier: tierOf(p50Ms, targetMs), p50Ms, p90Ms: percentile(sorted, 0.9), frames: samples.length }
    },
  }
  return bench
}
