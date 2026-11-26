import type { RagdollDesc, RagdollJoint, RagdollPart, Vec3 } from '@adatechnology/game-physics'

import { anatomyOf } from './anatomy'
import type { Bone, Point } from './anatomy'
import { USER_STRIDE, bodyOfBone, massOfBone, shiftBy } from './bone-body'
import type { QuadrupedSpec } from './types'

export type RagdollOfAnimalParams = {
  readonly body: QuadrupedSpec
  /** Where the animal stands (its feet at `at`), world space. */
  readonly at?: Vec3
  /** Tag of every body: `user * 32 + part index` for the ragdoll, `user` for the chain. */
  readonly user?: number
}

export type SwingLimit = { readonly sagittal: number; readonly lateral: number; readonly twist: number }
type HingeLimit = { readonly min: number; readonly max: number }

/**
 * Limits per joint (radians). The sagittal swing is about the animal's x axis (nodding, the leg forward and back), the lateral one about the other axis
 * of the plane of symmetry. The knee and the hock are hinges that bend the foot backward (+), like the page's legs.
 */
export const ANIMAL_RAGDOLL_LIMITS = {
  neck: { sagittal: 0.6, lateral: 0.5, twist: 0.3 },
  head: { sagittal: 0.6, lateral: 0.5, twist: 0.4 },
  shoulder: { sagittal: 0.9, lateral: 0.45, twist: 0.25 },
  hip: { sagittal: 0.9, lateral: 0.4, twist: 0.25 },
  carpus: { min: -0.1, max: 2.0 },
  hock: { min: -0.6, max: 1.8 },
} as const satisfies Record<string, SwingLimit | HingeLimit>

const JOINT_FRICTION = 2

const normalize = (x: number, y: number, z: number): Vec3 => {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

/** The axis a bone points along, and the axis square to it in the plane of symmetry. */
const axesOf = (bone: Bone): { twist: Vec3; plane: Vec3 } => {
  const twist = normalize(bone.end[0] - bone.start[0], bone.end[1] - bone.start[1], bone.end[2] - bone.start[2])
  return { twist, plane: normalize(0, -twist[2], twist[1]) }
}

const swingJoint = (point: Point, bone: Bone, limit: SwingLimit, at: Vec3): RagdollJoint => {
  const { twist, plane } = axesOf(bone)
  return { kind: 'swingTwist', point: shiftBy(point, at), twistAxis: twist, planeAxis: plane, normalHalfCone: limit.sagittal, planeHalfCone: limit.lateral, twistMin: -limit.twist, twistMax: limit.twist, friction: JOINT_FRICTION }
}

const hingeJoint = (point: Point, limit: HingeLimit, at: Vec3): RagdollJoint => ({ kind: 'hinge', point: shiftBy(point, at), axis: [1, 0, 0], normal: [0, 0, 1], min: limit.min, max: limit.max, friction: JOINT_FRICTION })

/**
 * The quadruped as one engine ragdoll (R0 of spec 008): trunk, neck, head, and an upper and a lower bone for each of the four legs, 11 parts on swing-twist
 * and hinge joints, made standing at `at` from the species' rest pose. Parts come parents first. Use it with `stabilize` and the kit's ragdoll solver passes.
 */
export const ragdollOfAnimal = ({ body, at = [0, 0, 0], user = 0 }: RagdollOfAnimalParams): RagdollDesc => {
  const anatomy = anatomyOf(body)
  const bones: { bone: Bone; parent: number; joint?: RagdollJoint }[] = [
    { bone: anatomy.trunk, parent: -1 },
    { bone: anatomy.neck, parent: 0, joint: swingJoint(anatomy.neck.start, anatomy.neck, ANIMAL_RAGDOLL_LIMITS.neck, at) },
    { bone: anatomy.head, parent: 1, joint: swingJoint(anatomy.head.start, anatomy.head, ANIMAL_RAGDOLL_LIMITS.head, at) },
  ]
  for (const leg of anatomy.legs) {
    const upperIndex = bones.length
    bones.push({ bone: leg.upper, parent: 0, joint: swingJoint(leg.upper.start, leg.upper, leg.isFront ? ANIMAL_RAGDOLL_LIMITS.shoulder : ANIMAL_RAGDOLL_LIMITS.hip, at) })
    bones.push({ bone: leg.lower, parent: upperIndex, joint: hingeJoint(leg.lower.start, leg.isFront ? ANIMAL_RAGDOLL_LIMITS.carpus : ANIMAL_RAGDOLL_LIMITS.hock, at) })
  }
  const parts = bones.map(({ bone, parent, joint }, index): RagdollPart => {
    const desc = bodyOfBone(bone, massOfBone(bone), at, user * USER_STRIDE + index)
    return joint ? { body: desc, parent, joint } : { body: desc, parent }
  })
  return { parts }
}
