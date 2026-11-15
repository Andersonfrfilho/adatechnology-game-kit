import { MASONRY_USE } from './types'
import type { MasonryUnit } from './types'

const { SEALING, STRUCTURAL } = MASONRY_USE

/** The units of the kit: Brazilian masonry as it is sold (ceramic blocks of NBR 15270, concrete blocks of NBR 6136, the solid brick). */
const DEFAULT_UNITS: readonly MasonryUnit[] = [
  {
    id: 'ceramic_block_9', family: 'ceramic_block', material: 'brick', width: 0.09, height: 0.19, length: 0.29, mass: 4.2, uses: [SEALING], fbk: 1.5, solid: 0.45,
    assembly: 'brick_wall_plastered', channel: { id: 'ceramic_channel_9', length: 0.29, height: 0.19, mass: 3.6 },
  },
  {
    id: 'ceramic_block_14', family: 'ceramic_block', material: 'brick', width: 0.14, height: 0.19, length: 0.29, mass: 6.0, uses: [SEALING], fbk: 1.5, solid: 0.45,
    assembly: 'brick_wall_plastered', channel: { id: 'ceramic_channel_14', length: 0.29, height: 0.19, mass: 5.2 },
  },
  {
    id: 'ceramic_block_19', family: 'ceramic_block', material: 'brick', width: 0.19, height: 0.19, length: 0.29, mass: 8.0, uses: [SEALING], fbk: 1.5, solid: 0.45,
    assembly: 'brick_wall_plastered', channel: { id: 'ceramic_channel_19', length: 0.29, height: 0.19, mass: 7.0 },
  },
  {
    id: 'concrete_block_14', family: 'concrete_block', material: 'concrete', width: 0.14, height: 0.19, length: 0.39, mass: 11, uses: [SEALING, STRUCTURAL], fbk: 4, solid: 0.5,
    assembly: 'concrete_block_wall', channel: { id: 'concrete_channel_14', length: 0.39, height: 0.19, mass: 10 },
  },
  {
    id: 'concrete_block_19', family: 'concrete_block', material: 'concrete', width: 0.19, height: 0.19, length: 0.39, mass: 14, uses: [SEALING, STRUCTURAL], fbk: 4, solid: 0.5,
    assembly: 'concrete_block_wall', channel: { id: 'concrete_channel_19', length: 0.39, height: 0.19, mass: 13 },
  },
  // the solid brick has no U unit: its bond beams and lintels are cast in forms
  {
    id: 'solid_brick', family: 'solid_brick', material: 'brick', width: 0.1, height: 0.05, length: 0.2, mass: 1.9, uses: [SEALING, STRUCTURAL], fbk: 4, solid: 1,
    assembly: 'brick_wall_plastered',
  },
]

const UNITS = new Map<string, MasonryUnit>(DEFAULT_UNITS.map((unit) => [unit.id, unit]))

/** The catalog of masonry units: a game adds its own (or replaces one by its id) with `registerMasonryUnit`. */
export const MASONRY_UNITS: ReadonlyMap<string, MasonryUnit> = UNITS

export function registerMasonryUnit(unit: MasonryUnit): void {
  UNITS.set(unit.id, unit)
}

export function getMasonryUnit(id: string): MasonryUnit {
  const unit = UNITS.get(id)
  if (!unit) throw new Error(`Unknown masonry unit "${id}": register it with registerMasonryUnit`)
  return unit
}
