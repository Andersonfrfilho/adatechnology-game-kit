import type { ItemsCatalog } from '../catalog-types'
import type { ItemCategory } from '../types'

import { scaleCount } from './depletion'
import { rarityWeight, rollableItems } from './rarity-pool'
import type { FindsQuery } from './types'

const pickCategory = (weights: Readonly<Record<ItemCategory, number>>, random: () => number): ItemCategory | undefined => {
  let remaining = random()
  const categories = Object.keys(weights)
  for (const category of categories) {
    remaining -= weights[category] as number
    if (remaining <= 0) return category
  }
  return categories[0]
}

/**
 * Port of the team game's `rollItems` (jogo.js L68796-68812) on the container table (`CONT_TAB`) and the rarity weights (`RAR_W`).
 *
 * Order of the random draws, the contract the golden test holds: one for the count; then for each stack one to pick the category, and (unless the category
 * has nothing to draw) one to pick the item among those of the place, by rarity weight. Nothing else draws. The count is scaled by the day and the region
 * after it is drawn, so day 0 gives exactly the game's rolls. Returns the item ids, one per stack.
 */
export const rollByCategory = (catalog: ItemsCatalog, query: FindsQuery): string[] => {
  const { rules } = catalog
  const table = catalog.containers.get(query.container) ?? catalog.containers.get(rules.finds.fallbackContainer)
  if (!table) return []
  const [low, high] = table.count ?? [0, 0]
  const drawn = low + Math.floor(query.rng() * (high - low + 1))
  const count = scaleCount(drawn, { place: query.place, day: query.day ?? 0, ...(query.region === undefined ? {} : { region: query.region }) }, rules)
  const weights = table.categories ?? table.categoriesByPlace?.[query.place] ?? table.categoriesByPlace?.['*']
  if (!weights) return []

  const picked: string[] = []
  for (let stack = 0; stack < count; stack++) {
    const category = pickCategory(weights, query.rng)
    const pool = category === undefined ? [] : rollableItems(catalog, category, query.place)
    if (pool.length === 0) continue
    const total = pool.reduce((sum, item) => sum + rarityWeight(catalog, item), 0)
    let remaining = query.rng() * total
    for (const item of pool) {
      remaining -= rarityWeight(catalog, item)
      if (remaining <= 0) {
        picked.push(item.id)
        break
      }
    }
  }
  return picked
}
