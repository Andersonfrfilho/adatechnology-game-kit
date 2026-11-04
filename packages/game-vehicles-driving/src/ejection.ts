/**
 * Who leaves the car in a crash. An occupant without a belt keeps the speed the car had (inertia) while the car stops: in a frontal crash past
 * about 30 km/h of change in speed the body goes through the windshield, in a hard side impact or a rollover through the side window on the side it
 * is thrown to. A belted occupant stays in (a belt holds a person to the seat up to crashes far harder than a road car survives). The glass breaks
 * first; the body flies with most of the car's speed before the crash and a little lift. Pure numbers, every threshold an option.
 */
export type EjectionExit = 'windshield' | 'left_window' | 'right_window' | 'rear_window'

export interface EjectionOptions {
  /** Change of speed, m/s, past which an unbelted occupant goes through the windshield (about 30 km/h). */
  frontal: number
  /** Sideways change of speed, m/s, past which an unbelted occupant goes out of a side window. */
  side: number
  /** Share of the speed before the crash the body keeps on the way out (the glass and the dash take the rest). */
  keep: number
  /** Upward speed of the body leaving, m/s (it rides up over the dash). */
  lift: number
}

export const DEFAULT_EJECTION: EjectionOptions = { frontal: 8.3, side: 6, keep: 0.8, lift: 2.5 }

export interface CrashPulse {
  /** Body-frame speed before and after the crash, m/s: forward and to the right. */
  readonly before: { readonly u: number; readonly w: number }
  readonly after: { readonly u: number; readonly w: number }
  /** The car rolled over in it. */
  readonly rolled?: boolean
}

export interface Ejection {
  readonly exit: EjectionExit
  /** Body-frame velocity of the body leaving, m/s: forward, to the right, up. */
  readonly velocity: readonly [number, number, number]
  /** Change of speed of the crash, m/s (what the injuries scale with). */
  readonly deltaV: number
}

/** The ejection of one occupant, or null when the occupant stays in. */
export function ejectionOf(pulse: CrashPulse, belted: boolean, options: EjectionOptions = DEFAULT_EJECTION): Ejection | null {
  if (belted) return null
  const du = pulse.after.u - pulse.before.u
  const dw = pulse.after.w - pulse.before.w
  const deltaV = Math.hypot(du, dw)
  // the body moves against the car's change of speed: a car stopped from forward throws it forward
  const frontal = Math.abs(du) >= Math.abs(dw)
  if (frontal && Math.abs(du) < options.frontal && !pulse.rolled) return null
  if (!frontal && Math.abs(dw) < options.side && !pulse.rolled) return null
  const exit: EjectionExit = frontal ? (du < 0 ? 'windshield' : 'rear_window') : dw < 0 ? 'right_window' : 'left_window'
  return { exit, velocity: [pulse.before.u * options.keep, pulse.before.w * options.keep, options.lift], deltaV }
}
