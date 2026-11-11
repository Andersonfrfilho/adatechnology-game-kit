import { MIN_PILLAR_AREA, MIN_PILLAR_SIDE } from '../validate/codes'
import { MASONRY_USE } from './types'
import type { MasonrySystem, MasonryUnit } from './types'

/** Render on each face of a masonry wall, metres (1.5 to 2 cm in practice). */
export const PLASTER_PER_FACE = 0.015
/** Mortar joint between units, metres. */
export const MORTAR_JOINT = 0.01
/** NBR 6118 13.2.3: from this side on a pillar takes no extra factor γn on its loads. */
export const NBR_FULL_PILLAR_SIDE = 0.19
const SECTION_STEP = 0.05

const ceilTo = (value: number, step: number): number => Math.ceil(value / step - 1e-9) * step
const round2 = (value: number): number => Math.round(value * 100) / 100

/** The finished thickness of a wall of `unit`: the unit laid along the wall and the render on both faces. */
export const wallThicknessOf = (unit: MasonryUnit): number => round2(unit.width + 2 * PLASTER_PER_FACE)

/**
 * The section of a confined-masonry pillar in a wall of `unit`, as it is cast (the units are its form): across, the unit's width (never under the 14 cm of
 * NBR 6118); along the wall, what the 360 cm² of area asks, in steps of 5 cm (a 14 cm block gives 14 x 30, a 19 cm one 19 x 20).
 */
export function pillarSectionOf(unit: MasonryUnit): { readonly across: number; readonly along: number } {
  const across = Math.max(unit.width, MIN_PILLAR_SIDE)
  return { across, along: round2(Math.max(across, ceilTo(MIN_PILLAR_AREA / across, SECTION_STEP))) }
}

/** NBR 6118 13.2.3: the factor γn the loads of a pillar whose least side is `side` (14 to 19 cm) are multiplied by; 1 from 19 cm on. */
export const pillarLoadFactor = (side: number): number => (side >= NBR_FULL_PILLAR_SIDE - 1e-9 ? 1 : round2(1.95 - 0.05 * Math.round(side * 100)))

/** Whether `unit` can build a house of `system` (a structural wall needs a unit graded for it). */
export const unitServes = (unit: MasonryUnit, system: MasonrySystem): boolean =>
  unit.uses.includes(system === 'structural' ? MASONRY_USE.STRUCTURAL : MASONRY_USE.SEALING)
