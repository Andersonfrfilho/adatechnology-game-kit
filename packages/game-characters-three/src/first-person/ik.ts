import type { THREE_NS } from '../three'

export type TwoBone = {
  /** The middle joint (elbow, knee). */
  joint: THREE_NS.Vector3
  /** The end of the second bone: the target when it is within reach, else the point on the way to it at full stretch. */
  end: THREE_NS.Vector3
  /** The target was out of reach and `end` is short of it. */
  clamped: boolean
  /** Scratch vectors the solver works in. */
  line: THREE_NS.Vector3
  side: THREE_NS.Vector3
}

/**
 * Two-bone analytic IK. The first bone (`upper`) starts at `root`, the second (`lower`) ends at `end`; the middle joint bends toward `pole` (a direction, not a point: the part of it
 * across the root-to-target line decides which way the elbow goes). A target nearer than the bones can fold, or farther than they can stretch, is clamped to the nearest reachable point on
 * the same line. All vectors are in one space; `out` (made by `createTwoBone`) is filled and returned, so a frame allocates nothing.
 */
export const solveTwoBone = (root: THREE_NS.Vector3, target: THREE_NS.Vector3, upper: number, lower: number, pole: THREE_NS.Vector3, out: TwoBone): TwoBone => {
  const line = out.line.copy(target).sub(root)
  let distance = line.length()
  if (distance < 1e-6) line.set(0, 0, -1)
  else line.divideScalar(distance)
  const min = Math.abs(upper - lower) + 1e-4
  const max = upper + lower - 1e-4
  out.clamped = distance > max || distance < min
  distance = Math.min(max, Math.max(min, distance))
  // along the line: the foot of the perpendicular from the joint; across: its height
  const along = (distance * distance + upper * upper - lower * lower) / (2 * distance)
  const across = Math.sqrt(Math.max(0, upper * upper - along * along))
  const side = out.side.copy(pole)
  side.addScaledVector(line, -side.dot(line))
  if (side.lengthSq() < 1e-8) side.set(0, 1, 0).addScaledVector(line, -line.y)
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
  side.normalize()
  out.joint.copy(root).addScaledVector(line, along).addScaledVector(side, across)
  out.end.copy(root).addScaledVector(line, distance)
  return out
}

export const createTwoBone = (THREE: typeof THREE_NS): TwoBone => ({ joint: new THREE.Vector3(), end: new THREE.Vector3(), clamped: false, line: new THREE.Vector3(), side: new THREE.Vector3() })
