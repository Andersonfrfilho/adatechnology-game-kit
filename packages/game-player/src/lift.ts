/**
 * Whether one person lifts a thing off the floor with the hands, from its mass and its size (the mass comes from the material of the SDK: density times volume, or
 * the real mass of the catalogue). The strength is the most a person lifts held against the body; a bulky thing is held away from it, and the back takes the load
 * times its lever (the horizontal multiplier of the NIOSH lifting equation: what is held at `H` metres from the spine is `closeReach / H` of what is held against
 * it). The thing is held the easiest way: its thinnest side away from the body, the hands around the middle one. A sofa (45 kg, 2 x 0.9 x 0.85 m) is held at
 * 0.58 m and weighs more than the 26 kg a person lifts that far out: it is pushed or dragged, not picked up. A gas bottle (16 kg, 0.36 m across) goes up.
 * Engine-agnostic: the host passes the mass and the box of the thing.
 */

export interface LiftRules {
  /** The most a person lifts held against the body, kg. */
  readonly maxKg: number
  /** Distance (m) from the spine to a load held against the body: NIOSH's 25 cm, where the lever costs nothing. */
  readonly closeReach: number
  /** Distance (m) from the spine to the near face of what is held: the front of the trunk. */
  readonly bodyDepth: number
  /** The widest a person holds between the hands around a thing, metres: the arms hugging it. */
  readonly maxSpan: number
}

export const LIFT_DEFAULTS: LiftRules = { maxKg: 60, closeReach: 0.25, bodyDepth: 0.15, maxSpan: 1.3 }

/** `ok` it goes up; `too_heavy` heavier than the strength even against the body; `too_bulky` too wide for the arms or too far out for its weight. */
export type LiftVerdict = 'ok' | 'too_heavy' | 'too_bulky'

export interface LiftCheck {
  readonly verdict: LiftVerdict
  /** The most this thing could weigh and still go up, held its easiest way, kg. */
  readonly liftableKg: number
}

/** Whether a thing of `massKg` and `size` (metres, any order; without it, a thing held against the body) goes up in one person's hands. */
export function liftCheckFor(thing: { readonly massKg: number; readonly size?: readonly number[] }, rules: Partial<LiftRules> = {}): LiftCheck {
  const r = { ...LIFT_DEFAULTS, ...rules }
  const [, middle = 0, thinnest = 0] = [...(thing.size ?? [])].sort((a, b) => b - a)
  const reach = r.bodyDepth + Math.max(0, thinnest) / 2
  const liftableKg = r.maxKg * Math.min(1, r.closeReach / Math.max(reach, 1e-6))
  if (thing.massKg > r.maxKg) return { verdict: 'too_heavy', liftableKg }
  if (middle > r.maxSpan || thing.massKg > liftableKg) return { verdict: 'too_bulky', liftableKg }
  return { verdict: 'ok', liftableKg }
}
