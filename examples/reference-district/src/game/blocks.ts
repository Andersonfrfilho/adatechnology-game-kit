import type { Block } from '@adatechnology/game-urban'
import type { PlanRect } from '@adatechnology/game-urban'

import { rectsOverlap } from './geometry'
import type { Lot, Missing } from './site'

/** A missing piece shorter than this is a mark on the ground, not a building, and does not take a block from the city. */
export const MIN_MISSING_HEIGHT = 2

const blockRect = (block: Block): PlanRect => [block.x - block.size[0] / 2, block.z - block.size[1] / 2, block.x + block.size[0] / 2, block.z + block.size[1] / 2]

/**
 * The blocks the city fills with its own buildings: the ones no lot of the site and no missing building stands on. A lot is a drawn house (a plan of the floorplan
 * packages) and a missing piece is a warning box, so the silhouette of the block gives way to both: the same decision as a house provider that refuses a request inside a lot.
 */
export function blocksToFill(blocks: readonly Block[], site: { readonly lots: readonly Lot[]; readonly missing: readonly Missing[] }): Block[] {
  const taken = [...site.lots.map((lot) => lot.rect), ...site.missing.filter((entry) => entry.height >= MIN_MISSING_HEIGHT).map((entry) => entry.rect)]
  return blocks.filter((block) => !taken.some((rect) => rectsOverlap(blockRect(block), rect)))
}
