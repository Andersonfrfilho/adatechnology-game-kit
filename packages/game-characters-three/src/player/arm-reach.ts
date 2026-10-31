import type { HandPose, HandTargets } from '@adatechnology/game-contracts'

import { createTwoBone, solveTwoBone } from '../first-person/ik'
import type { RichRig } from '../rich/animator'
import type { Three, THREE_NS } from '../three'

/**
 * Limits of the human arm the reach respects, radians and metres. A hand farther than the arm stretches turns the chest (the support shoulder forward, as a shooter blades the body to a long
 * gun) and then protracts the shoulder blade, before the elbow is allowed to lock.
 */
export const ARM_REACH = {
  /** The elbow never straightens past this bend (a locked elbow reads as a stick). */
  elbowMin: 0.12,
  /** Full flexion of the elbow. */
  elbowMax: 2.5,
  /** The wrist bends (flexion, extension, deviation) up to this angle from the line of the forearm (flexion reaches about 80 degrees). */
  wristBend: 1.3,
  /** The forearm turns (pronation and supination) up to this angle about its own axis. */
  wristTwist: 1.6,
  /** The most the chest turns to bring the support shoulder toward a far hand. */
  chestTurn: 0.6,
  /** The most a shoulder blade slides toward a far hand (protraction and elevation together). */
  protraction: 0.11,
  /** A hand is within reach below this fraction of the arm's length. */
  slack: 0.96,
  /** Where the elbow points: down and out from the body, a little back (body space, x outward). */
  elbowPole: [0.55, -1, -0.25] as const,
  /** From the wrist joint to the middle of the palm, metres of the body. */
  palm: 0.042,
} as const

type Side = 'R' | 'L'
type ReachArm = { readonly g: THREE_NS.Object3D; readonly el: THREE_NS.Object3D; readonly hand: THREE_NS.Object3D; readonly outward: 1 | -1 }

export type ArmReach = {
  /** Brings the hands to `targets` (world space) over the pose the body already has; null leaves the arms as the pose put them. */
  apply(targets: HandTargets | null): void
  /** Puts back what the last `apply` changed, so the pose and its smoothing see only their own numbers next frame. */
  restore(): void
}

/**
 * Three-joint reach of the rich body: shoulder (ball), elbow (hinge) and wrist (bend and twist), each kept inside its human range. The hand frame is the one of `HandPose`
 * (game-contracts): x from the wrist to the knuckles, y the back of the hand, z the little-finger side of a right hand; the left hand is the mirror image.
 */
