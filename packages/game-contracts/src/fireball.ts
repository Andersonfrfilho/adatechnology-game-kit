/**
 * The heat of a blast, from the size and life of its fireball and not from the game radius of the blast. Pure functions in SI units (m, s, W/m2, J/m2).
 *
 * A condensed charge (TNT, Composition B, C4) makes a small fireball that lives milliseconds: its radius and its life both grow as the cube root of the charge
 * (Hopkinson-Cranz scaling, as the wave does). A burning fuel (the gas of a cylinder that bursts, petrol) makes a fireball metres wide that lives about a second:
 * the BLEVE correlations of the CCPS guidelines, `D = 5.8 M^(1/3)` m and `t = 0.45 M^(1/3)` s for `M` kg of fuel, with a surface emissive power of a few hundred kW/m2.
 * What a surface takes is the heat per square metre over the life of the fireball: the whole flux inside it, and outside it the share a sphere of radius `R` sends to a
 * surface that faces it at `d` from its centre (the view factor `(R / d)^2`). A surface catches fire when that dose passes what its material needs (`ignitionDose`).
 */

/** The fireball of a blast: how wide, how long and how hot it burns on what it touches. */
export interface Fireball {
  /** Metres. */
  readonly radius: number
  /** Seconds the fireball lives. */
  readonly seconds: number
  /** W/m2 it puts on a surface inside it (radiation and the hot gases together). */
  readonly flux: number
}

/** m/kg^(1/3): radius of the luminous fireball of a condensed charge (an engineering estimate; the M67, 0.24 kg of TNT, is 0.8 m). */
const CHARGE_RADIUS = 1.3
/** s/kg^(1/3): its life (the M67 burns 6 ms). */
const CHARGE_SECONDS = 0.01
/** W/m2 on a surface inside the fireball of a condensed charge: detonation products at some 2500 K, radiation and convection. */
const CHARGE_FLUX = 1.5e6
/** m/kg^(1/3): radius of a fuel fireball, half of the CCPS diameter 5.8 M^(1/3). */
const FUEL_RADIUS = 2.9
/** s/kg^(1/3): life of a fuel fireball (CCPS, below 30 t of fuel). */
const FUEL_SECONDS = 0.45
/** W/m2: surface emissive power of a hydrocarbon fireball (CCPS gives 200 to 350). */
const FUEL_FLUX = 250e3
/** J/m2 per degree between the room and the ignition temperature: the dose a solid needs to light under a brief heat (paper at 230 °C takes 63 kJ/m2, hard wood at 330 °C 93). */
const DOSE_PER_DEGREE = 300

/** The fireball of `tnt` kg of TNT equivalent of a condensed charge. */
export function chargeFireball(tnt: number): Fireball {
  const cube = Math.cbrt(Math.max(0, tnt))
  return { radius: CHARGE_RADIUS * cube, seconds: CHARGE_SECONDS * cube, flux: CHARGE_FLUX }
}

/** The fireball of `fuel` kg of a burning hydrocarbon (the gas of a cylinder, petrol). */
export function fuelFireball(fuel: number): Fireball {
  const cube = Math.cbrt(Math.max(0, fuel))
  return { radius: FUEL_RADIUS * cube, seconds: FUEL_SECONDS * cube, flux: FUEL_FLUX }
}

/** J/m2 a surface facing the fireball takes at `distance` metres from its centre: the whole flux inside it, the view factor `(R / d)^2` of the sphere outside. */
export function fireballDose(fireball: Fireball, distance: number): number {
  const share = distance <= fireball.radius ? 1 : (fireball.radius / distance) ** 2
  return fireball.flux * fireball.seconds * share
}

/** J/m2 a surface of a material that ignites at `ignitionC` needs to catch fire from a brief heat, starting at `ambientC`. */
export function ignitionDose(ignitionC: number, ambientC = 20): number {
  return DOSE_PER_DEGREE * Math.max(1, ignitionC - ambientC)
}
