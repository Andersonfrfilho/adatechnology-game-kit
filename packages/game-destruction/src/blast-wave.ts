import { DEFAULT_BLAST_IMPULSE, reflectedLoad, waveWork } from '@adatechnology/game-contracts'
import type { WaveLoad, WaveWork, WaveWorkInput } from '@adatechnology/game-contracts'
import type { BlastCasing } from '@adatechnology/game-contracts'
import type { PartShape, Vec3 } from './types'

export { reflectedLoad, waveWork }
export type { WaveLoad, WaveWork, WaveWorkInput }

/**
 * The physics of a blast on a part and of the fragments of its case. Pure functions in SI units (kg, m, s, Pa, J).
 *
 * Wave: the charge is a TNT equivalent `W` (kg); the scaled distance is `Z = R / W^(1/3)` (Hopkinson-Cranz). Peak overpressure and positive impulse of the side-on wave are Kinney and
 * Graham's fits (1985), the wall reflects them (Rankine-Hugoniot for the pressure, the Kingery-Bulmash ratio for the impulse). A part is loaded over the area it shows the charge,
 * and the energy it takes is the smaller of the two asymptotes of its pressure-impulse diagram (Baker et al. 1983, Smith and Hetherington 1994): the impulsive one, `J^2 / 2m`
 * (the load is over before the part moves), and the quasi-static one, `P A d` (the pressure holds while the part moves through its own thickness `d`).
 * Fragments: Mott's distribution of the case mass, Gurney's first speed, drag of a tumbling piece (see `casingFragments`).
 */

/** kg/m3 */
const AIR_DENSITY = 1.2
/** Presentation area of a tumbling irregular fragment over the area of the sphere of the same volume, times its drag coefficient (about 1.5 x 1.0; Held, Mott fragments). */
const DRAG_AREA_FACTOR = 1.5
/** kg/m3 */
const STEEL_DENSITY = 7850
/** m/s: a fragment slower than this does nothing the wave did not (a steel piece of 0.2 g at 30 m/s carries 0.1 J). */
export const FRAGMENT_MIN_SPEED = 30
/** Large-deflection stiffening of a glass plate over the linear plate theory (the membrane takes load once it bends past its thickness): windows break at 1 to 7 kPa, not at 1. */
const GLASS_STIFFENING = 2.5
/** Roark, table 11.4 case 10a: maximum stress of a square plate simply supported on its edges under uniform pressure `q`, `0.287 q b^2 / t^2` (Poisson 0.3). */
const PLATE_COEFFICIENT = 0.2874
/** Maximum stress of a simply supported beam under uniform load `q` per unit width: `M = q L^2 / 8` over `t^2 / 6`, `0.75 q L^2 / t^2`. */
const BEAM_COEFFICIENT = 0.75

/** Kilograms of TNT per joule of the blast `energy`, when the charge does not say its TNT equivalent: the arsenal's scale (the M67 is 0.24 kg for 200 kJ). */
export const TNT_PER_JOULE = DEFAULT_BLAST_IMPULSE.tntPerJoule

/** Area in m2 that a shape shows to a charge in the direction `toward` (a unit vector from the part to the charge, in the part's frame). */
export function projectedArea(shape: PartShape, toward: Vec3): number {
  const [dx, dy, dz] = [Math.abs(toward[0]), Math.abs(toward[1]), Math.abs(toward[2])]
  if (shape.kind === 'box') return dx * shape.size[1] * shape.size[2] + dy * shape.size[0] * shape.size[2] + dz * shape.size[0] * shape.size[1]
  if (shape.kind === 'cylinder') return Math.PI * shape.radius ** 2 * dy + 2 * shape.radius * shape.height * Math.sqrt(Math.max(0, 1 - dy * dy))
  return Math.PI * shape.radius ** 2
}

/** What a part takes of the wave to fail: the pressure it holds (Pa) and the work to break it (J). */
export interface FailureWork {
  readonly pressure: number
  readonly work: number
}

