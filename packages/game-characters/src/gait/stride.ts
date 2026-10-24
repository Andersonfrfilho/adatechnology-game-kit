import gait from '../data/gait.json'

const WALK = gait.walk

/** Cycles per second at `speed` m/s (the game's `walkCad`). */
export const walkCadence = (speed: number): number => WALK.cadenceBase + WALK.cadencePerSpeed * speed

/** Hip swing in radians at `speed` m/s for a body `height` times the base height: the stride that makes the foot meet the ground (the game's `walkGait`). */
export const walkGait = (speed: number, height = 1): number =>
  speed < WALK.stopBelowSpeed ? 0 : 2 * Math.asin(Math.min(WALK.maxSine, speed / (WALK.strideFactor * WALK.legLengthFactor * height * walkCadence(speed))))

export type StrideParams = {
  readonly speed: number
  readonly height?: number
  /** Default true: cadence and swing come from the speed, so the feet do not slide. False keeps the profile's own numbers (the Bestiário preset). */
  readonly strideFromSpeed?: boolean
}

export type Stride = {
  /** Cycles per second. */
  readonly frequency: number
  /** Thigh swing, radians. */
  readonly swing: number
  /** Knee bend, radians. */
  readonly kneeBend: number
}

const SWING_SHARE = 0.5
const KNEE_PER_GAIT = 0.85

/** The gait numbers for a speed: from the ground-matching stride, or `fallback` (the profile) when `strideFromSpeed` is false. */
export const strideFor = ({ speed, height = 1, strideFromSpeed = true }: StrideParams, fallback: Stride): Stride => {
  if (!strideFromSpeed) return fallback
  const amplitude = walkGait(speed, height)
  return { frequency: walkCadence(speed), swing: amplitude * SWING_SHARE, kneeBend: amplitude * KNEE_PER_GAIT }
}
