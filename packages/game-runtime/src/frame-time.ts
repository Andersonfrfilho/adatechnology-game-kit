import { toMicros } from './clock'

export interface FrameTimeConfig {
  readonly fixedMicros: number
  readonly fixedDt: number
  readonly maxFrameSeconds: number
  readonly snapMicros: number
}

export interface FrameTime {
  readonly seconds: number
  readonly micros: number
  /** What the snap left over, carried to the next frame. */
  readonly residual: number
}

/** A time that is not a finite positive number (NaN, a negative delta from a clock that went back) counts as no time. */
export const sanitizeSeconds = (seconds: number): number => (Number.isFinite(seconds) && seconds > 0 ? seconds : 0)

/** The scale is never negative; a NaN scale is read as real time. */
export const sanitizeTimeScale = (scale: number): number => (Number.isFinite(scale) ? Math.max(0, scale) : 1)

/** Clamps a real frame, adds the residue of the last snap and snaps a frame within a hair of whole fixed steps to exactly those steps. */
export function resolveFrameTime(realSeconds: number, exact: boolean, residual: number, config: FrameTimeConfig): FrameTime {
  const given = sanitizeSeconds(realSeconds)
  if (exact) return { seconds: given, micros: toMicros(given), residual }
  const clamped = Math.min(given, config.maxFrameSeconds)
  const micros = toMicros(clamped) + residual
  const wholeSteps = Math.round(micros / config.fixedMicros)
  const drift = micros - wholeSteps * config.fixedMicros
  if (config.snapMicros > 0 && wholeSteps >= 1 && Math.abs(drift) <= config.snapMicros) {
    return { seconds: wholeSteps * config.fixedDt, micros: wholeSteps * config.fixedMicros, residual: drift }
  }
  return { seconds: clamped, micros, residual: 0 }
}
