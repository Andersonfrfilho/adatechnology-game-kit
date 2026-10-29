import type { Quat, Vec3 } from '@adatechnology/game-contracts'

/** `v` rotated by the unit quaternion `q`. */
export const rotate = (q: Quat, v: Vec3): Vec3 => {
  const [x, y, z, w] = q
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}

const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

export type Transform = { readonly position: Vec3; readonly rotation: Quat }

export const toWorld = ({ position, rotation }: Transform, local: Vec3): Vec3 => {
  const turned = rotate(rotation, local)
  return [turned[0] + position[0], turned[1] + position[1], turned[2] + position[2]]
}

export const toLocal = ({ position, rotation }: Transform, world: Vec3): Vec3 => rotate(conjugate(rotation), [world[0] - position[0], world[1] - position[1], world[2] - position[2]])

export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
