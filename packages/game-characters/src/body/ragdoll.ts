import type { Quat, Vec3 } from '@adatechnology/game-contracts'
import type { RagdollDesc, RagdollJoint, RagdollPart, Vec3 as WorldVec3 } from '@adatechnology/game-physics'

import type { BodySpec } from './body-spec'
import { describeBody } from './describe'
import type { Rig } from './rig'
import { SEGMENT_TREE } from './segment-tree'
import type { SegmentNode } from './segment-tree'

export type RagdollOfRigParams = {
  readonly rig: Rig
  readonly body: BodySpec
  readonly build: number
  /** Where the standing body is made (its feet at `at`), world space. */
  readonly at?: WorldVec3
  /** Tag of every body: `user * 32 + segment index` for the ragdoll, `user` for the chain. */
  readonly user?: number
}

type JointLimit = { readonly cone: number; readonly plane: number; readonly twist: number } | { readonly hingeMin: number; readonly hingeMax: number }

/** Cone and twist per joint kind (radians): hinge for knee and elbow, swing-twist elsewhere. */
export const RAGDOLL_LIMITS: Readonly<Record<string, JointLimit>> = {
  spine: { cone: 0.35, plane: 0.35, twist: 0.3 },
  neck: { cone: 0.5, plane: 0.5, twist: 0.6 },
  head: { cone: 0.3, plane: 0.3, twist: 0.3 },
  jaw: { hingeMin: 0, hingeMax: 0.3 },
  shoulder: { cone: 1.4, plane: 1.4, twist: 0.8 },
  elbow: { hingeMin: -2.5, hingeMax: 0 },
  wrist: { cone: 0.7, plane: 0.7, twist: 0.4 },
  hip: { cone: 1.2, plane: 1.0, twist: 0.5 },
  knee: { hingeMin: 0, hingeMax: 2.4 },
  ankle: { cone: 0.5, plane: 0.5, twist: 0.3 },
}

const FOOT_AND_HAND_KINDS: ReadonlySet<string> = new Set(['foot', 'hand'])
const USER_STRIDE = 32
const FALLBACK_BODY_RADIUS = 0.05
const MINIMUM_CAPSULE_HALF_HEIGHT = 0.01

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

const normalize = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

/** Quaternion of an Euler XYZ rotation (radians). */
const quaternionOfEuler = (x: number, y: number, z: number): Quat => {
  const cosX = Math.cos(x / 2)
  const sinX = Math.sin(x / 2)
  const cosY = Math.cos(y / 2)
  const sinY = Math.sin(y / 2)
  const cosZ = Math.cos(z / 2)
  const sinZ = Math.sin(z / 2)
  return [
    sinX * cosY * cosZ + cosX * sinY * sinZ,
    cosX * sinY * cosZ - sinX * cosY * sinZ,
    cosX * cosY * sinZ + sinX * sinY * cosZ,
    cosX * cosY * cosZ - sinX * sinY * sinZ,
  ]
}

const shiftBy = (point: WorldVec3, offset: WorldVec3): Vec3 => [point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]]

/** The joint of `node` to its parent, in world space, made in the standing pose. */
const jointOf = (node: SegmentNode, rig: Rig, at: WorldVec3): RagdollJoint => {
  const joint = rig.joints[node.joint]
  const child = SEGMENT_TREE.find((candidate) => candidate.parent === node.id)
  const end = child ? rig.joints[child.joint] : ([joint[0], joint[1] - 0.1, joint[2]] as Vec3)
  // the head turns about the neck's line, not toward the jaw
  const along = node.id === 'head' ? ([0, 1, 0] as Vec3) : normalize(subtract(end, joint))
  // the plane axis must be square to the twist axis (Jolt builds the joint frame from both)
  const seed: Vec3 = Math.abs(along[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]
  const projection = seed[0] * along[0] + seed[1] * along[1] + seed[2] * along[2]
  const plane = normalize([seed[0] - projection * along[0], seed[1] - projection * along[1], seed[2] - projection * along[2]])
  const point = shiftBy(joint, at)
  const limit = RAGDOLL_LIMITS[node.joint.replace(/[LR]$/, '')] ?? RAGDOLL_LIMITS.spine
  if (limit && 'hingeMin' in limit) return { kind: 'hinge', point, axis: [1, 0, 0], normal: plane, min: limit.hingeMin, max: limit.hingeMax, friction: 2 }
  const swing = limit && 'cone' in limit ? limit : { cone: 0.35, plane: 0.35, twist: 0.3 }
  return { kind: 'swingTwist', point, twistAxis: along, planeAxis: plane, normalHalfCone: swing.cone, planeHalfCone: swing.plane, twistMin: -swing.twist, twistMax: swing.twist, friction: 2 }
}

/**
 * The 17-segment body as one engine ragdoll (R0 of spec 008): capsules and spheres with the masses of `describeBody`, made standing at `at`,
 * each part on a hinge or swing-twist joint to its parent. Parts come in the tree's order, parents first. Use it with `stabilize` and the
 * kit's ragdoll solver passes.
 */
export const ragdollOfRig = ({ rig, body, build, at = [0, 0, 0], user = 0 }: RagdollOfRigParams): RagdollDesc => {
  const spec = describeBody({ rig, body, build })
  const indexOf = new Map<string, number>(SEGMENT_TREE.map((node, index) => [node.id, index]))
  const parts = SEGMENT_TREE.map((node, index): RagdollPart => {
    const part = spec.parts.find((candidate) => candidate.id === node.id)
    if (!part) throw new Error(`describeBody has no part for ${node.id}`)
    const rotation = part.rotation ?? [0, 0, 0]
    const shape = part.shape
    const radius = shape.kind === 'sphere' || shape.kind === 'cylinder' ? shape.radius : FALLBACK_BODY_RADIUS
    const halfHeight = shape.kind === 'cylinder' ? Math.max(MINIMUM_CAPSULE_HALF_HEIGHT, shape.height / 2 - radius) : 0
    const bodyDesc: RagdollPart['body'] = {
      shape: halfHeight > MINIMUM_CAPSULE_HALF_HEIGHT ? { kind: 'capsule', halfHeight, radius } : { kind: 'sphere', radius },
      position: shiftBy(part.position ?? [0, 0, 0], at),
      rotation: quaternionOfEuler(rotation[0], rotation[1], rotation[2]),
      mass: part.mass,
      layer: 'character',
      angularDamping: 0.3,
      linearDamping: 0.05,
      continuous: FOOT_AND_HAND_KINDS.has(node.kind),
      material: { frictionStatic: 0.8, frictionDynamic: 0.6, restitution: 0.05 },
      user: user * USER_STRIDE + index,
    }
    if (!node.parent) return { body: bodyDesc, parent: -1 }
    return { body: bodyDesc, parent: indexOf.get(node.parent) ?? 0, joint: jointOf(node, rig, at) }
  })
  return { parts }
}
