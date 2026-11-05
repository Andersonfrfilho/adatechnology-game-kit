/**
 * The driver aids the controls apply between the pedals and the engine: the drive profile (economy shifts early and softens the gas, sport holds the
 * gears and sharpens it), traction control (cuts the torque while a driven wheel spins past its grip) and cruise control (holds the set speed with the
 * gas; the brake or the clutch cancels it, the gas pedal overrides it while pressed). Pure functions over numbers, every threshold an option.
 */
export type DriveProfile = 'eco' | 'normal' | 'sport'

export interface ProfileTuning {
  /** Multiplies the gas pedal. */
  readonly throttle: number
  /** Upshift and downshift points, shares of the redline (the semi driver's `upshiftFraction` and `downshiftFraction`). */
  readonly upshift: number
  readonly downshift: number
}

export const DRIVE_PROFILES: Readonly<Record<DriveProfile, ProfileTuning>> = {
  eco: { throttle: 0.7, upshift: 0.55, downshift: 0.25 },
  normal: { throttle: 1, upshift: 0.85, downshift: 0.35 },
  sport: { throttle: 1, upshift: 0.97, downshift: 0.55 },
}

export interface TractionOptions {
  /** Grip in use of a driven wheel (1 = sliding) above which the torque is cut. */
  readonly slip: number
  /** Torque left at full spin. */
  readonly floor: number
}

export const DEFAULT_TRACTION: TractionOptions = { slip: 0.97, floor: 0.35 }

/** Share of the torque traction control lets through for the worst driven wheel's grip in use (1 = sliding). */
export function tractionLimit(slips: readonly number[], options: TractionOptions = DEFAULT_TRACTION): number {
  const worst = Math.max(0, ...slips)
  if (worst <= options.slip) return 1
  return Math.max(options.floor, 1 - (worst - options.slip) / (1 - options.slip))
}

export interface CruiseOptions {
  /** Gas per m/s under the set speed. */
  readonly gain: number
  /** Lowest speed it engages at, m/s (about 30 km/h). */
  readonly minSpeed: number
}

export const DEFAULT_CRUISE: CruiseOptions = { gain: 0.35, minSpeed: 8.3 }

/** Gas cruise control asks for to hold `target` at `speed` (m/s); none above the target, the car coasts down to it. */
export function cruiseThrottle(target: number, speed: number, options: CruiseOptions = DEFAULT_CRUISE): number {
  return Math.max(0, Math.min(1, (target - speed) * options.gain + 0.12))
}
