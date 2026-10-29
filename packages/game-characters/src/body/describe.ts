import type { DestructibleSpec, JointSpec, PartShape, PartSpec, SegmentKind, Vec3 } from '@adatechnology/game-contracts'

import type { BodySpec } from './body-spec'
import type { Rig } from './rig'
import { SEGMENT_TREE } from './segment-tree'
import type { SegmentNode } from './segment-tree'

/** The material id the parts of a body carry (a destruction world without it skips its own material rules: the body is a `DestructibleImpl`). */
export const BODY_MATERIAL = 'flesh'

/** Share of the body mass per segment kind (sums to 1 over the 17 segments). */
const MASS_SHARE: Readonly<Record<SegmentKind, number>> = {
  head: 0.07,
  jaw: 0.01,
  neck: 0.02,
  torso: 0.34,
  pelvis: 0.14,
  upperArm: 0.028,
  forearm: 0.016,
  hand: 0.006,
  thigh: 0.1,
  shin: 0.045,
  foot: 0.015,
}
const ADULT_MASS_KG = 70
const LEAF_KINDS: ReadonlySet<SegmentKind> = new Set(['head', 'jaw', 'hand', 'foot'])

const firstChild = (node: SegmentNode): SegmentNode | undefined => SEGMENT_TREE.find((candidate) => candidate.parent === node.id)

/** A cylinder from `from` to `to`: centred between them, its local +Y turned onto the segment (Euler XYZ). */
const cylinderBetween = (from: Vec3, to: Vec3, radius: number): { shape: PartShape; position: Vec3; rotation: Vec3 } => {
  const axis: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const length = Math.max(1e-3, Math.hypot(axis[0], axis[1], axis[2]))
  const [x, y, z] = [axis[0] / length, axis[1] / length, axis[2] / length]
  return {
    shape: { kind: 'cylinder', radius, height: length },
    position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    rotation: [Math.atan2(z, y), 0, -Math.asin(Math.max(-1, Math.min(1, x)))],
  }
}

const partOf = (node: SegmentNode, rig: Rig, body: BodySpec, massKg: number): PartSpec => {
  const joint = rig.joints[node.joint]
  const radius = body.segmentRadius[node.kind] * (rig.height / body.heightMetres)
  const mass = massKg * MASS_SHARE[node.kind]
  const child = firstChild(node)
  if (LEAF_KINDS.has(node.kind) || !child) {
    const lift = node.kind === 'head' ? radius : node.kind === 'jaw' ? 0 : -radius
    return { id: node.id, material: BODY_MATERIAL, shape: { kind: 'sphere', radius }, position: [joint[0], joint[1] + lift, joint[2]], mass, tags: ['body', node.kind] }
  }
  const placed = cylinderBetween(joint, rig.joints[child.joint], radius)
  return { id: node.id, material: BODY_MATERIAL, ...placed, mass, tags: ['body', node.kind] }
}

export type DescribeBodyParams = { readonly rig: Rig; readonly body: BodySpec; readonly build: number; readonly name?: string }

/** The body as destruction parts (one per segment, in the body's local space) and the joints between them. */
export const describeBody = ({ rig, body, build, name }: DescribeBodyParams): DestructibleSpec => {
  const massKg = ADULT_MASS_KG * (rig.height / body.heightMetres) ** 3 * build
  const parts = SEGMENT_TREE.map((node) => partOf(node, rig, body, massKg))
  const joints: JointSpec[] = SEGMENT_TREE.filter((node) => node.parent).map((node) => ({ id: `${node.parent}~${node.id}`, a: node.parent as string, b: node.id, kind: 'fused', tools: [] }))
  return { ...(name ? { name } : {}), parts, joints, tags: ['character'] }
}
