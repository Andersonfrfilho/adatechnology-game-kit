import { PRESET_VALUES, targetFrameMs } from './settings'
import type { EffectiveGraphics, GraphicsSettings, ShadowLevel, ViewDistance } from './settings'

/** How fast the machine drew the calibration scene, as a preset name. */
export type GraphicsTier = 'low' | 'medium' | 'high' | 'ultra'

export interface AutoTunerOptions {
  /** Above `target × downAt` for `downHoldS` seconds, the tuner steps down (default 1.05 and 0.5 s). */
  readonly downAt?: number
  readonly downHoldS?: number
  /** Below `target × upAt` for `upHoldS` seconds, it steps back up (default 0.7 and 3 s): it climbs slowly so it does not swing. */
  readonly upAt?: number
  readonly upHoldS?: number
  /** Share of each new frame in the smoothed load (default 0.1). */
  readonly smoothing?: number
}

export interface TunerStep {
  readonly resolutionScale: number
  readonly shadows: ShadowLevel
}

export interface AutoTunerState extends TunerStep {
  /** Where on the ladder the tuner is: 0 is the best it may draw. */
  readonly level: number
  readonly levels: number
  readonly viewDistance: ViewDistance
  /** The smoothed load it decides on, milliseconds. */
  readonly loadMs: number
  readonly targetMs: number
}

export interface AutoTuner {
  /** Starts over for these settings, at the step of the machine's tier (default `high`). */
  reset(settings: GraphicsSettings, tier?: GraphicsTier): void
  /** One frame: `loadMs` is what the frame cost (the frame's work, or the time between frames when there is no better measure). Returns true when a step changed. */
  frame(dtSeconds: number, loadMs: number): boolean
  readonly state: AutoTunerState
  /** The settings with every `auto` replaced by the tuner's value. */
  effective(settings: GraphicsSettings): EffectiveGraphics
}

/**
 * The full ladder, best first: the shadows go to the near ones before any pixel is lost, the resolution comes down to 80 %, the shadows go off, and only then
 * the resolution comes down to half. A knob the player fixed keeps its value on every step, and the steps that would only move it fall out.
 */
const FULL_LADDER: readonly TunerStep[] = [
  { resolutionScale: 1, shadows: 'all' },
  { resolutionScale: 1, shadows: 'near' },
  { resolutionScale: 0.9, shadows: 'near' },
  { resolutionScale: 0.8, shadows: 'near' },
  { resolutionScale: 0.8, shadows: 'off' },
  { resolutionScale: 0.7, shadows: 'off' },
  { resolutionScale: 0.6, shadows: 'off' },
  { resolutionScale: 0.5, shadows: 'off' },
]

/** Where each tier starts on the full ladder. */
const TIER_START: Readonly<Record<GraphicsTier, TunerStep>> = {
  ultra: FULL_LADDER[0]!,
  high: FULL_LADDER[1]!,
  medium: FULL_LADDER[3]!,
  low: FULL_LADDER[5]!,
}

/** The ladder for these settings: fixed knobs pinned, repeated steps dropped. */
export function tunerLadder(settings: GraphicsSettings): readonly TunerStep[] {
  const out: TunerStep[] = []
  for (const step of FULL_LADDER) {
    const s: TunerStep = {
      resolutionScale: settings.resolutionScale === 'auto' ? step.resolutionScale : settings.resolutionScale,
      shadows: settings.shadows === 'auto' ? step.shadows : settings.shadows,
    }
    const last = out[out.length - 1]
    if (!last || last.resolutionScale !== s.resolutionScale || last.shadows !== s.shadows) out.push(s)
  }
  return out
}

/** How good a step looks: the resolution counts first, the shadows break ties. */
const score = (s: TunerStep): number => s.resolutionScale * 10 + shadowRank(s.shadows)
/** The first step of the ladder at or below the quality the tier starts at. */
function startLevel(ladder: readonly TunerStep[], tier: GraphicsTier): number {
  const want = score(TIER_START[tier]) + 1e-9
  const i = ladder.findIndex((s) => score(s) <= want)
  return i < 0 ? ladder.length - 1 : i
}
const shadowRank = (s: ShadowLevel): number => (s === 'all' ? 2 : s === 'near' ? 1 : 0)

/**
 * The automatic mode: it watches the frame time and moves the resolution and the shadows that are left on `auto` up and down one step at a time, aiming at the
 * frame of the cap. The horde is not its job: the crowd renderer already shrinks and grows its own budget (`budget.adapt` of `game-crowd-three`).
 */
export function createAutoTuner(options: AutoTunerOptions = {}): AutoTuner {
  const downAt = options.downAt ?? 1.05
  const downHoldS = options.downHoldS ?? 0.5
  const upAt = options.upAt ?? 0.7
  const upHoldS = options.upHoldS ?? 3
  const smoothing = options.smoothing ?? 0.1
  let ladder: readonly TunerStep[] = FULL_LADDER
  let level = 1
  let tier: GraphicsTier = 'high'
  let target = 1000 / 60
  let load = 0
  let over = 0
  let under = 0

  const tuner: AutoTuner = {
    reset(settings, t = 'high') {
      tier = t
      ladder = tunerLadder(settings)
      level = startLevel(ladder, tier)
      target = targetFrameMs(settings.fpsCap)
      load = 0
      over = 0
      under = 0
    },
    frame(dt, loadMs) {
      if (!(dt > 0) || !Number.isFinite(loadMs)) return false
      load = load === 0 ? loadMs : load + (loadMs - load) * smoothing
      if (load > target * downAt) {
        over += dt
        under = 0
      } else if (load < target * upAt) {
        under += dt
        over = 0
      } else {
        over = 0
        under = 0
      }
      if (over >= downHoldS && level < ladder.length - 1) {
        level++
        over = 0
        return true
      }
      if (under >= upHoldS && level > 0) {
        level--
        under = 0
        return true
      }
      return false
    },
    get state() {
      const step = ladder[level]!
      return { ...step, level, levels: ladder.length, viewDistance: PRESET_VALUES[tier].viewDistance as ViewDistance, loadMs: load, targetMs: target }
    },
    effective(settings) {
      const step = ladder[Math.min(level, ladder.length - 1)]!
      return {
        resolutionScale: settings.resolutionScale === 'auto' ? step.resolutionScale : settings.resolutionScale,
        hordeDetail: settings.hordeDetail,
        shadows: settings.shadows === 'auto' ? step.shadows : settings.shadows,
        viewDistance: settings.viewDistance === 'auto' ? (PRESET_VALUES[tier].viewDistance as ViewDistance) : settings.viewDistance,
        fpsCap: settings.fpsCap,
        showFps: settings.showFps,
      }
    },
  }
  return tuner
}
