import { TEAM_GAME } from '@adatechnology/game-characters'
import type { BodySpec, JointId } from '@adatechnology/game-characters'

import type { Three, THREE_NS } from '../three'

type Vec3 = readonly [number, number, number]

/**
 * The joints the instanced body hangs from, by the game's names. `E` is the side with the negative x (bones 2, 4, 7 and 9), `D` the positive one
 * (bones 3, 5, 8 and 10); the shader's `side` depends on it, so the sides are told apart by the sign of x, whatever a spec calls them.
 */
export type BodyJoints = {
  readonly hip: Vec3
  readonly neck: Vec3
  readonly shoulderE: Vec3
  readonly shoulderD: Vec3
  readonly elbowE: Vec3
  readonly elbowD: Vec3
  readonly thighE: Vec3
  readonly thighD: Vec3
  readonly kneeE: Vec3
  readonly kneeD: Vec3
}

const negativeFirst = (first: Vec3, second: Vec3): readonly [Vec3, Vec3] => (first[0] <= second[0] ? [first, second] : [second, first])

export const jointsOf = (body: BodySpec): BodyJoints => {
  const at = (id: JointId): Vec3 => body.joints[id]
  const [shoulderE, shoulderD] = negativeFirst(at('shoulderL'), at('shoulderR'))
  const [elbowE, elbowD] = negativeFirst(at('elbowL'), at('elbowR'))
  const [thighE, thighD] = negativeFirst(at('hipL'), at('hipR'))
  const [kneeE, kneeD] = negativeFirst(at('kneeL'), at('kneeR'))
  return { hip: at('hip'), neck: at('neck'), shoulderE, shoulderD, elbowE, elbowD, thighE, thighD, kneeE, kneeD }
}

/** The lengths the game's body was drawn with: a spec's segments scale them (1 for the game's own joints). */
const GAME_UPPER_ARM = 0.31
const GAME_THIGH = 0.42

/** The ratio, or exactly 1 when the spec has the game's own length (so the game's numbers are not touched by rounding noise). */
const scaleOf = (length: number, gameLength: number): number => (Math.abs(length - gameLength) < 1e-9 ? 1 : length / gameLength)

/** The drop from one joint to the next: the limbs hang straight down, so only the height counts. */
const distance = (from: Vec3, to: Vec3): number => Math.abs(from[1] - to[1])

type Geometry = THREE_NS.BufferGeometry

/** Bone, material and pivots per vertex: the attributes the shader animates by (G 65341 `tagGeo`). */
const tagGeometry = (geometry: Geometry, bone: number, pivot: Vec3, material: number, parent: Vec3 = [0, 0, 0], three: Three): Geometry => {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const count = source.attributes.position!.count
  source.setAttribute('bone', new three.Float32BufferAttribute(new Float32Array(count).fill(bone), 1))
  const colors = new Float32Array(count * 4)
  for (let index = 0; index < count; index++) colors[index * 4 + 3] = material
  source.setAttribute('vcol', new three.Float32BufferAttribute(colors, 4))
  const pivots = new Float32Array(count * 3)
  const parents = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    pivots.set(pivot, index * 3)
    parents.set(parent, index * 3)
  }
  source.setAttribute('pivot', new three.Float32BufferAttribute(pivots, 3))
  source.setAttribute('ppivot', new three.Float32BufferAttribute(parents, 3))
  source.deleteAttribute('uv')
  return source
}

const MERGED_ATTRIBUTES: readonly (readonly [string, number])[] = [['position', 3], ['normal', 3], ['bone', 1], ['vcol', 4], ['pivot', 3], ['ppivot', 3]]

/** The parts as one geometry (G 65354 `mergeBody`). */
const mergeBody = (list: readonly Geometry[], three: Three): Geometry => {
  const total = list.reduce((sum, geometry) => sum + geometry.attributes.position!.count, 0)
  const merged = new three.BufferGeometry()
  for (const [name, size] of MERGED_ATTRIBUTES) {
    const array = new Float32Array(total * size)
    let offset = 0
    for (const geometry of list) {
      const part = geometry.attributes[name]!.array as Float32Array
      array.set(part, offset)
      offset += part.length
    }
    merged.setAttribute(name, new three.BufferAttribute(array, size))
  }
  merged.computeBoundingSphere()
  return merged
}

export type BuildInstancedBodyParams = {
  /** Radial segments of the torso: 16, 10 or 5 for the three levels of detail. */
  readonly segments: number
  /** Proportions (default `TEAM_GAME`, the joints the game's body was drawn with). */
  readonly body?: BodySpec
}

/**
 * The crowd body as one merged geometry, torso, head, hair, jaw, eyes, arms and legs tagged with the bone, pivot and material the shader reads
 * (G 65367 `buildBody`). The joints come from the spec, so a different `body` moves the limbs; the parts' own sizes follow the segment lengths.
 */
