import type { LootTable, LootTables } from '@adatechnology/game-interactables'

import type { ItemsCatalog } from '../catalog-types'
import type { ContainerDef } from '../types'

import { depletionFactor } from './depletion'
import { rarityWeight, rollableItems } from './rarity-pool'

export interface LootTablesQuery {
  place: string
  /** Outbreak days; 0 is the normal world. */
  day?: number
  region?: string
}

const weightsOf = (container: ContainerDef, place: string): Readonly<Record<string, number>> | undefined => container.categories ?? container.categoriesByPlace?.[place] ?? container.categoriesByPlace?.['*']

const tableFor = (catalog: ItemsCatalog, container: ContainerDef, query: LootTablesQuery): LootTable | undefined => {
  const weights = weightsOf(container, query.place)
  if (!weights) return undefined
  const entries = Object.entries(weights).flatMap(([category, categoryWeight]) => {
    const pool = rollableItems(catalog, category, query.place)
    const total = pool.reduce((sum, item) => sum + rarityWeight(catalog, item), 0)
    return total > 0 ? pool.map((item) => ({ type: item.id, weight: (categoryWeight * rarityWeight(catalog, item)) / total })) : []
  })
  const [low, high] = container.count ?? [0, 0]
  const region = query.region === undefined ? 1 : (catalog.rules.finds.regionMultiplier[query.region] ?? 1)
  const expected = ((low + high) / 2) * depletionFactor(query.place, query.day ?? 0, catalog.rules) * region
  return entries.length > 0 && high > 0 ? { fill: Math.min(1, expected / high), entries } : undefined
}

/**
 * The finds as the loot tables of `game-interactables`, for worlds that have no floorplan: one table per container of the place, named by the container id.
 * A table has one entry per rollable item, weighted by the container's category weight and the rarity (60/28/9/2.5). A slot is filled with probability
 * `fill` = expected count / most stacks, taking the container to have as many slots as its largest count; the day and the region scale the expected count.
 */
export const toLootTables = (catalog: ItemsCatalog, query: LootTablesQuery): LootTables => {
  const tables: LootTables = {}
  for (const container of catalog.containers.values()) {
    if (container.places && container.places.length > 0 && !container.places.includes(query.place)) continue
    const table = tableFor(catalog, container, query)
    if (table) tables[container.id] = table
  }
  return tables
}
