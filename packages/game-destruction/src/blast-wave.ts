import { DEFAULT_BLAST_IMPULSE, sideOnImpulse, sideOnOverpressure } from '@adatechnology/game-contracts'
import type { BlastCasing } from '@adatechnology/game-contracts'
import type { PartShape, Vec3 } from './types'

/**
 * The physics of a blast on a part and of the fragments of its case. Pure functions in SI units (kg, m, s, Pa, J).
 *
 * Wave: the charge is a TNT equivalent `W` (kg); the scaled distance is `Z = R / W^(1/3)` (Hopkinson-Cranz). Peak overpressure and positive impulse of the side-on wave are Kinney and
 * Graham's fits (1985), the wall reflects them (Rankine-Hugoniot for the pressure, the Kingery-Bulmash ratio for the impulse). A part is loaded over the area it shows the charge,
 * and the energy it takes is the smaller of the two asymptotes of its pressure-impulse diagram (Baker et al. 1983, Smith and Hetherington 1994): the impulsive one, `J^2 / 2m`
 * (the load is over before the part moves), and the quasi-static one, `P A d` (the pressure holds while the part moves through its own thickness `d`).
 * Fragments: Mott's distribution of the case mass, Gurney's first speed, drag of a tumbling piece (see `casingFragments`).
 */

/** Pa */
const ATMOSPHERE = 101325
/** Scaled distance (m/kg^(1/3)) below which the far-field fits are held: closer is a charge in contact, where the fits stop being the wave. */
const NEAREST_SCALED = 0.2
/** m: a charge's near field and the size of a charge add this much to the standoff when the area the wave loads evenly is taken. */
const LOADED_MARGIN = 0.15
/** J/kg: the TNT equivalent's definition. */
const TNT_JOULES = 4.184e6
/**
 * Share of the charge energy that a target crushes and spalls when the charge is in contact with it, at the scaled distance 0 (an engineering estimate of the cratering efficiency of
 * contact charges in concrete and masonry: a few percent of the energy goes into breaking the material, the rest into air and ground shock).
 */
const SHOCK_COUPLING = 0.04
/** m/kg^(1/3): scaled distance at which the crushing and spalling of a surface is a quarter of that at contact (they fall off as `(1 + (Z / Z0)^2)^-2`; spalling of concrete stops near Z = 1.5). */
const SHOCK_SCALED = 0.6
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

/** The wave on a face that looks at the charge: reflected peak overpressure (Pa) and reflected positive impulse (Pa s). */
export interface WaveLoad {
  readonly pressure: number
  readonly impulse: number
}

/** The reflected load at `distance` m from `tnt` kg of TNT. */
export function reflectedLoad(tnt: number, distance: number): WaveLoad {
  if (!(tnt > 0)) return { pressure: 0, impulse: 0 }
  const cube = Math.cbrt(tnt)
  const nearest = NEAREST_SCALED * cube
  const side = sideOnOverpressure(tnt, distance, nearest)
  const z = Math.max(distance, nearest) / cube
  // ideal gas, normal reflection: Pr = 2 Ps (7 Pa + 4 Ps) / (7 Pa + Ps), 2 for a weak wave, up to 8 for a strong one
  const pressure = (2 * side * (7 * ATMOSPHERE + 4 * side)) / (7 * ATMOSPHERE + side)
  const impulse = sideOnImpulse(tnt, distance, nearest) * (2 + 4 / (1 + z * z))
  return { pressure, impulse }
}

/** Area in m2 that a shape shows to a charge in the direction `toward` (a unit vector from the part to the charge, in the part's frame). */
export function projectedArea(shape: PartShape, toward: Vec3): number {
  const [dx, dy, dz] = [Math.abs(toward[0]), Math.abs(toward[1]), Math.abs(toward[2])]
  if (shape.kind === 'box') return dx * shape.size[1] * shape.size[2] + dy * shape.size[0] * shape.size[2] + dz * shape.size[0] * shape.size[1]
  if (shape.kind === 'cylinder') return Math.PI * shape.radius ** 2 * dy + 2 * shape.radius * shape.height * Math.sqrt(Math.max(0, 1 - dy * dy))
  return Math.PI * shape.radius ** 2
}

export interface WaveWorkInput {
  /** Kilograms of TNT. */
  readonly tnt: number
  /** Metres from the charge to the nearest point of the part. */
  readonly distance: number
  /** 0..1: the share of the wave that gets through what stands in between. */
  readonly reach: number
  /** m2 the part shows the charge. */
  readonly area: number
  readonly mass: number
  /** m: how far the part moves under the wave before it fails (its own thickness). */
  readonly thickness: number
}

export interface WaveWork {
  /** m2 the wave loads evenly. */
  readonly loaded: number
  /** Joules the wave puts into the part as a whole (it moves and bends, the P-I work). */
  readonly energy: number
  /** Joules that crush and spall the face next to the charge (`shockWork`), on top of `energy`. */
  readonly shock: number
  /** Reflected peak overpressure on the part (Pa), after cover. */
  readonly pressure: number
}

/**
 * What a blast puts into a part: `min(J^2 / 2 m, P A d)` with the load `P`, `J / A` of `reflectedLoad` cut by `reach`, over the area the wave loads evenly (a disc as wide as the
 * standoff, so a wall 10 m wide is not loaded as one block by a charge 1 m from it) and the mass of the piece of the part under that area. A 2 mm steel blade 0.8 m from an M67 gets
 * about 75 J (a dent); a 2 tonne wall 1.5 m away gets about 120 J (a scuff), so the damage depends on how much the part weighs for the area it shows.
 */
export function waveWork(input: WaveWorkInput): WaveWork {
  const load = reflectedLoad(input.tnt, input.distance)
  const reach = Math.min(1, Math.max(0, input.reach))
  const pressure = load.pressure * reach
  if (!(input.area > 0) || !(input.mass > 0) || pressure <= 0) return { energy: 0, shock: 0, pressure, loaded: 0 }
  const loaded = Math.min(input.area, Math.PI * (input.distance + LOADED_MARGIN) ** 2)
  const mass = input.mass * (loaded / input.area)
  const impulse = load.impulse * reach * loaded
  const impulsive = (impulse * impulse) / (2 * mass)
  const quasiStatic = pressure * loaded * Math.max(input.thickness, 1e-4)
  return { energy: Math.min(impulsive, quasiStatic), shock: shockWork(input), pressure, loaded }
}

/**
 * Crushing and spalling of the face next to a charge, which the far-field fits do not see: the charge energy `W * 4.184 MJ`, times the share that crushes material at that scaled
 * distance (`SHOCK_COUPLING (1 + (Z / 0.6)^2)^-2`), times the share of the sphere around the charge that the part intercepts (`A / 4 pi (R + r_c)^2`, at most a half: a face on the charge).
 * A grenade 0.8 m from a blade gives it about 1 J of this; a block of C4 against a wall gives it tens of kilojoules.
 */
function shockWork(input: WaveWorkInput): number {
  const cube = Math.cbrt(input.tnt)
  if (!(cube > 0) || !(input.area > 0)) return 0
  const z = Math.max(input.distance, 0) / cube
  const radius = Math.cbrt((3 * input.tnt) / (4 * Math.PI * 1600))
  const share = Math.min(0.5, input.area / (4 * Math.PI * (input.distance + radius) ** 2))
  return SHOCK_COUPLING * input.tnt * TNT_JOULES * (1 + (z / SHOCK_SCALED) ** 2) ** -2 * share * Math.min(1, Math.max(0, input.reach)) ** 2
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
