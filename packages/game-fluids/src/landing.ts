import type { StreamState, Vec3 } from './types'
import { dot, sub } from './math'
import type { Basis } from './stains'

export const GROUND_ID = 'ground'
/** Longest flight simulated for a stream before it counts as landing nowhere. */
export const MAX_FLIGHT = 3

/** Position of a ballistic jet `t` seconds after leaving its origin. */
export const ballistic = (origin: Vec3, velocity: Vec3, gravity: number, t: number): Vec3 => [
  origin[0] + velocity[0] * t,
  origin[1] + velocity[1] * t - 0.5 * gravity * t * t,
  origin[2] + velocity[2] * t,
]

/** Point of a stream's path `t` seconds after its origin (use with `StreamState.flightTime` and the world's `gravity`). */
export const sampleStream = (stream: Pick<StreamState, 'origin' | 'velocity'>, gravity: number, t: number): Vec3 =>
  ballistic(stream.origin, stream.velocity, gravity, t)

export interface LandingSurface extends Basis {
  id: string
  point: Vec3
  half: [number, number]
}

export interface Hit {
  t: number
  point: Vec3
  normal: Vec3
  surface: string
  /** Velocity of the jet at impact. */
  velocity: Vec3
}

const velocityAt = (velocity: Vec3, gravity: number, t: number): Vec3 => [velocity[0], velocity[1] - gravity * t, velocity[2]]

/** First thing a jet hits: an authored surface (plane with half extents) or else the ground. */
export const trace = (
  surfaces: Iterable<LandingSurface>,
  groundAt: (x: number, z: number) => number,
  origin: Vec3,
  velocity: Vec3,
  gravity: number,
): Hit | null => {
  let best: Hit | null = null
  for (const s of surfaces) {
    const n = s.normal
    const c = dot(n, sub(origin, s.point))
    if (c < -0.005) continue
    const a = -0.5 * gravity * n[1]
    const b = dot(n, velocity)
    let t = Infinity
    if (Math.abs(a) < 1e-9) {
      if (b < -1e-9) t = -c / b
    } else {
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const sq = Math.sqrt(disc)
        for (const root of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
          if (root >= -1e-6 && b + 2 * a * root < 0 && root < t) t = root
        }
      }
    }
    if (!Number.isFinite(t) || t > MAX_FLIGHT) continue
    t = Math.max(0, t)
    if (best && t >= best.t) continue
    const p = ballistic(origin, velocity, gravity, t)
    const rel = sub(p, s.point)
    if (Math.abs(dot(rel, s.t1)) > s.half[0] || Math.abs(dot(rel, s.t2)) > s.half[1]) continue
    best = { t, point: p, normal: n, surface: s.id, velocity: velocityAt(velocity, gravity, t) }
  }

  // Ground: march the path and refine the crossing.
  const step = 0.02
  let prevT = 0
  const startOver = origin[1] - groundAt(origin[0], origin[2])
  const limit = best ? best.t : MAX_FLIGHT
  if (startOver <= 0) {
    return best && best.t <= 0 ? best : { t: 0, point: [origin[0], groundAt(origin[0], origin[2]), origin[2]], normal: [0, 1, 0], surface: GROUND_ID, velocity }
  }
  for (let t = step; t <= limit + step; t += step) {
    const tt = Math.min(t, limit)
    const p = ballistic(origin, velocity, gravity, tt)
    const over = p[1] - groundAt(p[0], p[2])
    if (over <= 0) {
      let lo = prevT
      let hi = tt
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        const q = ballistic(origin, velocity, gravity, mid)
        if (q[1] - groundAt(q[0], q[2]) > 0) lo = mid
        else hi = mid
      }
      if (best && hi >= best.t - 1e-3) return best
      const q = ballistic(origin, velocity, gravity, hi)
      return { t: hi, point: [q[0], groundAt(q[0], q[2]), q[2]], normal: [0, 1, 0], surface: GROUND_ID, velocity: velocityAt(velocity, gravity, hi) }
    }
    prevT = tt
    if (tt >= limit) break
  }
  return best
}
