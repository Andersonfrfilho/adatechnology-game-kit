/**
 * The left hand on the top of a held item while a seal is turned open: palm down on the part, the fingers round it, the wrist turned by the stroke about the item's
 * axis and lifted with the part as it comes off. The same pose for the first-person arms and the body.
 */
import type * as THREE_NS from 'three'
import { TWIST_LIFT } from '@adatechnology/game-contracts'
import type { HandTargets, TwistStroke } from '@adatechnology/game-contracts'

/** How far the palm sits off the part of a carried item it holds (m). */
const CARRY_PALM = 0.012
/** Metres a screw cap rises off its thread at the end of an opening use, which the hand on it follows. */
const CAP_RISE = 0.03

export type TwistHold = {
  readonly root: THREE_NS.Object3D
  /** The turn of the hand that grips the item. */
  readonly gripQ: THREE_NS.Quaternion
  /** The middle and the unrotated size of the item's box, in its own space. */
  readonly local: THREE_NS.Vector3
  readonly size: THREE_NS.Vector3
  readonly twisting: { readonly stroke: TwistStroke; readonly lift: number } | null
}

export const twistTargets = (THREE: typeof THREE_NS, hold: TwistHold): HandTargets | null => {
  if (!hold.twisting) return null
  const { root, gripQ } = hold
  const { stroke, lift } = hold.twisting
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion)
  const top = hold.local
    .clone()
    .applyQuaternion(root.quaternion)
    .add(root.position)
    .addScaledVector(up, hold.size.y * 0.5 + lift * CAP_RISE + stroke.lift * TWIST_LIFT + CARRY_PALM)
  // the fingers point to the right and away from the body (the forearm comes in from the left, not in front of the item), then the wrist turns with the stroke (a cap comes off turning to the left seen from above)
  const knuckles = new THREE.Vector3(0.85, 0, -0.5).normalize().applyQuaternion(gripQ)
  knuckles.addScaledVector(up, -knuckles.dot(up)).normalize().applyAxisAngle(up, stroke.angle)
  const side = new THREE.Vector3().crossVectors(knuckles, up).normalize()
  // the palm sits over the middle of the part, so the middle of the hand is a little back toward the wrist
  const palm = top.addScaledVector(knuckles, -0.025)
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(knuckles, up, side))
  return { L: { position: [palm.x, palm.y, palm.z], quaternion: [q.x, q.y, q.z, q.w] }, gripL: 0.35 + 0.5 * stroke.grip }
}
