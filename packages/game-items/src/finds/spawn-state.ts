import type { ItemsCatalog } from '../catalog-types'
import type { ItemDef } from '../types'

import type { FindData, FindsQuery } from './types'

const WEARING_DURABILITY = ['condition', 'hits', 'cuts']

const hasCondition = (item: ItemDef): boolean => item.protection !== undefined || item.weapon !== undefined || WEARING_DURABILITY.includes(item.durability?.kind ?? '')

const between = (range: readonly [number, number], random: () => number): number => range[0] + random() * (range[1] - range[0])

/** Age of food when it turns up: the days since the outbreak plus 0 to 60% of the shelf life. On day 0 that is the normal turnover of the shelf. One draw. */
export const spawnAgeDays = (item: ItemDef, outbreakDays: number, random: () => number, catalog: ItemsCatalog): number | undefined =>
  item.shelfLife === undefined ? undefined : outbreakDays + between(catalog.rules.spawn.ageShare, random) * item.shelfLife

const isRetailStock = (query: FindsQuery, catalog: ItemsCatalog): boolean => {
  const { spawn } = catalog.rules
  const isRetail = spawn.retailNew && (query.day ?? 0) <= 0 && spawn.retailPlaces.includes(query.place)
  return isRetail && (spawn.retailContainers.length === 0 || spawn.retailContainers.includes(query.container))
}

/**
 * The state an item has when it turns up, drawn after all the stacks of a container were chosen (so the choice itself matches the sources): food age, condition
 * by rarity (100 for shop stock on day 0), battery charge and how full a jerrycan is. Draws in that order, only what applies.
 */
export const spawnData = (item: ItemDef, query: FindsQuery, catalog: ItemsCatalog): FindData | undefined => {
  const { spawn } = catalog.rules
  const data: { ageDays?: number; condition?: number; charge?: number; fill?: number } = {}
  const ageDays = spawnAgeDays(item, query.day ?? 0, query.rng, catalog)
  if (ageDays !== undefined) data.ageDays = ageDays
  if (hasCondition(item)) data.condition = isRetailStock(query, catalog) ? 100 : Math.round(between(spawn.condition[item.rarity], query.rng))
  if (item.charge) data.charge = between(spawn.charge, query.rng)
  if (spawn.fillable.includes(item.id)) data.fill = between(spawn.fill, query.rng)
  return Object.keys(data).length > 0 ? data : undefined
}
