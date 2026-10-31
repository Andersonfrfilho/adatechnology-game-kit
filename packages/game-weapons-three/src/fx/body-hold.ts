import type * as THREE_NS from 'three'
import type { HandPose, HandTargets } from '@adatechnology/game-contracts'

import type { HandAnchor } from './hand-hold'

/**
 * Where a body holds a tool in a view that shows the body (third person), in the frame the host lends (`ModuleHost.holdFrame`: the pocket of the right shoulder, -z the aim, x right, y up).
 * Metres of a grown body; the tool is drawn at its real size.
 */
export const BODY_HOLD = {
  /** A shouldered gun's bore runs this far above the shoulder pocket (the cheek on the comb). */
  boreAbove: 0.05,
  /** A handgun's grip: toward the middle of the chest, a little low, at the reach of bent arms. */
  handgunGrip: [-0.15, -0.04, -0.42],
  /** A one-hand tool's grip: low in front of the body, the elbow bent. */
  toolGrip: [0.02, -0.34, -0.3],
  /** A tool at least this long, held by two hands, is shouldered (its stock in the pocket). */
  shoulderedFrom: 0.55,
  /** The farthest a shouldered gun's grip sits ahead of the pocket; a launcher whose grip is farther slides back, its tube behind the shoulder. */
  shoulderGripMax: 0.42,
  /** Where such a grip is brought to, ahead of the pocket. */
  shoulderGripTo: 0.34,
  /** The farthest apart two hands hold a long gun (a support hand past it slides back along the gun, toward the grip). */
  supportSpan: 0.5,
  /** How much of the aim's pitch a tool held low in one hand follows. */
  toolPitch: 0.5,
} as const

export type BodyHoldPlacement = {
  readonly THREE: typeof THREE_NS
  /** The group the viewmodel moves (its `holder` child carries the model). */
  readonly hand: THREE_NS.Object3D
  readonly holder: THREE_NS.Object3D
  readonly frame: HandPose
  /** The rear end of the model along its barrel (model x), metres. */
  readonly rear: number
  readonly lengthMetres: number
  readonly handgun: boolean
  readonly right: HandAnchor | null
  readonly left: HandAnchor | null
}

const scratch = { a: null as THREE_NS.Vector3 | null, b: null as THREE_NS.Vector3 | null, euler: null as THREE_NS.Euler | null }

/** Puts the tool on the body at its real size: a long two-hand gun with its stock in the shoulder pocket, anything else with its grip where a hand holds it ready. */
export const placeOnBody = (placement: BodyHoldPlacement): void => {
  const { THREE, hand, holder, frame } = placement
  scratch.a ??= new THREE.Vector3()
  scratch.b ??= new THREE.Vector3()
  holder.scale.setScalar(1)
  hand.position.set(...frame.position)
  hand.quaternion.set(...frame.quaternion)
  const shouldered = !placement.handgun && placement.left !== null && placement.lengthMetres >= BODY_HOLD.shoulderedFrom
  if (shouldered) {
    // the model's barrel (x) runs down the aim (-z) by the holder's quarter turn: the rear end at the pocket
    holder.position.set(0, BODY_HOLD.boreAbove, placement.rear)
    hand.updateMatrixWorld(true)
    if (!placement.right) return
    const grip = hand.worldToLocal(placement.right.part.localToWorld(scratch.a.copy(placement.right.offset)))
    if (-grip.z <= BODY_HOLD.shoulderGripMax) return
    holder.position.z += -grip.z - BODY_HOLD.shoulderGripTo
    hand.updateMatrixWorld(true)
    return
  }
  // a tool held low in one hand follows the aim's pitch only partly, so a look down does not fold the wrist into the shoulder
  scratch.euler ??= new THREE.Euler()
  const turn = scratch.euler.setFromQuaternion(hand.quaternion, 'YXZ')
  hand.quaternion.setFromEuler(turn.set(turn.x * BODY_HOLD.toolPitch, turn.y, 0, 'YXZ'))
  holder.position.set(0, 0, 0)
  hand.updateMatrixWorld(true)
  if (!placement.right) return
  const grip = placement.handgun ? BODY_HOLD.handgunGrip : BODY_HOLD.toolGrip
  const want = scratch.a.set(grip[0], grip[1], grip[2]).applyQuaternion(hand.quaternion).add(hand.position)
  const now = placement.right.part.localToWorld(scratch.b.copy(placement.right.offset))
  hand.position.add(want.sub(now))
  hand.updateMatrixWorld(true)
}

/** A support hand too far from the grip for two arms (a long rifle's forend) slides back along the gun toward the grip, to `supportSpan`. */
export const limitSupportSpan = (targets: HandTargets): HandTargets => {
  const right = targets.R?.position
  const left = targets.L?.position
  if (!right || !left || !targets.L) return targets
  const span = Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
  if (span <= BODY_HOLD.supportSpan) return targets
  const k = BODY_HOLD.supportSpan / span
  const position: [number, number, number] = [right[0] + (left[0] - right[0]) * k, right[1] + (left[1] - right[1]) * k, right[2] + (left[2] - right[2]) * k]
  return { ...targets, L: { ...targets.L, position } }
}
