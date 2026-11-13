import type { MasonryUnit } from '../masonry-units'

/** NBR 16868-1: partial factor γm of the masonry in compression. */
export const MASONRY_GAMMA = 2
/** NBR 8681, normal combination: γg = 1.4 on the permanent loads and γq = 1.4 on the variable ones (so N_d = 1.4 (G + Q)). */
export const LOAD_GAMMA = 1.4
/** f_pk / f_bk of a hollow concrete block prism, ungrouted, both on the gross area (NBR 16868-1 practice: 0.7 to 0.8 at these classes). */
export const PRISM_EFFICIENCY = 0.7
/** NBR 16868-1: the characteristic strength of the wall is 0.7 of the prism's, f_k = 0.7 f_pk. */
export const WALL_OVER_PRISM = 0.7
/** NBR 16868-1: the slenderness λ = h_ef / t_ef of an unreinforced bearing wall is at most 24 (30 when the wall is designed as reinforced). */
export const MAX_WALL_SLENDERNESS = 24
/** Most metres between grouted cores the validator accepts (NBR 16868 practice in houses: 1.2 to 2 m). */
export const MAX_GROUT_SPACING = 2
/** The bar of the kit's structural houses in each grouted core: one Ø 12.5 mm (CA-50), metres. */
export const GROUT_BAR = 0.0125
/** Least diameter of the bar in a grouted core, metres (construction bar of structural masonry: one Ø 10 mm). */
export const MIN_GROUT_BAR = 0.01
/** Most of a grouted cell the steel may fill (NBR 16868-1: the bars take at most 8 % of the cell they are grouted in). */
export const MAX_STEEL_IN_CELL = 0.08
/** EN 1996-1-1 6.1.2.2: the eccentricity at the top of a wall is at least 5 % of its thickness. */
export const MIN_ECCENTRICITY_RATIO = 0.05
/** EN 1996-1-1 5.5.1.1: the initial (accidental) eccentricity is h_ef / 450. */
export const INITIAL_ECCENTRICITY_DIVISOR = 450
/** A slab bearing on one side of a wall loads it a third of the bearing in from the inner face: t/2 - t/3 = t/6 off its axis. */
export const ONE_SIDED_SLAB_ECCENTRICITY = 1 / 6
/** NBR 16868-1: a wall interlocked into another at a corner or a T (direct bond) works with it as a flange up to 6 times its thickness each side. */
export const FLANGE_THICKNESSES = 6
/** g, m/s². */
export const GRAVITY = 9.81

/** Design compressive strength of the masonry of `unit`, on the gross area, Pa: f_d = 0.7 η f_bk / γm (f_bk of NBR 6136 is on the gross area). */
export const designStrength = (unit: MasonryUnit): number => (WALL_OVER_PRISM * PRISM_EFFICIENCY * unit.fbk * 1e6) / MASONRY_GAMMA

/** Gross area of `length` metres of wall, m²: the thickness of the unit over the length (holes included, as f_bk and f_pk are). */
export const grossArea = (length: number, unit: MasonryUnit): number => length * unit.width
/** Net area of `length` metres of wall, m²: the shells and webs of the units only (`solid` of the gross). */
export const netArea = (length: number, unit: MasonryUnit): number => length * unit.width * unit.solid
/** The net-area strength of the unit, MPa: the same block crushes at f_bk on its gross area, at f_bk / solid on what is solid of it. */
export const netStrength = (unit: MasonryUnit): number => unit.fbk / unit.solid

/** NBR 16868-1: the effective height of a wall braced at its top by a slab or a bond beam is its height; a wall free at the top, twice it. */
export const effectiveHeight = (height: number, bracedAtTop: boolean): number => (bracedAtTop ? height : 2 * height)
/** NBR 16868-1: λ = h_ef / t_ef, t_ef the thickness of the unit (no plaster, no stiffener counted). */
export const slendernessOf = (effective: number, thickness: number): number => effective / thickness
/** NBR 16868-1: the reduction of the compressive strength of a wall by its slenderness, R = 1 - (λ / 40)³. */
export const slendernessReduction = (slenderness: number): number => 1 - (slenderness / 40) ** 3

/**
 * Eccentricity at the top of a wall, metres: the share of the load a slab brings on one side only, `t/6` off the axis, the initial eccentricity
 * h_ef / 450, and at least 0.05 t (EN 1996-1-1 6.1.2.2; NBR 16868-1 asks the eccentric load be considered and does not give the simplified factor).
 */
export function topEccentricity(params: { readonly thickness: number; readonly effective: number; readonly oneSidedShare: number }): number {
  const { thickness, effective, oneSidedShare } = params
  const e = oneSidedShare * thickness * ONE_SIDED_SLAB_ECCENTRICITY + effective / INITIAL_ECCENTRICITY_DIVISOR
  return Math.max(e, MIN_ECCENTRICITY_RATIO * thickness)
}

/** EN 1996-1-1 6.1.2.2: the capacity factor at the top of a wall, Φ = 1 - 2 e / t. */
export const eccentricityFactor = (eccentricity: number, thickness: number): number => Math.max(0, 1 - (2 * eccentricity) / thickness)

/** Cross-section of one cell of `unit`, m² (a hollow block has two cells across its length). */
export const cellArea = (unit: MasonryUnit): number => (unit.width * unit.length * (1 - unit.solid)) / 2
/** Area of a round bar of `diameter` metres, m². */
export const barArea = (diameter: number): number => (Math.PI * diameter * diameter) / 4
