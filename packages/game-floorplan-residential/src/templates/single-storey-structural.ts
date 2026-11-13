import type { TemplateDef } from '@adatechnology/game-floorplan'

import { singleStoreyA } from './single-storey-a'

/**
 * House type A in structural masonry (NBR 16868): the same plan laid in 14 x 19 x 39 concrete blocks of the 6 MPa class (NBR 6136): its piers between
 * openings take more than the 4 MPa class does under the design load of NBR 16868. The walls carry the house, with grouted
 * cores and bars in the corners, the junctions, beside the openings and every 1.6 m, the bond beam and lintels cast in channel blocks, on the 20 cm module
 * of the block; no concrete pillars.
 */
export const singleStoreyStructural: TemplateDef = {
  ...singleStoreyA,
  id: 'single_storey_structural',
  masonryUnit: 'concrete_block_14_fbk6',
  masonrySystem: 'structural',
}
