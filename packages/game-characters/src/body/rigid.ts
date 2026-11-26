import type { PhysicsWorld, Quat, RagdollJoint, RagdollPart, BodyId, Vec3 } from '@adatechnology/game-physics'

export type Pose = { readonly position: Vec3; readonly rotation: Quat }
export type LiveBody = Pose & { readonly linear: Vec3; readonly angular: Vec3 }

/** A body's pose and velocity now. */
export const liveOf = (world: PhysicsWorld, body: BodyId): LiveBody => {
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  world.readPose(body, pose, 0)
  world.readVelocity(body, velocity, 0)
  return { position: [pose[0] ?? 0, pose[1] ?? 0, pose[2] ?? 0], rotation: [pose[3] ?? 0, pose[4] ?? 0, pose[5] ?? 0, pose[6] ?? 1], linear: [velocity[0] ?? 0, velocity[1] ?? 0, velocity[2] ?? 0], angular: [velocity[3] ?? 0, velocity[4] ?? 0, velocity[5] ?? 0] }
}

export const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]

export const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const rotateBy = (q: Quat, v: Vec3): Vec3 => {
  const along = cross([q[0], q[1], q[2]], v)
  const twice = cross([q[0], q[1], q[2]], [along[0] + q[3] * v[0], along[1] + q[3] * v[1], along[2] + q[3] * v[2]])
  return [v[0] + 2 * twice[0], v[1] + 2 * twice[1], v[2] + 2 * twice[2]]
}

/** The rigid motion of a body from the pose it was made in to where it is now, with the velocity of the body: what carries a piece drawn on it. */
export type RigidMove = { readonly from: Vec3; readonly to: LiveBody; readonly turn: Quat }

export const moveOf = (made: Pose, live: LiveBody): RigidMove => ({ from: made.position, to: live, turn: multiply(live.rotation, conjugate(made.rotation)) })

export const movePoint = (move: RigidMove, point: Vec3): Vec3 => add(move.to.position, rotateBy(move.turn, subtract(point, move.from)))

export const moveDirection = (move: RigidMove, direction: Vec3): Vec3 => rotateBy(move.turn, direction)

/** Velocity of a point already carried by the move (the body's linear plus its spin about its centre). */
export const velocityAt = (move: RigidMove, point: Vec3): Vec3 => add(move.to.linear, cross(move.to.angular, subtract(point, move.to.position)))

export const moveJoint = (joint: RagdollJoint, move: RigidMove): RagdollJoint => {
  const point = movePoint(move, joint.point)
  if (joint.kind === 'hinge') return { ...joint, point, axis: moveDirection(move, joint.axis), normal: moveDirection(move, joint.normal) }
  return { ...joint, point, twistAxis: moveDirection(move, joint.twistAxis), planeAxis: moveDirection(move, joint.planeAxis) }
}

/** The part as a body is carried by `move`: pose, velocity and joint moved with it. */
export const movePart = (part: RagdollPart, move: RigidMove): RagdollPart => {
  const rotation = multiply(move.turn, part.body.rotation ?? [0, 0, 0, 1])
  const position = movePoint(move, part.body.position)
  const body = { ...part.body, position, rotation, linearVelocity: velocityAt(move, position), angularVelocity: move.to.angular }
  return part.joint ? { ...part, body, joint: moveJoint(part.joint, move) } : { ...part, body }
}