export const buildInstancedBody = (three: Three, { segments, body = TEAM_GAME }: BuildInstancedBodyParams): Geometry => {
  const joints = jointsOf(body)
  const parts: Geometry[] = []
  const half = Math.max(4, segments >> 1)
  const { Vector2, LatheGeometry, CylinderGeometry, SphereGeometry } = three
  const limb = (radiusA: number, radiusB: number, length: number, radial: number): Geometry => {
    const geometry = new CylinderGeometry(radiusB, radiusA, length, radial, 1, false)
    geometry.translate(0, -length / 2, 0)
    return geometry
  }
  const ball = (radius: number, radial: number): Geometry => new SphereGeometry(radius, radial, Math.max(3, Math.round(radial * 0.75)))
  const tag = (geometry: Geometry, bone: number, pivot: Vec3, material: number, parent?: Vec3): void => void parts.push(tagGeometry(geometry, bone, pivot, material, parent, three))
  const profile = (points: readonly (readonly [number, number])[]): THREE_NS.Vector2[] => points.map(([radius, height]) => new Vector2(radius, height))
  const hip = joints.hip
  const neck = joints.neck
  const torso = new LatheGeometry(profile([[0, 0.86], [0.17, 0.88], [0.165, 0.98], [0.15, 1.1], [0.175, 1.26], [0.19, 1.38], [0.14, 1.47], [0.06, 1.52], [0, 1.53]]), segments)
  torso.scale(1.12, 1, 0.64)
  tag(torso, 0, hip, 1)
  const pelvis = new LatheGeometry(profile([[0, 0.78], [0.15, 0.8], [0.172, 0.88], [0.165, 0.97], [0, 0.98]]), segments)
  pelvis.scale(1.12, 1, 0.7)
  tag(pelvis, 0, hip, 2)
  const neckPart = limb(0.055, 0.05, 0.12, half)
  neckPart.translate(0, 1.6, 0)
  tag(neckPart, 1, neck, 0)
  const head = ball(0.13, segments)
  head.scale(0.96, 1.1, 1.02)
  head.translate(0, 1.67, 0.01)
  tag(head, 1, neck, 0)
  const hair = new SphereGeometry(0.137, segments, Math.max(3, segments >> 1), 0, Math.PI * 2, 0, Math.PI * 0.42)
  hair.scale(0.98, 1.1, 1.04)
  hair.rotateX(-0.35)
  hair.translate(0, 1.68, -0.01)
  tag(hair, 1, neck, 4)
  const jaw = ball(0.085, half)
  jaw.scale(1, 0.55, 1)
  jaw.translate(0, 1.58, 0.05)
  tag(jaw, 11, neck, 0)
  for (const side of [-1, 1]) {
    const eye = ball(0.02, 4)
    eye.scale(1.2, 0.7, 0.5)
    eye.translate(side * 0.045, 1.69, 0.125)
    tag(eye, 6, neck, 3)
  }
  const armLengthScale = scaleOf(distance(joints.shoulderE, joints.elbowE), GAME_UPPER_ARM)
  const legLengthScale = scaleOf(distance(joints.thighE, joints.kneeE), GAME_THIGH)
  const arms: readonly [number, number, number, Vec3, Vec3][] = [[-1, 2, 7, joints.shoulderE, joints.elbowE], [1, 3, 8, joints.shoulderD, joints.elbowD]]
  for (const [, bone, forearmBone, shoulder, elbow] of arms) {
    const upper = limb(0.074, 0.06, 0.31 * armLengthScale, half)
    upper.translate(shoulder[0], shoulder[1], 0)
    tag(upper, bone, shoulder, 1)
    const joint = ball(0.07, half)
    joint.translate(shoulder[0], shoulder[1], 0)
    tag(joint, bone, shoulder, 1)
    const forearm = limb(0.06, 0.046, 0.29 * armLengthScale, half)
    forearm.translate(elbow[0], elbow[1], 0)
    tag(forearm, forearmBone, elbow, 0, shoulder)
    const hand = ball(0.05, half)
    hand.scale(0.8, 1.2, 0.6)
    hand.translate(elbow[0], elbow[1] - 0.33 * armLengthScale, 0)
    tag(hand, forearmBone, elbow, 0, shoulder)
  }
  const legs: readonly [number, number, number, Vec3, Vec3][] = [[-1, 4, 9, joints.thighE, joints.kneeE], [1, 5, 10, joints.thighD, joints.kneeD]]
  for (const [, bone, shinBone, hipJoint, knee] of legs) {
    const thigh = limb(0.105, 0.078, 0.42 * legLengthScale, half)
    thigh.translate(hipJoint[0], hipJoint[1], 0)
    tag(thigh, bone, hipJoint, 2)
    const kneeJoint = ball(0.075, half)
    kneeJoint.translate(knee[0], knee[1], 0)
    tag(kneeJoint, shinBone, knee, 2, hipJoint)
    const shin = limb(0.077, 0.056, knee[1] - 0.1, half)
    shin.translate(knee[0], knee[1], 0)
    tag(shin, shinBone, knee, 2, hipJoint)
    const foot = ball(0.06, half)
    foot.scale(0.95, 0.72, 1.85)
    foot.translate(knee[0], 0.06, 0.05)
    tag(foot, shinBone, knee, 5, hipJoint)
  }
  return mergeBody(parts, three)
}
