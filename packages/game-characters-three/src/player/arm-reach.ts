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
  /** In a view, the most the chest follows the aim up or down (radians from level), turning about the eye so the shoulders keep their place under it, as a shooter's cheek stays on the stock. */
  chestFollow: 1.2,
  /** The most a shoulder blade slides toward a far hand (protraction and elevation together). */
  protraction: 0.11,
  /** A hand is within reach below this fraction of the arm's length. */
  slack: 0.96,
  /** Where the elbow points: down and out from the body, a little back (body space, x outward). */
  elbowPole: [0.55, -1, -0.25] as const,
  /** From the wrist joint to the middle of the palm, metres of the body. */
  palm: 0.042,
  /** In a view the elbow keeps at least this interior bend where a hand is out of reach, right then left (the first-person arms' numbers). */
  viewBend: [1.35, 0.95] as const,
  /** In a view a hand stays this far before a surface, metres. */
  contactMargin: 0.005,
  /** In a view a hand is never nearer than this to the eye, metres. */
  contactNearest: 0.12,
  /** How far in front of the eye a surface is looked for, metres. */
  contactProbe: 1.4,
  /** How far a hand reaches forward of its middle at least (the thickness of the palm), and per metre of fingers pointing ahead. */
  contactPalm: 0.03,
  /** From the middle of the palm to the fingertips. */
  contactFingers: 0.085,
} as const

type Side = 'R' | 'L'
type ReachArm = { readonly g: THREE_NS.Object3D; readonly el: THREE_NS.Object3D; readonly hand: THREE_NS.Object3D; readonly outward: 1 | -1 }

/**
 * The eye the hands are seen from, given per call to `apply` (null or none is the body seen from outside: nothing changes). `reachBend` keeps the elbow bent where a hand is out of reach, the hand stopping
 * short instead of the arm locking; `keepOutside` pulls a hand back so it stays in front of the surface `contact` finds along the camera's forward.
 */
export type ReachView = {
  readonly camera: THREE_NS.Object3D
  /** The least interior bend of the elbow, radians, right then left. Default `ARM_REACH.viewBend`. */
  readonly reachBend?: readonly [number, number]
  readonly keepOutside?: {
    /** The distance to the surface from `origin` along `direction` within `maxDistance`, or null. */
    contact(origin: [number, number, number], direction: [number, number, number], maxDistance: number): number | null
    /** Default `ARM_REACH.contactMargin`. */
    readonly margin?: number
    /** Default `ARM_REACH.contactNearest`. */
    readonly nearest?: number
  }
}

