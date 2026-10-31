/** How a hand turns something round in strokes (a screw cap, a tap handle, a knob): what `twistStroke` answers for one moment of the turning. */
export interface TwistStroke {
  /** Radians the wrist is turned from the middle of its stroke, positive the way the part turns. */
  readonly angle: number
  /** Radians the part has turned in all, from 0 to `strokes * reach`. */
  readonly turned: number
  /** How closed the fingers are, 0 open to 1 closed: closed on the part while it turns, open while the wrist turns back. */
  readonly grip: number
  /** 0..1, how far the hand rises off the part while the wrist turns back (1 is `TWIST_LIFT` metres). */
  readonly lift: number
}

export interface TwistOptions {
  /** Strokes of the wrist. Default 3. */
  readonly strokes?: number
  /** Radians the part turns in one stroke (a wrist turns about a quarter round with its hold). Default 1.6. */
  readonly reach?: number
}

/** Metres a hand rises off the part between two strokes. */
export const TWIST_LIFT = 0.012
/** Share of each stroke spent turning the part; the rest turns the wrist back open. */
const TURNING = 0.7

const smooth = (k: number): number => k * k * (3 - 2 * k)

/**
 * The hand turning a part round at `share` (0..1) of the whole turning: in each stroke the wrist turns with the part, then lets go, rises a little and turns back.
 * Pure and the same for every host, so first and third person turn the same hand the same way.
 */
export const twistStroke = (share: number, options: TwistOptions = {}): TwistStroke => {
  const strokes = Math.max(1, Math.round(options.strokes ?? 3))
  const reach = options.reach ?? 1.6
  const along = Math.min(1, Math.max(0, share)) * strokes
  const index = Math.min(strokes - 1, Math.floor(along))
  const phase = along - index
  if (phase <= TURNING) {
    const k = smooth(phase / TURNING)
    return { angle: reach * (k - 0.5), turned: reach * (index + k), grip: 1, lift: 0 }
  }
  const k = (phase - TURNING) / (1 - TURNING)
  return { angle: reach * (0.5 - smooth(k)), turned: reach * (index + 1), grip: 0.35, lift: Math.sin(k * Math.PI) }
}
