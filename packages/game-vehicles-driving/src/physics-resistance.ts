import type { Vec3 } from '@adatechnology/game-physics'

import type { SemiSimSpec } from './semi/types'

const GRAVITY = 9.81
/** Under this speed (m/s) the rolling resistance fades out instead of flipping the direction of the velocity. */
const ROLLING_FADE_SPEED = 0.5

/**
 * The impulse (N s) the air and the tyres take from a vehicle moving at `velocity` (its horizontal part) over one step `dt`, for the body's centre of mass: `-drag |v| v dt` for the air
 * (the spec's drag is `0.5 rho Cd A`) and `-rolling m g dt` along the velocity for the tyres. Apply it every fixed step in the `actors` phase; the wheels' own
 * contact does not know either.
 */
export const resistanceImpulse = (spec: Pick<SemiSimSpec, 'drag' | 'rolling' | 'mass'>, velocity: Vec3, dt: number): Vec3 => {
  const speed = Math.hypot(velocity[0], velocity[2])
  if (speed === 0) return [0, 0, 0]
  const rolling = spec.rolling * spec.mass * GRAVITY * Math.min(1, speed / ROLLING_FADE_SPEED)
  const along = -(spec.drag * speed * speed + rolling) * dt
  return [(velocity[0] / speed) * along, 0, (velocity[2] / speed) * along]
}
