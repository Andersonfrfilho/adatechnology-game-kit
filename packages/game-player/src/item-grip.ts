/**
 * How a hand closes on a thing it picks up (decision of the owner, 2026-11-25: the hand on the thing's real grip, the fingers closed around it, the thing in the palm, aligned with
 * the hand in both views). Engine-agnostic: the thing is its box (`size`, metres, in its own frame), the hand frame is the one of `HandTargets`: +x along the fingers, +y the back
 * of the hand, the thumb at -z for a right hand and +z for a left one. The thing's longest side runs through the fist along the thumb (a bottle stands up in a hand held thumb up),
 * its thinnest side across the palm (the palm lies on its broad face), and its middle sits a palm's thickness plus half that side under the middle of the palm.
 */
import type { BodyHand } from './hands'
import { composePose, poseHolding, quaternionOfBasis } from './hand-math'
import type { Pose, Vec3Tuple } from './hand-math'

export const ITEM_GRIP = {
  /** Half the thickness of a palm (m): what lies between the middle of the palm and the thing. */
  palm: 0.011,
  /** The closure of the fingers (0 open, 1 a fist) on a thing this thick (m) or thinner. */
  fistAt: 0.03,
  closed: 0.95,
  /** How much the closure opens per metre the thing is thicker than `fistAt`, and the most it opens to. */
  openPerMetre: 4,
  open: 0.35,
  /** The fingers before they close on it, as the hand comes to the thing. */
  reaching: 0.15,
} as const

export interface ItemGrip {
  /** The thing's middle and turn in the frame of the hand. */
  readonly local: Pose
  /** How closed the fingers are on it (`HandTargets.grip`). */
  readonly grip: number
}

const AXES: readonly Vec3Tuple[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

const cross = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const scaled = (v: Vec3Tuple, k: number): Vec3Tuple => [v[0] * k, v[1] * k, v[2] * k]

/** The grip of a hand on a thing of box `size` (its own frame, metres). */
export function gripOfItem(size: readonly number[], hand: BodyHand): ItemGrip {
  const sides = [0, 1, 2].map((axis) => ({ axis, length: Math.max(0, size[axis] ?? 0) })).sort((a, b) => b.length - a.length)
  const [long, mid, thin] = sides as [(typeof sides)[0], (typeof sides)[0], (typeof sides)[0]]
  const thumb: Vec3Tuple = hand === 'R' ? [0, 0, -1] : [0, 0, 1]
  // where each of the thing's own axes goes in the hand: the long one along the thumb, the thin one across the palm, the last one keeps the frame right-handed
  const columns: Vec3Tuple[] = [AXES[0] as Vec3Tuple, AXES[1] as Vec3Tuple, AXES[2] as Vec3Tuple]
  columns[long.axis] = thumb
  columns[thin.axis] = [0, 1, 0]
  const next = (axis: number): number => (axis + 1) % 3
  // x × y = z for the thing's frame: the column after `mid` crossed with the one after that names it
  const before = columns[next(next(mid.axis))] as Vec3Tuple
  const after = columns[next(mid.axis)] as Vec3Tuple
  columns[mid.axis] = cross(after, before)
  const quaternion = quaternionOfBasis(columns[0] as Vec3Tuple, columns[1] as Vec3Tuple, columns[2] as Vec3Tuple)
  const depth = ITEM_GRIP.palm + thin.length / 2
  const across = (mid.length + thin.length) / 2
  const grip = Math.max(ITEM_GRIP.open, Math.min(ITEM_GRIP.closed, ITEM_GRIP.closed - ITEM_GRIP.openPerMetre * Math.max(0, across - ITEM_GRIP.fistAt)))
  return { local: { position: scaled([0, -1, 0], depth), quaternion }, grip }
}

/** Where the thing is with the hand at `hand` holding it by `grip`. */
export function itemPoseInHand(hand: Pose, grip: ItemGrip): Pose {
  return composePose(hand, grip.local)
}

/** Where the hand goes to take the thing where it lies (`item`, its middle and turn) by `grip`. */
export function handPoseOnItem(item: Pose, grip: ItemGrip): Pose {
  return poseHolding(item, grip.local)
}
