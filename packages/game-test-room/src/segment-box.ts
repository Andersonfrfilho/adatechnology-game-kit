import type { Vec3 } from '@adatechnology/game-destruction'

/** Whether the segment `from` to `to` touches the axis-aligned box `min` to `max` (slab test): the check of "a body crossed the wire". */
export const segmentTouchesBox = (from: Vec3, to: Vec3, min: Vec3, max: Vec3): boolean => {
  let near = 0
  let far = 1
  for (let axis = 0; axis < 3; axis++) {
    const start = from[axis] as number
    const delta = (to[axis] as number) - start
    const low = min[axis] as number
    const high = max[axis] as number
    if (Math.abs(delta) < 1e-12) {
      if (start < low || start > high) return false
      continue
    }
    const entering = (low - start) / delta
    const leaving = (high - start) / delta
    near = Math.max(near, Math.min(entering, leaving))
    far = Math.min(far, Math.max(entering, leaving))
    if (near > far) return false
  }
  return true
}
