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
  /** A ground-floor masonry wall standing on the soil with no ground beam (viga baldrame) or foundation under it (structural masonry too: a strip footing or a raft). */
  MISSING_GROUND_BEAM: 'MISSING_GROUND_BEAM',
  /** A part declared to rest on another it does not touch in plan (a pillar pushed off the beam it is said to carry, a rafter over a terrace). */
  SUPPORT_WITHOUT_CONTACT: 'SUPPORT_WITHOUT_CONTACT',
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
  /** Structural masonry (NBR 16868) laid of a unit graded for sealing only. */
  UNIT_NOT_STRUCTURAL: 'UNIT_NOT_STRUCTURAL',
  /** Structural masonry with no grouted core in the first cell beside a window jamb (inside the masonry, within a module of the jamb). */
  OPENING_WITHOUT_GROUT: 'OPENING_WITHOUT_GROUT',
  /** Structural masonry: a beam bears across the wall with no grouted core under it (NBR 16868, local bearing under a concentrated load). */
  CONCENTRATED_LOAD_WITHOUT_GROUT: 'CONCENTRATED_LOAD_WITHOUT_GROUT',
  /** A concrete pillar in a wall of structural masonry (the wall is the structure). */
  PILLAR_IN_STRUCTURAL_WALL: 'PILLAR_IN_STRUCTURAL_WALL',
  /** A bearing wall of structural masonry whose slenderness λ = h_ef / t_ef passes 24 (NBR 16868-1, unreinforced). */
  WALL_TOO_SLENDER: 'WALL_TOO_SLENDER',
  /** Structural masonry off the coordination of its unit: a wall end or a window jamb off the module, or a sill or head off the courses. */
  OFF_MODULE: 'OFF_MODULE',
  /**
   * A pier of structural masonry (a stretch between openings, or the whole wall without them) whose design load N_d = 1.4 (G + Q) passes f_d A Φ at its
   * top (eccentricity of the slab) or f_d A R at mid-height (slenderness), A its gross area (NBR 16868-1, loads of NBR 6120).
   */
  MASONRY_OVERSTRESSED: 'MASONRY_OVERSTRESSED',
  /** A masonry wall (a bearing wall of structural masonry, an exterior wall of confined masonry, the masonry over a door) whose bond beam does not run over its whole length. */
  BOND_BEAM_NOT_CONTINUOUS: 'BOND_BEAM_NOT_CONTINUOUS',
  /** Structural masonry laid of a unit with no channel (U) unit: its bond beams and lintels cannot be cast in a reinforced course of the wall. */
  MISSING_CHANNEL_UNIT: 'MISSING_CHANNEL_UNIT',
  /** Structural masonry whose grouted cores have no bar, or a bar thinner than the construction minimum (`MIN_GROUT_BAR`). */
  GROUT_WITHOUT_BAR: 'GROUT_WITHOUT_BAR',
  /** Structural masonry whose bar fills more of its grouted cell than NBR 16868-1 allows (`MAX_STEEL_IN_CELL`): the grout cannot wrap it. */
  GROUT_STEEL_CONGESTED: 'GROUT_STEEL_CONGESTED',
  /** Two walls of structural masonry that meet at a corner or a T without interlocking: they do not touch, or their bond beams do not tie over the meeting. */
  JUNCTION_NOT_INTERLOCKED: 'JUNCTION_NOT_INTERLOCKED',
  /** Two grouted cores in the same cell (a corner or junction grouted by both walls that meet there): one cell counted and built twice. */
  GROUT_CORE_DOUBLED: 'GROUT_CORE_DOUBLED',
  /** A free concrete pillar whose slenderness λ = l_e √12 / b over its longest braced stretch passes 90 (NBR 6118 15.8: past 90 it needs second-order analysis with creep, which the kit does not do; 200 is the hard limit). */
  COLUMN_TOO_SLENDER: 'COLUMN_TOO_SLENDER',
  /** A concrete pillar standing on the soil with no footing under it (no pad of its own, no strip footing of a wall or ground beam). */
  PILLAR_WITHOUT_FOUNDATION: 'PILLAR_WITHOUT_FOUNDATION',
  /** A beam held at a single point (a mechanism): it needs two supports or a bearing along half its length. */
  BEAM_SINGLE_SUPPORT: 'BEAM_SINGLE_SUPPORT',
  /** An isolated footing that presses the soil past its allowable pressure: 1.05 N_k / A > σ_adm (NBR 6122). */
  SOIL_PRESSURE_EXCEEDED: 'SOIL_PRESSURE_EXCEEDED',
  /** A concrete pillar standing on infill masonry (a wall of confined masonry): it bears on a beam, a pillar or the foundation. */
  PILLAR_ON_INFILL: 'PILLAR_ON_INFILL',
  /** A rafter or truss that runs more than `MAX_ROOF_OVERHANG` past the last thing that holds it: a timber cantilever. */
  ROOF_OVERHANG_TOO_LONG: 'ROOF_OVERHANG_TOO_LONG',
  /** A concrete slab panel thinner than its loads ask (its finishes, live load and the roof on struts on it): deflection within span/250 and bending, NBR 6118. */
  SLAB_UNDERSIZED: 'SLAB_UNDERSIZED',
  /** A concrete pillar whose N_d and M_d (minimum eccentricity, second order by approximate curvature, NBR 6118 15.8) ask more than its section gives: ν past 0.8 or more than 4% of steel. */
  PILLAR_OVERLOADED: 'PILLAR_OVERLOADED',
  /** Two structural parts, not joined to each other, that occupy the same volume beyond a joint. */
  OVERLAPPING_PARTS: 'OVERLAPPING_PARTS',
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
/** NBR 6118 15.8.2: past λ = 90 a pillar needs second-order analysis with creep (the kit sizes none so: 90 is its limit; NBR 6118 never allows past 200). */
export const MAX_COLUMN_SLENDERNESS = 90
/** NBR 6118 13.2.2: a beam at least 12 cm wide. */
export const MIN_BEAM_WIDTH = 0.12
/** A beam between point supports is at least a tenth of its span deep (pre-sizing of reinforced concrete beams, h = L/10). */
export const BEAM_DEPTH_RATIO = 10
/** A concrete beam that only masonry carries may be a lintel up to this span; a longer one needs pillars. */
export const MAX_LINTEL_ON_MASONRY = 3
