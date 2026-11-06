import type * as THREE_NS from 'three'
import type { HandPose, HandTargets } from '@adatechnology/game-contracts'

import type { HandAnchor } from './hand-hold'

/**
 * Where a body holds a tool in a view that shows the body (third person), in the frame the host lends (`ModuleHost.holdFrame`: the pocket of the right shoulder, -z the aim, x right, y up).
 * Metres of a grown body; the tool is drawn at its real size.
 */
export const BODY_HOLD = {
  /** With no body to lend the frame: the pocket of the right shoulder from the eye, in the eye's yaw frame (right, up, back). */
  eyeToPocket: [0.2, -0.275, 0.17],
  /** A shouldered gun's bore runs this far above the shoulder pocket (the cheek on the comb). */
  boreAbove: 0.05,
  /** A handgun's (or a short two-hand gun's) grip: toward the middle of the chest, a little low, at the reach of bent arms. */
  handgunGrip: [-0.15, -0.04, -0.42],
  /** A one-hand tool's grip: low in front of the body, the elbow bent. */
  toolGrip: [0.02, -0.34, -0.3],
  /** A gun in each hand: each grip ahead of its own shoulder, a little in and low, the arms out at the aim (the left one is the mirror, in the left shoulder's frame). */
  dualGrip: [0, -0.06, -0.44],
  /** A tool at least this long, held by two hands, is shouldered (its stock in the pocket). */
  shoulderedFrom: 0.55,
  /** The farthest a shouldered gun's grip sits ahead of the pocket; a launcher whose grip is farther slides back, its tube behind the shoulder. */
  shoulderGripMax: 0.42,
  /** The nearest a shouldered gun's grip sits ahead of the pocket; a gun with no stock (a pistol grip at its rear) slides forward, its grip not behind the eye. */
  shoulderGripMin: 0.25,
  /** Where such a grip is brought to, ahead of the pocket. */
  shoulderGripTo: 0.34,
  /** The farthest apart two hands hold a long gun (a support hand past it slides back along the gun, toward the grip). */
  supportSpan: 0.5,
  /** A gun carried at the hip (`carry: 'hip'`): its rear grip low at the right hip, a little ahead of it. */
  hipGrip: [0.25, -0.5, -0.24],
  /**
   * A tool put away against the body to free its hand (a magazine changed with a tool in each hand): tucked in the front of the belt on its own side, muzzle down and grip forward, its
   * grip here in the frame of the shoulder pocket (the left one mirrored).
   */
  stowGrip: [-0.07, -0.5, -0.17],
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
  /** Carried at the hip (`ModelParts.carry`): the rear grip at `BODY_HOLD.hipGrip`, following the aim's pitch partly. */
  readonly hip?: boolean
  /** Where the held grip goes in the frame, instead of the one of its kind (a gun in each hand: `dualGrip`). */
  readonly grip?: readonly [number, number, number]
  /** The tool in the left hand, in the frame of the left shoulder: the grip is at the mirror of the right hand's (`right` is then the anchor the left hand holds). */
  readonly mirror?: boolean
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
  if (placement.hip) return placeAtHip(placement)
  const shouldered = !placement.handgun && placement.left !== null && placement.lengthMetres >= BODY_HOLD.shoulderedFrom
  if (shouldered) {
    // the model's barrel (x) runs down the aim (-z) by the holder's quarter turn: the rear end at the pocket
    holder.position.set(0, BODY_HOLD.boreAbove, placement.rear)
    hand.updateMatrixWorld(true)
    if (!placement.right) return
    const grip = hand.worldToLocal(placement.right.part.localToWorld(scratch.a.copy(placement.right.offset)))
    if (-grip.z <= BODY_HOLD.shoulderGripMax && -grip.z >= BODY_HOLD.shoulderGripMin) return
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
  // a short gun with a support hand is held like a handgun, in the middle of the chest, not low like a one-hand tool
  const grip = placement.grip ?? (placement.handgun || placement.left ? BODY_HOLD.handgunGrip : BODY_HOLD.toolGrip)
  const want = scratch.a.set(placement.mirror ? -grip[0] : grip[0], grip[1], grip[2]).applyQuaternion(hand.quaternion).add(hand.position)
  const now = placement.right.part.localToWorld(scratch.b.copy(placement.right.offset))
  hand.position.add(want.sub(now))
  hand.updateMatrixWorld(true)
}

/** A gun carried at the hip: level-ish ahead (the aim's pitch partly), its rear grip at `BODY_HOLD.hipGrip`. */
const placeAtHip = (placement: BodyHoldPlacement): void => {
  const { THREE, hand, holder } = placement
  scratch.a ??= new THREE.Vector3()
  scratch.b ??= new THREE.Vector3()
  scratch.euler ??= new THREE.Euler()
  const turn = scratch.euler.setFromQuaternion(hand.quaternion, 'YXZ')
  hand.quaternion.setFromEuler(turn.set(turn.x * BODY_HOLD.toolPitch, turn.y, 0, 'YXZ'))
  holder.position.set(0, 0, 0)
  hand.updateMatrixWorld(true)
  if (!placement.right) return
  const want = scratch.a.set(...BODY_HOLD.hipGrip).applyQuaternion(hand.quaternion).add(hand.position)
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

/** With no body to lend `holdFrame`: the pocket of a body's right shoulder under the camera's eye (`BODY_HOLD.eyeToPocket`, turned by the camera's yaw), the frame turned to the camera's aim. */
export const createEyeFrame = (THREE: typeof THREE_NS, camera: THREE_NS.Camera, side: 'R' | 'L' = 'R'): (() => HandPose) => {
  const frame: { position: [number, number, number]; quaternion: [number, number, number, number] } = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }
  const turn = new THREE.Euler(0, 0, 0, 'YXZ')
  const pocket = new THREE.Vector3()
  return () => {
    turn.setFromQuaternion(camera.quaternion, 'YXZ')
    pocket.set(side === 'L' ? -BODY_HOLD.eyeToPocket[0] : BODY_HOLD.eyeToPocket[0], BODY_HOLD.eyeToPocket[1], BODY_HOLD.eyeToPocket[2]).applyEuler(turn.set(0, turn.y, 0)).add(camera.position)
    frame.position = [pocket.x, pocket.y, pocket.z]
    frame.quaternion = [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w]
    return frame
  }
}

const stowScratch = { euler: null as THREE_NS.Euler | null, yaw: null as THREE_NS.Quaternion | null, turn: null as THREE_NS.Quaternion | null, a: null as THREE_NS.Vector3 | null, b: null as THREE_NS.Vector3 | null }

/** Puts a tool away against the body (`BODY_HOLD.stowGrip`): turned with the body (its yaw only), muzzle down, the grip where the hand left it. `mirror` for the left side. */
export const placeStowed = (placement: { readonly THREE: typeof THREE_NS; readonly hand: THREE_NS.Object3D; readonly holder: THREE_NS.Object3D; readonly frame: HandPose; readonly anchor: HandAnchor | null; readonly mirror?: boolean }): void => {
  const { THREE, hand, holder, frame, anchor } = placement
  stowScratch.euler ??= new THREE.Euler()
  stowScratch.yaw ??= new THREE.Quaternion()
  stowScratch.turn ??= new THREE.Quaternion()
  stowScratch.a ??= new THREE.Vector3()
  stowScratch.b ??= new THREE.Vector3()
  const yaw = stowScratch.euler.setFromQuaternion(stowScratch.yaw.set(...frame.quaternion), 'YXZ').y
  hand.position.set(...frame.position)
  // the holder turns the barrel down the aim (-z); a quarter turn about x points it down, a half turn about the vertical puts the grip forward
  hand.quaternion.setFromEuler(stowScratch.euler.set(0, yaw, 0, 'YXZ'))
  hand.quaternion.multiply(stowScratch.turn.setFromAxisAngle(stowScratch.a.set(0, 1, 0), Math.PI))
  hand.quaternion.multiply(stowScratch.turn.setFromAxisAngle(stowScratch.a.set(1, 0, 0), -Math.PI / 2))
  holder.position.set(0, 0, 0)
  hand.updateMatrixWorld(true)
  if (!anchor) return
  const grip = BODY_HOLD.stowGrip
  const want = stowScratch.a.set(placement.mirror ? -grip[0] : grip[0], grip[1], grip[2]).applyEuler(stowScratch.euler.set(0, yaw, 0, 'YXZ')).add(hand.position)
  const now = anchor.part.localToWorld(stowScratch.b.copy(anchor.offset))
  hand.position.add(want.sub(now))
  hand.updateMatrixWorld(true)
}
