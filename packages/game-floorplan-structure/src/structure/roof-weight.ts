import type { MaterialId } from '@adatechnology/game-contracts'

import { densityOf } from '../density'
import { DEFAULT_COVERING_WEIGHT, ROOF_COVERINGS } from '../registry'
import type { Rect } from '../types'

/** kg that weigh one kN. */
const KG_PER_KN = 1000 / 9.81
/** Section of a rafter or of the chords and webs of a truss, metres: the 6 x 16 cm sawn timber (viga 6 x 16) of house roofs. */
export const ROOF_MEMBER_SECTION = 0.06 * 0.16

/** The surface of a pane over `aabb` sloping `rise` metres every `run` metres: its plan area over the cosine of the slope. */
export const slopedArea = (aabb: Rect, run: number, rise: number): number => (aabb[2] - aabb[0]) * (aabb[3] - aabb[1]) * (Math.hypot(run, rise) / Math.max(run, 1e-6))

/** kg of `covering` over `area` m² of sloped surface (`ROOF_COVERINGS` weight). */
export const coveringMass = (covering: string, area: number): number => area * (ROOF_COVERINGS.get(covering)?.weight ?? DEFAULT_COVERING_WEIGHT) * KG_PER_KN

/** kg of a rafter of `material` from the eave to the ridge: its 6 x 16 section over its sloped length. */
export const rafterMass = (material: MaterialId, run: number, rise: number): number => ROOF_MEMBER_SECTION * Math.hypot(run, rise) * densityOf(material)

/** kg of a coarse truss of `material` over `span`: the pair of rafters it stands for in the coarse detail (the same roof as the rafters of `panels`). */
export const trussMass = (material: MaterialId, span: number, rise: number): number => 2 * rafterMass(material, span / 2, rise)

/**
 * The mass option of a roof part: by its physics (`mass`), or, in the reproduction of the Visor de casas 3D (`visorSections`), as the team's golden
 * weighs it, a solid fraction of its box (`fill`).
 */
export const roofMassOption = (visorSections: boolean, mass: number, fill?: number): { mass: number } | { fill?: number } =>
  visorSections ? (fill === undefined ? {} : { fill }) : { mass }
