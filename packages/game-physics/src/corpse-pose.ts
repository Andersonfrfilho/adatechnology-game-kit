import type { Quat, RagdollDesc, RagdollJoint, RagdollPart, ShapeDesc, Vec3 } from './contract'

/** A body's frame: where it is and how it is turned. */
export interface Rigid {
  readonly position: Vec3
  readonly rotation: Quat
}

export const multiplyQuat = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]

export const conjugateQuat = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

export const rotateVector = (q: Quat, v: Vec3): Vec3 => {
  const tx = 2 * (q[1] * v[2] - q[2] * v[1])
  const ty = 2 * (q[2] * v[0] - q[0] * v[2])
  const tz = 2 * (q[0] * v[1] - q[1] * v[0])
  return [v[0] + q[3] * tx + q[1] * tz - q[2] * ty, v[1] + q[3] * ty + q[2] * tx - q[0] * tz, v[2] + q[3] * tz + q[0] * ty - q[1] * tx]
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const middle = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/** A turn of `yaw` radians about +y. */
export const yawQuat = (yaw: number): Quat => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]

/** The frame that carries a part made at `standing` to where it is `target`: apply it to the whole body made around it. */
export const frameCarrying = (standing: Rigid, target: Rigid): Rigid => {
  const rotation = multiplyQuat(target.rotation, conjugateQuat(standing.rotation))
  return { rotation, position: subtract(target.position, rotateVector(rotation, standing.position)) }
}

const moved = (point: Vec3, frame: Rigid): Vec3 => add(rotateVector(frame.rotation, point), frame.position)

const placeJoint = (joint: RagdollJoint, frame: Rigid): RagdollJoint =>
  joint.kind === 'hinge'
    ? { ...joint, point: moved(joint.point, frame), axis: rotateVector(frame.rotation, joint.axis), normal: rotateVector(frame.rotation, joint.normal) }
    : { ...joint, point: moved(joint.point, frame), twistAxis: rotateVector(frame.rotation, joint.twistAxis), planeAxis: rotateVector(frame.rotation, joint.planeAxis) }

/** A ragdoll made at the origin, carried by `frame`: every part's pose and every joint's point and axes. Layer and sleep are the corpse's. */
export const placeRagdoll = (desc: RagdollDesc, frame: Rigid, extra: Pick<RagdollDesc, 'sleeping'> = {}): RagdollDesc => ({
  ...desc,
  ...extra,
  parts: desc.parts.map((part): RagdollPart => ({
    ...part,
    body: { ...part.body, position: moved(part.body.position, frame), rotation: multiplyQuat(frame.rotation, part.body.rotation ?? [0, 0, 0, 1]), layer: 'corpse' },
    ...(part.joint ? { joint: placeJoint(part.joint, frame) } : {}),
  })),
})

/** The bodies of a dead person in every rung, made standing at the origin, feet on y = 0 (`game-characters`' `corpseBodyKit` makes one). */
export interface CorpseBodyKit {
  /** R0: the 17-segment ragdoll. */
  readonly ragdoll: RagdollDesc
  /** R1: torso, head and legs, three parts; part 0 is the torso. */
  readonly chain: RagdollDesc
  /** R2: one capsule along local y whose centre sits `offset` from the torso's, in the torso's frame; its mass is the body's. */
  readonly capsule: { readonly shape: ShapeDesc; readonly mass: number; readonly offset: Vec3 }
  /** Which part of the ragdoll is each of the chain's: the torso, the head and the two thighs (the legs' capsule stands between them). */
  readonly anchors: { readonly torso: number; readonly head: number; readonly legs: readonly [number, number] }
}

const standingOf = (part: RagdollPart): Rigid => ({ position: part.body.position, rotation: part.body.rotation ?? [0, 0, 0, 1] })

/** Where a part that stood at `part` is when the anchor it follows, that stood at `anchor`, is now at `now`. */
const follow = (part: Rigid, anchor: Rigid, now: Rigid): Rigid => {
  const turn = multiplyQuat(now.rotation, conjugateQuat(anchor.rotation))
  return { rotation: multiplyQuat(turn, part.rotation), position: add(now.position, rotateVector(turn, subtract(part.position, anchor.position))) }
}

/** The chain's torso frame carries the whole chain; its head and legs then follow the ragdoll's own head and thighs, so nothing jumps. */
export const chainOfPoses = (kit: CorpseBodyKit, poses: { readonly torso: Rigid; readonly head: Rigid; readonly legs: readonly [Rigid, Rigid] }, sleeping: boolean): RagdollDesc => {
  const standing = kit.ragdoll.parts
  const at = (index: number): Rigid => standingOf(standing[index] as RagdollPart)
  const torso = follow(standingOf(kit.chain.parts[0] as RagdollPart), at(kit.anchors.torso), poses.torso)
  const placed = placeRagdoll(kit.chain, frameCarrying(standingOf(kit.chain.parts[0] as RagdollPart), torso), { sleeping })
  const head = follow(standingOf(kit.chain.parts[1] as RagdollPart), at(kit.anchors.head), poses.head)
  const legsAnchor: Rigid = { position: middle(at(kit.anchors.legs[0]).position, at(kit.anchors.legs[1]).position), rotation: at(kit.anchors.legs[0]).rotation }
  const legsNow: Rigid = { position: middle(poses.legs[0].position, poses.legs[1].position), rotation: poses.legs[0].rotation }
  const legs = follow(standingOf(kit.chain.parts[2] as RagdollPart), legsAnchor, legsNow)
  const parts = placed.parts.map((part, index): RagdollPart => {
    const to = index === 1 ? head : index === 2 ? legs : undefined
    return to ? { ...part, body: { ...part.body, position: to.position, rotation: to.rotation } } : part
  })
  return { ...placed, parts }
}

/** The chain stood up around a capsule's pose (R2 to R1): its torso is the capsule's frame less the offset. */
export const chainOfCapsule = (kit: CorpseBodyKit, capsule: Rigid, sleeping: boolean): RagdollDesc => {
  const torso = torsoOfCapsule(kit, capsule)
  return placeRagdoll(kit.chain, frameCarrying(standingOf(kit.chain.parts[0] as RagdollPart), torso), { sleeping })
}

export const capsuleOfTorso = (kit: CorpseBodyKit, torso: Rigid): Rigid => ({ rotation: torso.rotation, position: add(torso.position, rotateVector(torso.rotation, kit.capsule.offset)) })

export const torsoOfCapsule = (kit: CorpseBodyKit, capsule: Rigid): Rigid => ({ rotation: capsule.rotation, position: subtract(capsule.position, rotateVector(capsule.rotation, kit.capsule.offset)) })

/** The torso frame of a ragdoll made at the origin and carried by `frame` (a death where it stood). */
export const standingTorso = (kit: CorpseBodyKit, frame: Rigid): Rigid => {
  const torso = standingOf(kit.chain.parts[0] as RagdollPart)
  return { position: moved(torso.position, frame), rotation: multiplyQuat(frame.rotation, torso.rotation) }
}