export type ArmReach = {
  /** Brings the hands to `targets` (world space) over the pose the body already has; null leaves the arms as the pose put them. A `view` keeps the elbows bent and the hands out of walls. */
  apply(targets: HandTargets | null, view?: ReachView | null): void
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
    chest: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
    arms: { R: { position: new THREE.Vector3(), g: new THREE.Quaternion(), el: new THREE.Quaternion(), hand: new THREE.Quaternion() }, L: { position: new THREE.Vector3(), g: new THREE.Quaternion(), el: new THREE.Quaternion(), hand: new THREE.Quaternion() } },
  }
  let applied = false
  const bone = createTwoBone(THREE)
  const v = { shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), palm: new THREE.Vector3(), target: new THREE.Vector3(), pole: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }
  const q = { hand: new THREE.Quaternion(), parent: new THREE.Quaternion(), body: new THREE.Quaternion(), local: new THREE.Quaternion(), swing: new THREE.Quaternion(), twist: new THREE.Quaternion(), rest: new THREE.Quaternion() }
  const basis = new THREE.Matrix4()
  const camera = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), inverse: new THREE.Quaternion(), probe: new THREE.Vector3(), forward: new THREE.Vector3(), fingers: new THREE.Vector3(), hand: new THREE.Quaternion() }
  let bendLimit: readonly [number, number] | null = null
  const yAxis = new THREE.Vector3(0, 1, 0)

  const lengthsOf = (arm: ReachArm): { upper: number; fore: number; palm: number } => {
    const scale = arm.g.getWorldScale(v.a).y
    return { upper: arm.el.position.length() * scale, fore: arm.hand.position.length() * scale, palm: ARM_REACH.palm * scale }
  }

  /** The wrist-to-shoulder distance past which the chest and the shoulder blade move: the arm nearly straight, or with the elbow at the view's bend (law of cosines). */
  const limitOf = (side: Side, upperLength: number, fore: number): number => {
    if (!bendLimit) return (upperLength + fore) * ARM_REACH.slack
    return Math.sqrt(upperLength * upperLength + fore * fore + 2 * upperLength * fore * Math.cos(bendLimit[side === 'R' ? 0 : 1]))
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
    const excess = arms.L.g.getWorldPosition(v.shoulder).distanceTo(v.wrist) - limitOf('L', up, fore)
    if (excess <= 0) return
    // the support shoulder is at +x of the chest, the front is +z: a turn of -a about y brings it forward
    const chestRadius = Math.hypot(arms.L.g.position.x, arms.L.g.position.z) * arms.L.g.getWorldScale(v.a).y
    upper.rotation.y -= Math.min(ARM_REACH.chestTurn, excess / Math.max(0.05, chestRadius))
    upper.updateMatrixWorld(true)
  }

  /**
   * Turns the chest about the eye by the aim's pitch: a tool held before the eye rises and falls with the view, and the shoulders come with it instead of staying where a level aim
   * had them (aimed high, the hands fell short of a forend 90 cm from the shoulder).
   */
  const followView = (eye: THREE_NS.Vector3, look: THREE_NS.Quaternion): void => {
    const forward = v.a.set(0, 0, -1).applyQuaternion(look)
    const pitch = Math.max(-ARM_REACH.chestFollow, Math.min(ARM_REACH.chestFollow, Math.asin(Math.max(-1, Math.min(1, forward.y)))))
    if (Math.abs(pitch) < 1e-4) return
    const right = v.b.set(1, 0, 0).applyQuaternion(look)
    right.y = 0
    if (right.lengthSq() < 1e-8) return
    q.swing.setFromAxisAngle(right.normalize(), pitch)
    const parent = upper.parent!
    upper.getWorldPosition(v.c).sub(eye).applyQuaternion(q.swing).add(eye)
    upper.getWorldQuaternion(q.local).premultiply(q.swing)
    parent.updateWorldMatrix(true, false)
    upper.position.copy(parent.worldToLocal(v.c))
    upper.quaternion.copy(q.local.premultiply(parent.getWorldQuaternion(q.parent).invert()))
    upper.updateMatrixWorld(true)
  }

  /** Slides the shoulder blade toward a hand still out of reach. */
  const protract = (arm: ReachArm, limit: number): void => {
    const excess = arm.g.getWorldPosition(v.shoulder).distanceTo(v.wrist) - limit
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
    protract(arm, limitOf(side, up, fore))
    arm.g.getWorldPosition(v.shoulder)
    // the elbow points down and out of the body, whichever way the body faces
    upper.getWorldQuaternion(q.body)
    v.pole.set(ARM_REACH.elbowPole[0] * arm.outward, ARM_REACH.elbowPole[1], ARM_REACH.elbowPole[2]).applyQuaternion(q.body)
    // the elbow keeps a little bend: shorten the line to the wrist rather than lock it
    const lockLimit = Math.sqrt(up * up + fore * fore + 2 * up * fore * Math.cos(ARM_REACH.elbowMin))
    const most = bendLimit ? Math.min(lockLimit, limitOf(side, up, fore)) : lockLimit
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

  /** Pulls a hand back, along the camera's forward, to the surface in front of it minus what the hand reaches forward and a margin; never nearer than `nearest` to the eye. */
  const keepOutside = (pose: HandPose, outside: NonNullable<ReachView['keepOutside']>): HandPose => {
    // the hand in the camera's space: x right, y up, the view looks down -z
    const place = v.a.set(...pose.position).sub(camera.position).applyQuaternion(camera.inverse)
    camera.probe.set(place.x, place.y, 0).applyQuaternion(camera.quaternion).add(camera.position)
    camera.forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    const distance = outside.contact([camera.probe.x, camera.probe.y, camera.probe.z], [camera.forward.x, camera.forward.y, camera.forward.z], ARM_REACH.contactProbe)
    if (distance === null) return pose
    camera.hand.set(...pose.quaternion).premultiply(camera.inverse)
    const ahead = Math.max(ARM_REACH.contactPalm, -camera.fingers.set(1, 0, 0).applyQuaternion(camera.hand).z * ARM_REACH.contactFingers)
    const limit = Math.max(outside.nearest ?? ARM_REACH.contactNearest, distance - ahead - (outside.margin ?? ARM_REACH.contactMargin))
    if (-place.z <= limit) return pose
    place.z = -limit
    place.applyQuaternion(camera.quaternion).add(camera.position)
    return { ...pose, position: [place.x, place.y, place.z] }
  }

  const save = (): void => {
    saved.twist = upper.rotation.y
    saved.chest.position.copy(upper.position)
    saved.chest.quaternion.copy(upper.quaternion)
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
    apply(targets, view) {
      if (!targets || (!targets.R && !targets.L)) return
      save()
      applied = true
      upper.updateWorldMatrix(true, true)
      let { R, L } = targets
      bendLimit = view ? (view.reachBend ?? ARM_REACH.viewBend) : null
      if (view) {
        view.camera.updateWorldMatrix(true, false)
        view.camera.matrixWorld.decompose(camera.position, camera.quaternion, v.a)
        camera.inverse.copy(camera.quaternion).invert()
        // seen from the eye the tool follows the aim: aimed high or low the chest turns with it about the eye, as a shooter's does
        followView(camera.position, camera.quaternion)
      }
      if (view?.keepOutside) {
        if (R) R = keepOutside(R, view.keepOutside)
        if (L) L = keepOutside(L, view.keepOutside)
      }
      if (L && R) turnChest(L)
      if (R) reach('R', R)
      if (L) reach('L', L)
      bendLimit = null
    },
    restore() {
      if (!applied) return
      applied = false
      upper.position.copy(saved.chest.position)
      upper.quaternion.copy(saved.chest.quaternion)
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
