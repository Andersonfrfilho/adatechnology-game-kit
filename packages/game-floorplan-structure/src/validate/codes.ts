/** Stable codes of what `validateStructure` and `validateSpec` find wrong in a construction. */
export const STRUCTURAL_VIOLATION = {
  /** A pillar with no load path to the ground, or that starts above what it rests on. */
  PILLAR_NOT_GROUNDED: 'PILLAR_NOT_GROUNDED',
  /** A pillar of a masonry wall that stops short of the bond beam, or that the bond beam does not rest on. */
  PILLAR_DOES_NOT_REACH_BOND_BEAM: 'PILLAR_DOES_NOT_REACH_BOND_BEAM',
  /** A masonry wall that runs more than `MAX_PILLAR_SPACING` between two of its pillars. */
  WALL_SPAN_WITHOUT_PILLAR: 'WALL_SPAN_WITHOUT_PILLAR',
  /** A free end of a masonry wall (a door jamb, the end of a garden wall) with no pillar. */
  WALL_END_WITHOUT_PILLAR: 'WALL_END_WITHOUT_PILLAR',
  /** Two masonry walls meet at a corner with no pillar there. */
  CORNER_WITHOUT_PILLAR: 'CORNER_WITHOUT_PILLAR',
  /** Another wall meets a masonry wall inside its length (a T) with no pillar there. */
  WALL_JUNCTION_WITHOUT_PILLAR: 'WALL_JUNCTION_WITHOUT_PILLAR',
  /** A window or door in a masonry wall with no lintel (verga) over it. */
  OPENING_WITHOUT_LINTEL: 'OPENING_WITHOUT_LINTEL',
  /** A window in a masonry wall with no sill beam (contraverga) under it. */
  OPENING_WITHOUT_SILL: 'OPENING_WITHOUT_SILL',
  /** An exterior masonry wall with no bond beam (cinta de amarração) on top. */
  MISSING_BOND_BEAM: 'MISSING_BOND_BEAM',
  /** A ground-floor masonry wall standing on the soil with no ground beam (viga baldrame) or foundation under it. */
  MISSING_GROUND_BEAM: 'MISSING_GROUND_BEAM',
  /** A part with no load path down to the ground. */
  FLOATING_PART: 'FLOATING_PART',
  /** A concrete beam longer than a lintel that rests on masonry alone (no pillar, beam or slab carries it). */
  BEAM_ON_WEAK_MASONRY: 'BEAM_ON_WEAK_MASONRY',
  /** A beam resting on a beam shallower than itself (NBR 6118 18.3.7: the main beam of an indirect support is at least as deep as the beam it carries). */
  BEAM_ON_SHALLOWER_BEAM: 'BEAM_ON_SHALLOWER_BEAM',
  /** A concrete pillar or beam below the NBR 6118 minimum section, or a beam between point supports shallower than a tenth of its span. */
  CONCRETE_BELOW_MIN_SECTION: 'CONCRETE_BELOW_MIN_SECTION',
  /** A concrete pillar or beam with no steel (the construction has no rebar). */
  UNREINFORCED_CONCRETE: 'UNREINFORCED_CONCRETE',
  /** A brick or block wall laid in stack bond: the vertical joints line up and the wall splits along them. */
  UNBONDED_MASONRY: 'UNBONDED_MASONRY',
  /** A plastered brick wall without plaster on both faces. */
  MISSING_PLASTER: 'MISSING_PLASTER',
} as const

export type StructuralViolationCode = (typeof STRUCTURAL_VIOLATION)[keyof typeof STRUCTURAL_VIOLATION]

/** One thing a construction gets wrong: the code, the part (or opening) it is about and the rule it breaks, in words. */
export interface StructuralViolation {
  readonly code: StructuralViolationCode
  readonly part: string
  readonly message: string
}

/** Most metres a masonry wall runs between two pillars (confined masonry: 3 to 4 m; `WALL_PILLAR_SPACING` is 4). */
export const MAX_PILLAR_SPACING = 4
/**
 * NBR 6118 13.2.3: no side of a pillar under 14 cm (from 14 to 19 cm its loads take the factor γn, `pillarLoadFactor`), and at least 360 cm² of section: a
 * 14 cm pillar is at least 26 cm long.
 */
export const MIN_PILLAR_SIDE = 0.14
export const MIN_PILLAR_AREA = 0.036
/** NBR 6118 13.2.2: a beam at least 12 cm wide. */
export const MIN_BEAM_WIDTH = 0.12
/** A beam between point supports is at least a tenth of its span deep (pre-sizing of reinforced concrete beams, h = L/10). */
export const BEAM_DEPTH_RATIO = 10
/** A concrete beam that only masonry carries may be a lintel up to this span; a longer one needs pillars. */
export const MAX_LINTEL_ON_MASONRY = 3
