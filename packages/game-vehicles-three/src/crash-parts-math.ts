import type { Quat, Vec3 } from '@adatechnology/game-physics'

/** What a body weighs and how it turns: its mass, centre of mass and moments about the principal axes, all in the body's frame. */
export interface BodyMass {
  readonly mass: number
  readonly centre: Vec3
  readonly inertia: Vec3
}

/** The least a moment may fall to when a part's moments are taken off (kg m^2 per kg): a body never reaches zero inertia. */
const MIN_INERTIA_PER_MASS = 1e-3

export const rotateBy = (q: Quat, v: Vec3): Vec3 => {
  const [x, y, z, w] = q
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]
}

export const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

export const multiplyQuat = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]

/** Moments of a solid box of `mass` and full `size` about its own centre. */
export const boxInertia = (mass: number, size: Vec3): Vec3 => [
  (mass / 12) * (size[1] * size[1] + size[2] * size[2]),
  (mass / 12) * (size[0] * size[0] + size[2] * size[2]),
  (mass / 12) * (size[0] * size[0] + size[1] * size[1]),
]

/** The moment about axis `k` of a point mass `mass` at offset `d` (parallel axis term). */
const lever = (mass: number, d: Vec3, k: number): number => mass * (d[0] * d[0] + d[1] * d[1] + d[2] * d[2] - d[k]! * d[k]!)

/**
 * What is left of `total` when `part` (its own mass, centre and moments, in the same frame) leaves: the mass, the centre of mass the rest has, and its moments about that
 * centre (the whole's moments about its centre, less the part's about that centre, moved to the rest's centre by the parallel axis theorem).
 */
export const withoutPart = (total: BodyMass, part: BodyMass): BodyMass => {
  const mass = total.mass - part.mass
  if (!(mass > 0)) throw new Error(`crash parts: a part of ${part.mass} kg cannot leave a body of ${total.mass} kg`)
  const centre: Vec3 = [0, 1, 2].map((k) => (total.mass * total.centre[k]! - part.mass * part.centre[k]!) / mass) as unknown as Vec3
  const partOffset: Vec3 = [part.centre[0] - total.centre[0], part.centre[1] - total.centre[1], part.centre[2] - total.centre[2]]
  const shift: Vec3 = [centre[0] - total.centre[0], centre[1] - total.centre[1], centre[2] - total.centre[2]]
  const floor = mass * MIN_INERTIA_PER_MASS
  const inertia = [0, 1, 2].map((k) => Math.max(floor, total.inertia[k]! - (part.inertia[k]! + lever(part.mass, partOffset, k)) - lever(mass, shift, k))) as unknown as Vec3
  return { mass, centre, inertia }
}
