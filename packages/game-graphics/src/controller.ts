import { createBenchmark } from './benchmark'
import type { Benchmark, BenchmarkOptions, BenchmarkResult } from './benchmark'
import { createFpsMeter, minFrameMs } from './fps'
import { anyAuto, targetFrameMs } from './settings'
import type { EffectiveGraphics, GraphicsSettings } from './settings'
import { createGraphicsStore } from './store'
import type { GraphicsStore, GraphicsStoreOptions } from './store'
import { createAutoTuner } from './tuner'
import type { AutoTunerOptions, AutoTunerState, GraphicsTier } from './tuner'

export interface GraphicsControllerOptions {
  /** Where the choice is kept (default a store on `localStorage`). */
  readonly store?: GraphicsStore | GraphicsStoreOptions
  /** Names the GPU, so a calibration made on another one is done again (default `unknown`). */
  readonly gpu?: string
  /** Draws with these values: called at once, after each change of the player and each step of the automatic mode. */
  readonly apply: (effective: EffectiveGraphics, controller: GraphicsController) => void
  readonly tuner?: AutoTunerOptions
  readonly benchmark?: BenchmarkOptions | false
  /**
   * When the calibration of a first run starts: `now` (default) or `manual`, where the host calls `calibrateIfNeeded()` once its scene is up, so the measure is of
   * the game's frames and not of the loading.
   */
  readonly calibrate?: 'now' | 'manual'
}

export type GraphicsPhase = 'calibrating' | 'running'

export interface GraphicsController {
  readonly settings: GraphicsSettings
  /** What is drawn now. */
  readonly effective: EffectiveGraphics
  readonly phase: GraphicsPhase
  readonly tuner: AutoTunerState
  readonly tier: GraphicsTier
  readonly calibration: BenchmarkResult | null
  /** Share of the calibration done, 0 to 1 (1 when not calibrating). */
  readonly calibrationProgress: number
  /** Frames a second over the last half second. */
  readonly fps: number
  /** What each part that adapts on its own says it draws now (e.g. `hordeDetail`: the crowd renderer's `detailScale`). */
  readonly reported: Readonly<Record<string, number>>
  report(key: string, value: number): void
  /** The player's change: kept, and the automatic mode starts over for the options still on `auto`. */
  set(settings: GraphicsSettings): void
  /** Runs the short test again (the screen's Calibrar button). */
  recalibrate(): void
  /** Runs it when an option is on `auto` and this GPU was never measured; returns whether it started. */
  calibrateIfNeeded(): boolean
  /** Whether a calibration is owed (an option on `auto`, this GPU never measured, none running). */
  readonly needsCalibration: boolean
  /** One real frame: its seconds and what it cost, milliseconds (the frame's work; without a measure, pass the seconds × 1000). */
  frame(dtSeconds: number, loadMs: number): void
  /** The least milliseconds between two drawn frames for the cap (0: none), for the host's loop. */
  minFrameMs(): number
  /** Called after each change of the settings, the effective values or the phase. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

const TOP: Pick<EffectiveGraphics, 'resolutionScale' | 'shadows'> = { resolutionScale: 1, shadows: 'all' }

/**
 * The graphics settings of a game, without any screen or renderer: it keeps the player's choice, runs the short calibration when an option is on `auto` and
 * this GPU was never measured, then lets the automatic mode move the options still on `auto`. The host draws with what `apply` receives.
 */
export function createGraphicsController(options: GraphicsControllerOptions): GraphicsController {
  const store = options.store && 'subscribe' in options.store ? options.store : createGraphicsStore(options.store as GraphicsStoreOptions | undefined)
  const gpu = options.gpu ?? 'unknown'
  const tuner = createAutoTuner(options.tuner)
  const meter = createFpsMeter()
  const listeners = new Set<() => void>()
  const reported: Record<string, number> = {}
  let tier: GraphicsTier = store.tierFor(gpu)
  let bench: Benchmark | null = null
  let effective: EffectiveGraphics

  const notify = (): void => {
    for (const l of listeners) l()
  }
  const computeEffective = (): EffectiveGraphics => {
    const e = tuner.effective(store.settings)
    if (!bench) return e
    // the calibration draws what is on auto at its best, so the measure is of the hardest step
    const s = store.settings
    return { ...e, resolutionScale: s.resolutionScale === 'auto' ? TOP.resolutionScale : e.resolutionScale, shadows: s.shadows === 'auto' ? TOP.shadows : e.shadows }
  }
  const push = (): void => {
    effective = computeEffective()
    options.apply(effective, controller)
    notify()
  }
  const startBenchmark = (): void => {
    bench = options.benchmark === false ? null : createBenchmark({ targetMs: targetFrameMs(store.settings.fpsCap), ...(options.benchmark || {}) })
  }

  const controller: GraphicsController = {
    get settings() {
      return store.settings
    },
    get effective() {
      return effective
    },
    get phase() {
      return bench ? 'calibrating' : 'running'
    },
    get tuner() {
      return tuner.state
    },
    get tier() {
      return tier
    },
    get calibration() {
      return store.calibrationFor(gpu)
    },
    get calibrationProgress() {
      return bench ? bench.progress : 1
    },
    get fps() {
      return meter.fps
    },
    reported,
    report(key, value) {
      if (reported[key] === value) return
      reported[key] = value
    },
    set(settings) {
      store.set(settings)
      tuner.reset(store.settings, tier)
      push()
    },
    recalibrate() {
      startBenchmark()
      push()
    },
    calibrateIfNeeded() {
      if (!controller.needsCalibration) return false
      controller.recalibrate()
      return bench !== null
    },
    get needsCalibration() {
      return options.benchmark !== false && !bench && anyAuto(store.settings) && !store.calibrationFor(gpu)
    },
    frame(dt, loadMs) {
      meter.frame(dt)
      if (bench) {
        if (!bench.frame(dt, loadMs)) return
        const result = bench.result()
        bench = null
        if (result) {
          tier = result.tier
          store.setCalibration({ ...result, gpu, at: Date.now() })
        }
        tuner.reset(store.settings, tier)
        push()
        return
      }
      if (!anyAuto(store.settings)) return
      if (tuner.frame(dt, loadMs)) push()
    },
    minFrameMs: () => minFrameMs(store.settings.fpsCap),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  tuner.reset(store.settings, tier)
  if (options.calibrate !== 'manual' && anyAuto(store.settings) && !store.calibrationFor(gpu)) startBenchmark()
  effective = computeEffective()
  options.apply(effective, controller)
  return controller
}
