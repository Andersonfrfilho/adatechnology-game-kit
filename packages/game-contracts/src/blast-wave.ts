import { sideOnImpulse, sideOnOverpressure } from './blast-impulse'

/**
 * The blast wave on a part, from Hopkinson-Cranz scaling: the reflected load of a charge of TNT equivalent at a distance (Kinney and Graham's side-on fits, reflected by
 * Rankine-Hugoniot for the pressure and the Kingery-Bulmash ratio for the impulse), and the work it puts into a part of a given area, mass and thickness (the smaller
 * asymptote of its pressure-impulse diagram, Baker et al. 1983). Shared by the destruction world and every module that takes blasts on its own parts (vehicles).
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
