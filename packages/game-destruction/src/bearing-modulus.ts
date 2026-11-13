import { MATERIALS } from './materials'
import type { MaterialId, PartUnits, StructureRole } from './types'

/**
 * Young's modulus of laid masonry (GPa): NBR 16868 takes E = 800 f_pk, about 2.2 GPa for a hollow block of 4 MPa (prism at 0.7 of it), the order of the
 * catalogue's brick (2.35 GPa). The units' own material (a concrete block is concrete at 28 GPa) is not what the wall shortens by: its mortar joints are.
 */
export const LAID_MASONRY_GPA = 2.35

const MODULUS = new Map(MATERIALS.map((material) => [material.id, material.strength?.elasticGPa]))

/** Units laid in a mortar other than their own material (brick, block): a cast part keeps its units only as the way it breaks (`mortar` is itself). */
export const isLaidUnits = (material: MaterialId, units?: PartUnits): boolean => !!units && units.mortar !== material

/** What a part is laid of and how it rests: its units, and whether it is bedded in mortar on what carries it (one brick or block laid on its own). */
export interface BearingOf {
  readonly units?: PartUnits
  readonly bedded?: boolean
}

/**
 * How stiff a support is under a load that rests on it, as its Young's modulus (GPa): laid masonry (units in mortar, or a part bedded in mortar)
 * `LAID_MASONRY_GPA`, anything else its material's (`strength.elasticGPa`), undefined when the material has none. The load path shares a part's load
 * among its carriers by contact times this (`SupportGraph.stiffness` of game-load-path); the destruction world and the structure that sizes a building read
 * it here.
 */
export const bearingModulus = (material: MaterialId, bearing: BearingOf = {}): number | undefined =>
  bearing.bedded || isLaidUnits(material, bearing.units) ? LAID_MASONRY_GPA : MODULUS.get(material)

/** A part that stands up the storey (pillar, wall, partition): it shortens by its own stiffness; a lying one (beam, lintel, slab) by what carries it. */
export const isUpright = (role: StructureRole | undefined): boolean => role === 'column' || role === 'wall' || role === 'partition'
