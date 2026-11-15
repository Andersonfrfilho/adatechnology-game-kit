import type { MaterialId } from '@adatechnology/game-contracts'

/** What a wall of the unit can be: closing a concrete frame (alvenaria de vedação) or carrying the building itself (alvenaria estrutural, NBR 16868). */
export const MASONRY_USE = { SEALING: 'sealing', STRUCTURAL: 'structural' } as const
export type MasonryUse = (typeof MASONRY_USE)[keyof typeof MASONRY_USE]

/**
 * How a masonry house stands. `confined` (alvenaria de vedação confinada): the units close the walls and a concrete frame carries the building (pillars at the
 * ends, corners, junctions and openings, bond beam, lintels). `structural` (alvenaria estrutural, NBR 16868): the walls are the structure, with grout and
 * bars in the cores of the units; it is declared for the contract and not built yet (see the README of the package).
 */
export const MASONRY_SYSTEM = { CONFINED: 'confined', STRUCTURAL: 'structural' } as const
export type MasonrySystem = (typeof MASONRY_SYSTEM)[keyof typeof MASONRY_SYSTEM]

/** The U unit of the same family (canaleta): bond beams and lintels are cast in a course of it, as wide as the wall's units. */
export interface ChannelUnit {
  readonly id: string
  /** Along the wall, metres. */
  readonly length: number
  readonly height: number
  /** kg. */
  readonly mass: number
}

/** A masonry unit as it is sold: its real sizes, what it is made of and what it can be used for. */
export interface MasonryUnit {
  readonly id: string
  readonly family: 'ceramic_block' | 'concrete_block' | 'solid_brick' | string
  readonly material: MaterialId
  /** Across the wall, metres (the wall's core). */
  readonly width: number
  /** One course, metres (without the mortar joint). */
  readonly height: number
  /** Along the wall, metres (without the mortar joint). */
  readonly length: number
  /** kg of one unit. */
  readonly mass: number
  readonly uses: readonly MasonryUse[]
  /** Characteristic compressive strength of the unit on its gross area, MPa (NBR 15270 for ceramic, NBR 6136 for concrete). */
  readonly fbk: number
  /** Share of the unit that is solid (holes left out), 0..1. */
  readonly solid: number
  /** The wall assembly of `game-destruction` a wall of it breaks as. */
  readonly assembly: string
  readonly channel?: ChannelUnit
}
