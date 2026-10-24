import { applyPatches, deepMerge, mergeById, removeIds } from '@adatechnology/game-contracts'

import { ITEM_CATEGORIES } from './categories'
import type { ItemsCatalog, ItemsOptions } from './catalog-types'
import { checkItems, findDuplicateIds } from './check-items'
import { DEFAULT_RULES } from './rules'
import type { RecipeDef } from './recipe-types'
import type { ContainerDef, ItemDef, PlaceDef, PoolEntry } from './types'
import type { UseEffectDef } from './use-types'

const LITRES_PER_CUBIC_METRE = 1000

/** Fills what a pack leaves out: the volume comes from the size. */
const withDerivedFields = (item: ItemDef): ItemDef => (item.volume === undefined ? { ...item, volume: item.size[0] * item.size[1] * item.size[2] * LITRES_PER_CUBIC_METRE } : item)

const buildPools = (options: ItemsOptions, packs: NonNullable<ItemsOptions['packs']>): Map<string, readonly PoolEntry[]> => {
  const pools = new Map<string, readonly PoolEntry[]>()
  for (const source of [...packs, options]) for (const [key, entries] of Object.entries(source.pools ?? {})) pools.set(key, entries)
  const problems: string[] = []
  for (const source of [...packs, options]) {
    for (const [alias, key] of Object.entries(source.poolAliases ?? {})) {
      const entries = pools.get(key)
      if (entries) pools.set(alias, entries)
      else problems.push(`pool alias "${alias}" points to unknown pool "${key}"`)
    }
  }
  if (problems.length > 0) throw new Error(`game-items: the catalog is not consistent:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  return pools
}

const groupBy = (items: Iterable<ItemDef>, keysOf: (item: ItemDef) => readonly string[]): Map<string, ItemDef[]> => {
  const groups = new Map<string, ItemDef[]>()
  for (const item of items) for (const key of keysOf(item)) groups.set(key, [...(groups.get(key) ?? []), item])
  return groups
}

/**
 * Create the catalog. Order: the packs in order (added or replaced by id), then `patch`, then `remove`, then `include`; categories, places and
 * containers are those of the packs plus the options, by id. Every inconsistency found is reported in one error.
 */
export const createItems = (options: ItemsOptions = {}): ItemsCatalog => {
  const packs = options.packs ?? []
  const items = mergeById([] as ItemDef[], packs.flatMap((pack) => pack.items))
  applyPatches<ItemDef>(items, options.patch)
  removeIds(items, options.remove)
  if (options.include) for (const [id, item] of items) if (!options.include(item)) items.delete(id)
  for (const [id, item] of items) items.set(id, withDerivedFields(item))

  const categories = mergeById(ITEM_CATEGORIES, [...packs.flatMap((pack) => pack.categories ?? []), ...(options.categories ?? [])])
  const places = mergeById<PlaceDef>([], [...packs.flatMap((pack) => pack.places ?? []), ...(options.places ?? [])])
  const containers = mergeById<ContainerDef>([], [...packs.flatMap((pack) => pack.containers ?? []), ...(options.containers ?? [])])
  const useEffects = [...mergeById<UseEffectDef>([], [...packs.flatMap((pack) => pack.useEffects ?? []), ...(options.useEffects ?? [])]).values()]
  const recipes = mergeById<RecipeDef>([], [...packs.flatMap((pack) => pack.recipes ?? []), ...(options.recipes ?? [])])
  const pools = buildPools(options, packs)
  const rules = deepMerge(DEFAULT_RULES, options.rules)

  const problems = [
    ...packs.flatMap((pack) => findDuplicateIds(`item in pack "${pack.id}"`, pack.items)),
    ...findDuplicateIds('category', options.categories),
    ...findDuplicateIds('place', options.places),
    ...findDuplicateIds('container', options.containers),
    ...findDuplicateIds('use effect', options.useEffects),
    ...findDuplicateIds('recipe', options.recipes),
    ...checkItems({ items, categories, places, containers, rules }),
  ]
  if (problems.length > 0) throw new Error(`game-items: the catalog is not consistent:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)

  const byCategory = groupBy(items.values(), (item) => [item.category])
  const byPlace = groupBy(items.values(), (item) => item.finds?.places ?? [])
  const byTag = groupBy(items.values(), (item) => item.tags ?? [])

  return {
    items,
    categories,
    places,
    containers,
    pools,
    useEffects,
    recipes,
    rules,
    has: (id) => items.has(id),
    get(id) {
      const item = items.get(id)
      if (!item) throw new Error(`game-items: unknown item "${id}"`)
      return item
    },
    list: () => [...items.values()],
    byCategory: (category) => [...(byCategory.get(category) ?? [])],
    byPlace: (place) => [...(byPlace.get(place) ?? [])],
    byTag: (tag) => [...(byTag.get(tag) ?? [])],
  }
}
