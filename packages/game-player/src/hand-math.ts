/**
 * The little pose algebra the hands need, engine-agnostic: a pose is a position and a unit quaternion `[x, y, z, w]` (local to world), as `HandPose` of game-contracts.
 */

export type Vec3Tuple = readonly [number, number, number]
export type QuatTuple = readonly [number, number, number, number]

export interface Pose {
  readonly position: Vec3Tuple
  readonly quaternion: QuatTuple
}

/** The rotation whose local x, y and z go to `x`, `y` and `z` (an orthonormal, right-handed basis). */
export function quaternionOfBasis(x: readonly number[], y: readonly number[], z: readonly number[]): [number, number, number, number] {
  const [m00, m10, m20] = [x[0] ?? 0, x[1] ?? 0, x[2] ?? 0]
  const [m01, m11, m21] = [y[0] ?? 0, y[1] ?? 0, y[2] ?? 0]
  const [m02, m12, m22] = [z[0] ?? 0, z[1] ?? 0, z[2] ?? 0]
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

export function multiplyQuaternions(a: QuatTuple, b: QuatTuple): [number, number, number, number] {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz]
}

export function conjugateQuaternion(q: QuatTuple): [number, number, number, number] {
  return [-q[0], -q[1], -q[2], q[3]]
}

export function rotateVector(q: QuatTuple, v: Vec3Tuple): [number, number, number] {
  const [x, y, z, w] = q
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}

/** `parent` then `local`: the pose of a thing given in the frame of `parent`. */
export function composePose(parent: Pose, local: Pose): Pose {
  const offset = rotateVector(parent.quaternion, local.position)
  return {
    position: [parent.position[0] + offset[0], parent.position[1] + offset[1], parent.position[2] + offset[2]],
    quaternion: multiplyQuaternions(parent.quaternion, local.quaternion),
  }
}

/** The pose whose frame puts `local` at `world`: `composePose(result, local)` is `world`. */
export function poseHolding(world: Pose, local: Pose): Pose {
  const quaternion = multiplyQuaternions(world.quaternion, conjugateQuaternion(local.quaternion))
  const offset = rotateVector(quaternion, local.position)
  return { position: [world.position[0] - offset[0], world.position[1] - offset[1], world.position[2] - offset[2]], quaternion }
}

/** Between `a` (k 0) and `b` (k 1): the position on the line, the turn the short way round. */
export function blendPoses(a: Pose, b: Pose, k: number): Pose {
  const lerp = (i: 0 | 1 | 2): number => a.position[i] + (b.position[i] - a.position[i]) * k
  const dot = a.quaternion[0] * b.quaternion[0] + a.quaternion[1] * b.quaternion[1] + a.quaternion[2] * b.quaternion[2] + a.quaternion[3] * b.quaternion[3]
  const sign = dot < 0 ? -1 : 1
  const mixed = [0, 1, 2, 3].map((i) => (a.quaternion[i] ?? 0) * (1 - k) + (b.quaternion[i] ?? 0) * sign * k)
  const length = Math.hypot(...mixed) || 1
  return { position: [lerp(0), lerp(1), lerp(2)], quaternion: [(mixed[0] ?? 0) / length, (mixed[1] ?? 0) / length, (mixed[2] ?? 0) / length, (mixed[3] ?? 1) / length] }
}

/** Slow in, slow out: a hand speeds up off its start and settles on its target. */
export function easeInOut(t: number): number {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}
