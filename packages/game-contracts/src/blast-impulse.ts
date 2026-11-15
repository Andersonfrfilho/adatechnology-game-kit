/**
 * The push a blast gives a standing body, from the physics of the blast wave and not from a game coupling: the impulse of the wave per square metre at a distance from a charge of
 * `tnt` kg of TNT equivalent (Kinney and Graham's fit of the side-on impulse, scaled by the cube root of the charge), reflected on the body, over the area the body shows the wave,
 * divided by its mass. A hand grenade at 3 m gives a person a few tenths of a metre per second; what floors that person is the fragments, not the wave. A big charge close throws.
 */

/** The numbers of the body a blast wave pushes. All have a default for a standing adult. */
export interface BlastImpulseOptions {
  /** Square metres of the body the wave meets: about 1.75 m tall by 0.4 m wide (default 0.7). */
  readonly bodyArea?: number
  /** How much of the push goes up: the direction is `(away, lift)` normalised (default 0.15: the wave runs along the ground). */
  readonly lift?: number
  /** Below this speed (m/s) the body does not move (default 0.3). */
  readonly minSpeed?: number
  /**
   * Kilograms of TNT per joule of the blast `energy`, for a blast that does not say its charge (`BlastSource.tnt`). Default 0.24 / 200000: the arsenal's energy scale, where the M67 (180 g
   * of Composition B, 0.24 kg of TNT) is 200 kJ. It is a game equivalence for blasts without a charge, not a physical constant.
   */
  readonly tntPerJoule?: number
}

export const DEFAULT_BLAST_IMPULSE: Readonly<Required<BlastImpulseOptions>> = { bodyArea: 0.7, lift: 0.15, minSpeed: 0.3, tntPerJoule: 0.24 / 200000 }

/** Closest distance (m) the fit is read at by default: inside it the charge is in contact and the body is torn apart anyway (a caller that loads a part next to the charge passes a smaller `nearest`). */
const NEAREST = 0.3

/**
 * Side-on (incident) specific impulse of the wave, in Pa·s, at `distance` metres from `tnt` kg of TNT in free air: Kinney and Graham, "Explosive Shocks in Air" (1985),
 * `I/W^(1/3) = 0.067 sqrt(1 + (Z/0.23)^4) / (Z^2 (1 + (Z/1.55)^3)^(1/3))` bar·ms per kg^(1/3), with the scaled distance `Z = R / W^(1/3)`.
 */
export function sideOnImpulse(tnt: number, distance: number, nearest = NEAREST): number {
  if (!(tnt > 0)) return 0
  const w3 = Math.cbrt(tnt)
  const z = Math.max(distance, nearest) / w3
  // products, not `**` past 2: V8 gives `x ** 3` a different last bit on Node 22 and 24, and the goldens must agree on both
  const near = (z / 0.23) * (z / 0.23)
  const far = z / 1.55
  const scaled = (0.067 * Math.sqrt(1 + near * near)) / (z * z * Math.cbrt(1 + far * far * far))
  return scaled * w3 * 100 // bar·ms to Pa·s
}

/** Sea-level atmospheric pressure, Pa. */
const ATMOSPHERE = 101325

/**
 * Peak side-on (incident) overpressure of the wave, in Pa, at `distance` metres from `tnt` kg of TNT in free air: Kinney and Graham, "Explosive Shocks in Air" (1985),
 * `Ps/Pa = 808 (1 + (Z/4.5)^2) / (sqrt(1 + (Z/0.048)^2) sqrt(1 + (Z/0.32)^2) sqrt(1 + (Z/1.35)^2))`, with the scaled distance `Z = R / W^(1/3)` (m/kg^(1/3)).
 * What a wall takes from a blast is read against it: about 7 kPa cracks plaster and breaks windows, 14 to 20 kPa knocks parts of a brick wall out, 35 kPa and over brings an
 * unreinforced brick wall down (Glasstone and Dolan, "The Effects of Nuclear Weapons", 1977, table 5.139; UFC 3-340-02).
 */
export function sideOnOverpressure(tnt: number, distance: number, nearest = NEAREST): number {
  if (!(tnt > 0)) return 0
  const z = Math.max(distance, nearest) / Math.cbrt(tnt)
  const ratio = (808 * (1 + (z / 4.5) ** 2)) / (Math.sqrt(1 + (z / 0.048) ** 2) * Math.sqrt(1 + (z / 0.32) ** 2) * Math.sqrt(1 + (z / 1.35) ** 2))
  return ratio * ATMOSPHERE
}

/**
 * The impulse per square metre a body facing the wave takes, Pa·s: the side-on impulse reflected. The reflection doubles a weak wave and grows up to about six times close to the charge,
 * where the wave is strong (the ratio of reflected to side-on impulse of the Kingery-Bulmash charts, fitted as `2 + 4 / (1 + Z^2)`).
 */
export function bodyImpulse(tnt: number, distance: number): number {
  if (!(tnt > 0)) return 0
  const z = Math.max(distance, NEAREST) / Math.cbrt(tnt)
  return sideOnImpulse(tnt, distance) * (2 + 4 / (1 + z * z))
}

/** The speed (m/s) a blast wave gives a free body of `mass` kg at `distance` metres from `tnt` kg of TNT, `reach` (0..1) of it getting through what stands in the way. */
export function blastBodySpeed(tnt: number, distance: number, mass: number, reach = 1, options: BlastImpulseOptions = {}): number {
  const area = options.bodyArea ?? DEFAULT_BLAST_IMPULSE.bodyArea
  return (bodyImpulse(tnt, distance) * area * Math.max(0, reach)) / Math.max(mass, 1)
}
