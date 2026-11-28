import type { Quat, Vec3 } from '@adatechnology/game-physics'

/** What a body weighs and how it turns: its mass, centre of mass and moments about the principal axes, all in the body's frame. */
export interface BodyMass {
  readonly mass: number
  readonly centre: Vec3
  readonly inertia: Vec3
}

/** A part as the mass is worked out from: its mass and its box (centre and full size). */
export interface MassPart {
  readonly mass: number
  readonly box: { readonly center: Vec3; readonly size: Vec3 }
  /** Where its mass sits when not at the middle of its box (`PartDef.massCentre`). */
  readonly massCentre?: Vec3 | undefined
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

/** The whole car as the kit has it: every part's mass where the part says it sits (`massCentre`, else the centre of its box), the centre of mass of them all, and the moments about that centre. */
export const bodyMassOf = (parts: readonly MassPart[]): BodyMass => {
  const mass = parts.reduce((sum, part) => sum + part.mass, 0)
  const at = (part: MassPart): Vec3 => part.massCentre ?? part.box.center
  const centre = [0, 1, 2].map((k) => parts.reduce((sum, part) => sum + part.mass * at(part)[k]!, 0) / mass) as unknown as Vec3
  const inertia = [0, 1, 2].map((k) => parts.reduce((sum, part) => {
    const offset: Vec3 = [at(part)[0] - centre[0], at(part)[1] - centre[1], at(part)[2] - centre[2]]
    return sum + boxInertia(part.mass, part.box.size)[k]! + lever(part.mass, offset, k)
  }, 0)) as unknown as Vec3
  return { mass, centre, inertia }
}

/**
 * The parts with their boxes moved into another frame by `toFrame` (a rigid matrix, column-major as `Matrix4.elements`): the model's parts are in the vehicle's own space,
 * which the drawn vehicle turns inside its root (a quarter turn about y), and the chassis body is in the root's frame. A box turned off the axes keeps the size of its box round it.
 */
export const partsInFrame = <TPart extends MassPart>(parts: readonly TPart[], toFrame: ArrayLike<number>): TPart[] => {
  const m = toFrame
  const at = (row: number, column: number): number => m[column * 4 + row]!
  const moved = ([x, y, z]: Vec3): Vec3 => [0, 1, 2].map((row) => at(row, 0) * x + at(row, 1) * y + at(row, 2) * z + at(row, 3)) as unknown as Vec3
  return parts.map((part) => {
    const [sx, sy, sz] = part.box.size
    const size: Vec3 = [0, 1, 2].map((row) => Math.abs(at(row, 0)) * sx + Math.abs(at(row, 1)) * sy + Math.abs(at(row, 2)) * sz) as unknown as Vec3
    return { ...part, box: { ...part.box, center: moved(part.box.center), size }, ...(part.massCentre ? { massCentre: moved(part.massCentre) } : {}) }
  })
}