export interface FailureInput {
  /** `MaterialDef.failureMPa` */
  readonly failureMPa: number
  readonly ductility: number
  /** A stick (a leg, a rod, a handle) loaded across its length, not a plate: `sigma = 0.75 q L^2 / t^2` (simply supported beam under uniform load) instead of the plate's 0.287. */
  readonly isBeam?: boolean
  /** Glass-like plates stiffen once they bend past their thickness. */
  readonly isGlass: boolean
  /** m */
  readonly thickness: number
  /** m: the short span of the part. */
  readonly span: number
  /** m2: the area the wave loads (`WaveWork.loaded`). */
  readonly loaded: number
}

/**
 * When a part fails under the blast, as a plate (or, long and thin, as a beam): linear plate theory gives the pressure `q = sigma t^2 / (0.287 b^2)` (Roark; large-deflection stiffening of glass x2.5) with `t` the
 * thickness and `b` the short span, and the part fails when the wave does more work than that resistance acts through its failure deflection, `q A d`, `d = t (1 + 25 ductility^2)` (a
 * brittle plate fails at about its thickness, a mild steel one only after twenty times that). Below `q` the part does not fail however long the load lasts (the vertical asymptote of
 * the pressure-impulse diagram). A 4 mm pane 1 m wide fails at 6 kPa, as windows do in the damage tables (1 to 7 kPa; Glasstone and Dolan 1977); a 13 cm brick wall 3 m wide at 2 kPa.
 */
export function failureWork(input: FailureInput): FailureWork {
  const ratio = input.thickness / Math.max(input.span, input.thickness)
  const stiffening = input.isGlass ? GLASS_STIFFENING : 1
  const pressure = (stiffening * input.failureMPa * 1e6 * ratio * ratio) / (input.isBeam ? BEAM_COEFFICIENT : PLATE_COEFFICIENT)
  const deflection = input.thickness * (1 + 25 * input.ductility * input.ductility)
  // a brittle plate loads linearly up to its failure (the work is half of force times deflection); a ductile one yields at the force and goes on (all of it)
  return { pressure, work: (0.5 + 0.5 * input.ductility) * pressure * input.loaded * deflection }
}

/** The numbers of the fragments a case throws. */
export interface CasingFlight {
  /** Mott's scale in kg: the case breaks into `mass / (2 scale)` pieces whose mean mass is `2 scale`. */
  readonly mottScale: number
  /** First speed in m/s (Gurney). */
  readonly speed: number
}

/** Mott's scale and Gurney's first speed of a case. `v = sqrt(2E) / sqrt(M/C + k)` with `k` 3/5 for a sphere and 1/2 for a cylinder (Gurney 1943, Kennedy 1970). */
export function casingFlight(casing: BlastCasing): CasingFlight {
  const k = casing.geometry === 'cylinder' ? 0.5 : 0.6
  return {
    mottScale: casing.mass / (2 * Math.max(1, casing.fragments)),
    speed: casing.gurneyVelocity / Math.sqrt(casing.mass / Math.max(casing.chargeMass, 1e-6) + k),
  }
}

/**
 * Mass in kg of one fragment drawn with `u` (0..1) from Mott's distribution `N(m) = N0 exp(-sqrt(m / mu))`: `m = mu ln(1/u)^2`. The heaviest piece of the case is the one with
 * `N(m) = 1`, so `u` is not taken under `1 / fragments`.
 */
export function mottMass(u: number, scale: number, fragments: number): number {
  const lowest = 1 / Math.max(1, fragments)
  return scale * Math.log(1 / Math.max(u, lowest)) ** 2
}

/** Diameter in mm of the sphere of the volume of a fragment of `mass` kg: the calibre of the hole it makes. */
export function fragmentCaliberMm(mass: number): number {
  return 2000 * Math.cbrt((3 * mass) / (4 * Math.PI * STEEL_DENSITY))
}

/** 1/m: the speed of a fragment falls as `exp(-k d)`, `k = rho_air C_d A / 2m` (the slowing of a piece against the air in front of it). */
export function fragmentDrag(mass: number): number {
  const sphereArea = Math.PI * Math.cbrt((3 * mass) / (4 * Math.PI * STEEL_DENSITY)) ** 2
  return (AIR_DENSITY * DRAG_AREA_FACTOR * sphereArea) / (2 * mass)
}
