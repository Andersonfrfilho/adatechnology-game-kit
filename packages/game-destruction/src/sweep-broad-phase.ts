import { aabbOf, rotateVec, quat } from './math'
import type { Quat, Vec3 } from './types'

/**
 * Metres the bounds of a sweep's broad phase grow by. The broad phase only drops what no ray of the sweep can reach, so a margin far above rounding
 * (1 mm against errors of 1e-12 m) can only let more through to the ray tests, never less: the hit stays the one the brute force finds.
 */
export const SWEEP_BROAD_SLACK = 1e-3

/** An axis-aligned box. */
export interface SweepBounds {
  readonly min: Vec3
  readonly max: Vec3
}

/** Bounds of every ray of a sweep (each origin to `length` metres along `direction`), grown by `SWEEP_BROAD_SLACK`; null when not finite (no broad phase). */
export const sweptBounds = (origins: readonly Vec3[], direction: Vec3, length: number): SweepBounds | null => {
  if (origins.length === 0 || !Number.isFinite(length)) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const origin of origins) {
    for (let k = 0; k < 3; k++) {
      const end = origin[k] + direction[k] * length
      min[k] = Math.min(min[k], origin[k], end)
      max[k] = Math.max(max[k], origin[k], end)
    }
  }
  for (let k = 0; k < 3; k++) {
    if (!Number.isFinite(min[k]) || !Number.isFinite(max[k])) return null
    min[k] -= SWEEP_BROAD_SLACK
    max[k] += SWEEP_BROAD_SLACK
  }
  return { min, max }
}

/** The sphere at `centre` of `radius` reaches into the box. */
export const sphereTouchesBounds = (bounds: SweepBounds, centre: Vec3, radius: number): boolean => {
  let distanceSquared = 0
  for (let k = 0; k < 3; k++) {
    const below = bounds.min[k] - centre[k]
    const above = centre[k] - bounds.max[k]
    if (below > 0) distanceSquared += below * below
    else if (above > 0) distanceSquared += above * above
  }
  return distanceSquared <= radius * radius
}

/** The two boxes overlap. */
export const boundsTouch = (a: SweepBounds, b: SweepBounds): boolean =>
  a.min[0] <= b.max[0] && a.max[0] >= b.min[0] && a.min[1] <= b.max[1] && a.max[1] >= b.min[1] && a.min[2] <= b.max[2] && a.max[2] >= b.min[2]

/** Bounds, in the frame of a body at `position` turned by `rotation`, of a world box: every point of the box is inside them. */
export const boundsInFrame = (bounds: SweepBounds, position: Vec3, rotation: Quat): SweepBounds => {
  const inverse = quat.conjugate(rotation)
  const centre: Vec3 = [(bounds.min[0] + bounds.max[0]) / 2 - position[0], (bounds.min[1] + bounds.max[1]) / 2 - position[1], (bounds.min[2] + bounds.max[2]) / 2 - position[2]]
  const size: Vec3 = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
  return aabbOf({ kind: 'box', size }, rotateVec(inverse, centre), inverse)
}

/** The ray from `origin` along `direction`, up to `maxDistance` metres (may be infinite), never enters the box. */
export const rayMissesBounds = (origin: Vec3, direction: Vec3, maxDistance: number, bounds: SweepBounds): boolean => {
  let near = 0
  let far = maxDistance
  for (let k = 0; k < 3; k++) {
    if (direction[k] === 0) {
      if (origin[k] < bounds.min[k] || origin[k] > bounds.max[k]) return true
      continue
    }
    const a = (bounds.min[k] - origin[k]) / direction[k]
    const b = (bounds.max[k] - origin[k]) / direction[k]
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return true
  }
  return false
}