export const createArmReach = (THREE: Three, rig: RichRig, hands: Readonly<Record<Side, THREE_NS.Object3D>>): ArmReach => {
  // rig.arms[1] is the weapon hand (the puppet's right, at -x), rig.arms[0] the support hand (+x)
  const arms: Record<Side, ReachArm> = {
    R: { g: rig.arms[1]!.g as unknown as THREE_NS.Object3D, el: rig.arms[1]!.el as unknown as THREE_NS.Object3D, hand: hands.R, outward: -1 },
    L: { g: rig.arms[0]!.g as unknown as THREE_NS.Object3D, el: rig.arms[0]!.el as unknown as THREE_NS.Object3D, hand: hands.L, outward: 1 },
  }
  const upper = rig.upper as unknown as THREE_NS.Object3D
  // hand-local axes of `HandPose` in the hand group's space: the fingers hang along -y, the palm faces the body (+x for the right hand, -x for the left), the thumb is in front (+z)
  const handBasis = {
    R: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1))).invert(),
    L: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1))).invert(),
  }
  const saved = {
    twist: 0,
    arms: { R: { position: new THREE.Vector3(), g: new THREE.Quaternion(), el: new THREE.Quaternion(), hand: new THREE.Quaternion() }, L: { position: new THREE.Vector3(), g: new THREE.Quaternion(), el: new THREE.Quaternion(), hand: new THREE.Quaternion() } },
  }
  let applied = false
  const bone = createTwoBone(THREE)
  const v = { shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), palm: new THREE.Vector3(), target: new THREE.Vector3(), pole: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }
  const q = { hand: new THREE.Quaternion(), parent: new THREE.Quaternion(), body: new THREE.Quaternion(), local: new THREE.Quaternion(), swing: new THREE.Quaternion(), twist: new THREE.Quaternion(), rest: new THREE.Quaternion() }
  const basis = new THREE.Matrix4()
  const yAxis = new THREE.Vector3(0, 1, 0)

  const lengthsOf = (arm: ReachArm): { upper: number; fore: number; palm: number } => {
    const scale = arm.g.getWorldScale(v.a).y
    return { upper: arm.el.position.length() * scale, fore: arm.hand.position.length() * scale, palm: ARM_REACH.palm * scale }
  }

  /** The wrist joint and the world orientation of the hand group for a hand pose. */
  const wristOf = (side: Side, pose: HandPose, palm: number): void => {
    q.hand.set(...pose.quaternion).multiply(handBasis[side])
    v.palm.set(...pose.position)
    v.wrist.copy(v.palm).addScaledVector(v.a.set(0, -1, 0).applyQuaternion(q.hand), -palm)
  }

  /** Turns the chest so the support shoulder comes toward a hand it cannot reach. */
  const turnChest = (pose: HandPose): void => {
    const { upper: up, fore, palm } = lengthsOf(arms.L)
    wristOf('L', pose, palm)
    const excess = arms.L.g.getWorldPosition(v.shoulder).distanceTo(v.wrist) - (up + fore) * ARM_REACH.slack
    if (excess <= 0) return
    // the support shoulder is at +x of the chest, the front is +z: a turn of -a about y brings it forward
    const chestRadius = Math.hypot(arms.L.g.position.x, arms.L.g.position.z) * arms.L.g.getWorldScale(v.a).y
    upper.rotation.y -= Math.min(ARM_REACH.chestTurn, excess / Math.max(0.05, chestRadius))
    upper.updateMatrixWorld(true)
  }

  /** Slides the shoulder blade toward a hand still out of reach. */
  const protract = (arm: ReachArm, length: number): void => {
    const excess = arm.g.getWorldPosition(v.shoulder).distanceTo(v.wrist) - length * ARM_REACH.slack
    if (excess <= 0) return
    const parent = arm.g.parent!
    v.b.copy(v.wrist).sub(v.shoulder).normalize().multiplyScalar(Math.min(excess, ARM_REACH.protraction)).add(v.shoulder)
    arm.g.position.copy(parent.worldToLocal(v.b))
    arm.g.updateMatrixWorld(true)
  }

  /** Keeps the hand group inside the wrist's range: the bend off the forearm line and the turn about it. */
  const limitWrist = (local: THREE_NS.Quaternion): THREE_NS.Quaternion => {
    // swing-twist about the forearm axis (y): the twist is the forearm turning, the swing the wrist bending
    const projection = v.c.set(local.x, local.y, local.z).projectOnVector(yAxis)
    q.twist.set(projection.x, projection.y, projection.z, local.w).normalize()
    const twistAngle = 2 * Math.atan2(q.twist.y, q.twist.w)
    const swing = q.swing.copy(local).multiply(q.twist.invert())
    const swingAngle = 2 * Math.acos(Math.min(1, Math.abs(swing.w)))
    if (swingAngle > ARM_REACH.wristBend) swing.slerp(q.rest.identity(), 1 - ARM_REACH.wristBend / swingAngle)
    const clampedTwist = Math.max(-ARM_REACH.wristTwist, Math.min(ARM_REACH.wristTwist, Math.atan2(Math.sin(twistAngle), Math.cos(twistAngle))))
    return local.copy(swing).multiply(q.twist.setFromAxisAngle(yAxis, clampedTwist))
  }

  const reach = (side: Side, pose: HandPose): void => {
    const arm = arms[side]
    const { upper: up, fore, palm } = lengthsOf(arm)
    wristOf(side, pose, palm)
    protract(arm, up + fore)
    arm.g.getWorldPosition(v.shoulder)
    // the elbow points down and out of the body, whichever way the body faces
    upper.getWorldQuaternion(q.body)
    v.pole.set(ARM_REACH.elbowPole[0] * arm.outward, ARM_REACH.elbowPole[1], ARM_REACH.elbowPole[2]).applyQuaternion(q.body)
    // the elbow keeps a little bend: shorten the line to the wrist rather than lock it
    const most = Math.sqrt(up * up + fore * fore + 2 * up * fore * Math.cos(ARM_REACH.elbowMin))
    const least = Math.sqrt(up * up + fore * fore + 2 * up * fore * Math.cos(ARM_REACH.elbowMax))
    const line = v.c.copy(v.wrist).sub(v.shoulder)
    const distance = Math.min(most, Math.max(least, line.length()))
    v.target.copy(v.shoulder).addScaledVector(line.normalize(), distance)
    solveTwoBone(v.shoulder, v.target, up, fore, v.pole, bone)
    // upper arm: local -y runs to the elbow, local +z is the side the forearm folds toward (the elbow bends about local x, negative forward)
    const along = v.a.copy(bone.joint).sub(v.shoulder).normalize()
    const forearm = v.b.copy(bone.end).sub(bone.joint).normalize()
    const fold = v.c.copy(forearm).addScaledVector(along, -forearm.dot(along))
    if (fold.lengthSq() < 1e-8) fold.copy(v.pole).addScaledVector(along, -v.pole.dot(along)).negate()
    fold.normalize()
    const yWorld = v.elbow.copy(along).negate()
    basis.makeBasis(v.pole.crossVectors(yWorld, fold), yWorld, fold)
    arm.g.parent!.getWorldQuaternion(q.parent)
    arm.g.quaternion.setFromRotationMatrix(basis).premultiply(q.parent.invert())
    arm.el.rotation.set(-Math.acos(Math.max(-1, Math.min(1, along.dot(forearm)))), 0, 0)
    arm.g.updateMatrixWorld(true)
    // the wrist sits a little off the forearm's line: turn the whole arm about the shoulder so it lands on the target, the elbow keeping its bend
    const reached = arm.hand.getWorldPosition(v.a).sub(v.shoulder).normalize()
    q.swing.setFromUnitVectors(reached, v.b.copy(v.target).sub(v.shoulder).normalize())
    arm.g.parent!.getWorldQuaternion(q.parent)
    arm.g.quaternion.premultiply(q.parent).premultiply(q.swing).premultiply(q.parent.invert())
    arm.g.updateMatrixWorld(true)
    // wrist: the hand group turns to the grip, inside the wrist's range
    arm.el.getWorldQuaternion(q.parent)
    arm.hand.quaternion.copy(limitWrist(q.local.copy(q.parent.invert()).multiply(q.hand)))
  }

  const save = (): void => {
    saved.twist = upper.rotation.y
    for (const side of ['R', 'L'] as const) {
      const arm = arms[side]
      const into = saved.arms[side]
      into.position.copy(arm.g.position)
      into.g.copy(arm.g.quaternion)
      into.el.copy(arm.el.quaternion)
      into.hand.copy(arm.hand.quaternion)
    }
  }

  return {
    apply(targets) {
      if (!targets || (!targets.R && !targets.L)) return
      save()
      applied = true
      upper.updateWorldMatrix(true, true)
      if (targets.L && targets.R) turnChest(targets.L)
      if (targets.R) reach('R', targets.R)
      if (targets.L) reach('L', targets.L)
    },
    restore() {
      if (!applied) return
      applied = false
      upper.rotation.y = saved.twist
      for (const side of ['R', 'L'] as const) {
        const arm = arms[side]
        const from = saved.arms[side]
        arm.g.position.copy(from.position)
        arm.g.quaternion.copy(from.g)
        arm.el.quaternion.copy(from.el)
        arm.hand.quaternion.copy(from.hand)
      }
    },
  }
}
