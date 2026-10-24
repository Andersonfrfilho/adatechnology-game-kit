import { deepMerge } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import type { ItemsCatalog } from '../catalog-types'
import type { ItemRules } from '../rules-types'

import { rollByCategory } from './category-roll'
import { rollExplicitPool } from './explicit-pool'
import { spawnData } from './spawn-state'
import type { FindStack, FindsProvider, FindsQuery } from './types'

export interface FindsProviderOptions {
  /** `team` (default): a container with an explicit pool in the catalog uses it; `none`: always the category roll. */
  pools?: 'team' | 'none'
  /** Changes to the `finds` and `spawn` rules for this provider. */
  rules?: DeepPartial<Pick<ItemRules, 'finds' | 'spawn'>>
}

/**
 * What a container holds, as the floorplan's `FindsProvider` asks it. A container with an explicit pool (`query.key` or the container id) draws from it
 * (port of the viewer); otherwise the category roll of the game draws on the container table. Every stack is chosen first, in the order of the sources, and
 * only then each gets its state (age, condition, charge, fill) from the same generator. Items the catalog no longer has (removed by a game) are dropped
 * after the draws, so the others do not change.
 */
export const createFindsProvider = (catalog: ItemsCatalog, options: FindsProviderOptions = {}): FindsProvider => {
  const rules = options.rules ? deepMerge(catalog.rules, options.rules) : catalog.rules
  const scoped: ItemsCatalog = rules === catalog.rules ? catalog : { ...catalog, rules }
  const usesPools = (options.pools ?? 'team') === 'team'

  const choose = (query: FindsQuery): FindStack[] => {
    const pool = usesPools ? (scoped.pools.get(query.key ?? query.container) ?? scoped.pools.get(query.container)) : undefined
    if (!pool) return rollByCategory(scoped, query).map((itemId) => ({ itemId, count: 1 }))
    return rollExplicitPool(pool, rules.finds.states[query.state] ?? 'normal', query, rules).map(({ itemId, count }) => ({ itemId, count }))
  }

  return {
    findsFor(query) {
      return choose(query)
        .filter((stack) => scoped.has(stack.itemId))
        .map((stack) => {
          const data = spawnData(scoped.get(stack.itemId), query, scoped)
          return data ? { ...stack, data } : stack
        })
    },
  }
}
