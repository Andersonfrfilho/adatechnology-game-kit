import { LOOT_POOLS } from './data'
import type { FindStack, FindsProvider, FindsQuery, LootEntry } from './types'

export type ForceFindsOptions = {
  /** Pools by force id; the default is the ones of the pack. */
  readonly pools?: Readonly<Record<string, readonly LootEntry[]>>
  /** Replaces the chance of an entry (by item id), for a game that wants other odds. */
  readonly chanceOf?: (entry: LootEntry) => number
}

/**
 * What a trooper of a force carries, in the shape of the `FindsProvider` of the floorplan: the pool is `query.key`, or `query.container` when no key is
 * given. Every entry is drawn once, in the order of the pool, from the generator of the query; an unknown pool is empty.
 */
export const createForceFinds = (options: ForceFindsOptions = {}): FindsProvider => {
  const pools = options.pools ?? LOOT_POOLS
  return {
    findsFor(query: FindsQuery): readonly FindStack[] {
      const pool = pools[query.key ?? query.container] ?? []
      return pool.filter((entry) => query.rng() < (options.chanceOf?.(entry) ?? entry.chance)).map((entry) => ({ itemId: entry.itemId, count: 1 }))
    },
  }
}
