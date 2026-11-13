import type { BendHinge, MaterialBending, Vec3 } from './types'

/** Metres: a ductile part this thin (or thinner) bends as a plate; thicker ones dent instead. */
export const BEND_PLATE_MAX_THICKNESS = 0.01
/** A plate bends when it is at least this many times wider than it is thick. */
export const BEND_PLATE_ASPECT = 5
/** Radians: bends smaller than this (about one degree) are springback, not kept. */
export const BEND_MIN = 0.02
/** Radians: a plate bent this far has folded over; it bends no further. */
export const BEND_MAX = 1.5
/** Share of a blow's energy that flexes a part when its material says nothing (the rest moves the part and what holds it). */
export const BEND_ABSORBED_DEFAULT = 0.4
/** Modulus of elasticity in GPa when the material does not say (steel). */
export const BEND_ELASTIC_GPA_DEFAULT = 200

const order = (dims: Vec3): [number, number, number] => [0, 1, 2].sort((a, b) => dims[b] - dims[a]) as [number, number, number]

/** Strain energy in joules a beam of span `span` stores at bending moment `moment` (load at any point): `M² L / (6 E I)`. */
export const strainEnergy = (moment: number, span: number, stiffness: number): number => (moment * moment * span) / (6 * stiffness)

/** Bending moment in N m a beam of span `span` and stiffness `E I` carries when it has taken `energy` joules (inverse of `strainEnergy`). */
export const momentOfStrainEnergy = (energy: number, span: number, stiffness: number): number => Math.sqrt((6 * stiffness * energy) / span)

/** Share of the blow that flexes the part (`bending.absorbed`). */
const shareOf = (bending: MaterialBending): number => bending.absorbed ?? BEND_ABSORBED_DEFAULT
const stiffnessOf = (bending: MaterialBending, width: number, depth: number): number => (bending.elasticGPa ?? BEND_ELASTIC_GPA_DEFAULT) * 1e9 * ((width * depth ** 3) / 12)

/**
 * The permanent bend in radians a blow of `energy` joules adds to a thin ductile plate (a pressed steel blade): it bends about a line across its width, and
 * the plastic moment of the section is `Mp = yield * b * t² / 4`. The first `strainEnergy(Mp)` of the blow is elastic and springs back; the rest is plastic
 * work `Mp * angle`. `dims` are the part's three sizes and `direction` is the blow's direction in the part's own axes; it must come in across the plate.
 * Returns 0 for a part that is not a plate, a material without `yieldMPa` or a blow that does not reach the yield.
 */
export function plasticBend(dims: Vec3, thickness: number, bending: MaterialBending | undefined, energy: number, direction: Vec3): number {
  if (!bending?.yieldMPa || energy <= 0) return 0
  const [long, mid, thin] = order(dims)
  const t = Math.min(thickness, dims[thin])
  if (t > BEND_PLATE_MAX_THICKNESS || dims[mid] < BEND_PLATE_ASPECT * t) return 0
  // the blow has to come across the face of the plate
  const length = Math.hypot(direction[0], direction[1], direction[2])
  if (length === 0 || Math.abs(direction[thin]) / length < 0.5) return 0
  const width = dims[mid]
  const plasticMoment = (bending.yieldMPa * 1e6 * width * t * t) / 4
  const elastic = strainEnergy(plasticMoment, dims[long], stiffnessOf(bending, width, t))
  const plastic = energy * shareOf(bending) - elastic
  return plastic <= 0 ? 0 : plastic / plasticMoment
}

/**
 * Whether a blow of `energy` joules snaps a long part (a handle, a batten) in bending: the energy the blow flexes it with, `absorbed` of the whole, against the
 * strain energy it holds at its moment of rupture, `Mr = rupture * b * h² / 6` over its span (`strainEnergy`). `direction` is the blow's direction in the part's
 * own axes: the depth `h` is the section side that lies along it. Returns the moment the blow reached over the moment the section holds (1 or more snaps it),
 * 0 when the part is not a long one or its material has no `ruptureMPa`.
 */
export function snapRatio(dims: Vec3, bending: MaterialBending | undefined, energy: number, direction: Vec3, aspect: number): number {
  if (!bending?.ruptureMPa || energy <= 0) return 0
  const [long, first, second] = order(dims)
  if (dims[long] < aspect * dims[first]) return 0
  const length = Math.hypot(direction[0], direction[1], direction[2])
  if (length === 0) return 0
  // the blow bends it across the long axis: the side of the section most along the blow is the depth, the other one the width
  const depthAxis = Math.abs(direction[first]) >= Math.abs(direction[second]) ? first : second
  const widthAxis = depthAxis === first ? second : first
  const across = Math.sqrt(Math.max(0, 1 - (direction[long] / length) ** 2))
  const depth = dims[depthAxis]
  const width = dims[widthAxis]
  const ruptureMoment = (bending.ruptureMPa * 1e6 * width * depth * depth) / 6
  const moment = momentOfStrainEnergy(energy * across * shareOf(bending), dims[long], stiffnessOf(bending, width, depth))
  return moment / ruptureMoment
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * The line a plate folds about under a blow, in the part's own axes: across the plate's width at the blow point, folding the nearer end (the shorter side) over
 * in the direction the blow goes. `point` is the blow point and `direction` its direction, both in part axes.
 */
export function plateHinge(dims: Vec3, point: Vec3, direction: Vec3): BendHinge {
  const [long, , thin] = order(dims)
  const hinge: Vec3 = [0, 0, 0]
  hinge[long] = Math.max(-dims[long] / 2, Math.min(dims[long] / 2, point[long]))
  const side: Vec3 = [0, 0, 0]
  side[long] = point[long] >= 0 ? 1 : -1
  const way: Vec3 = [0, 0, 0]
  way[thin] = direction[thin] >= 0 ? 1 : -1
  return { point: hinge, axis: cross(side, way), side }
}

/** Metres: a part whose underside is within this of the floor lies on it. */
export const FLOOR_CONTACT = 0.01
/** A blow drives a part into the floor when this much of its direction (0..1) points down. */
export const FLOOR_PRESS = 0.3

/**
 * Whether a blow pushes a part into the floor it lies on: its lowest point `lowestY` is at the floor (`groundHeight`) and the blow's world `direction` goes down.
 * A plate cannot fold into what supports it, so such a blow dents it instead of bending it.
 */
export const pressedAgainstFloor = (lowestY: number, groundHeight: number, direction: Vec3): boolean => {
  const length = Math.hypot(direction[0], direction[1], direction[2])
  return length > 0 && lowestY <= groundHeight + FLOOR_CONTACT && -direction[1] / length >= FLOOR_PRESS
}
