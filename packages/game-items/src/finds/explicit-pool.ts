import type { ItemRules } from '../rules-types'
import type { FindState } from '../rules-types'
import type { PoolEntry } from '../types'

import type { FindsQuery } from './types'

export interface PoolPick {
  itemId: string
  count: number
  /** The pool entry it came from; none for the junk an abandoned container leaves. */
  entry?: PoolEntry
}

interface Candidate {
  entry: PoolEntry
  weight: number
}

/** Draws without replacement by weight (the viewer's `ordemPonderada`): one draw per candidate, all of them, before anything is cut. */
const weightedOrder = (candidates: readonly Candidate[], random: () => number): Candidate[] => {
  const remaining = [...candidates]
  const ordered: Candidate[] = []
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, candidate) => sum + candidate.weight, 0)
    let x = random() * total
    let index = 0
    for (; index < remaining.length - 1; index++) {
      x -= (remaining[index] as Candidate).weight
      if (x < 0) break
    }
    ordered.push(...remaining.splice(index, 1))
  }
  return ordered
}

const countFor = (pool: readonly PoolEntry[], state: FindState, footprint: number, query: FindsQuery, rules: ItemRules): number => {
  const settings = rules.finds.pool
  const base = Math.max(settings.min, Math.min(settings.max, Math.round(settings.offset + footprint * settings.perSquareMetre + query.rng() * settings.jitter)))
  if (state === 'fortified') return Math.min(pool.length, base + settings.fortifiedExtra)
  if (state === 'abandoned') return query.rng() < settings.abandonedEmptyChance ? 0 : settings.abandonedKept
  return base
}

/**
 * Port of the 3D house viewer's `sorteiaConteudo` (visor-casas-3d.js L10837-10863) over a pool of what a kind of furniture holds.
 *
 * Order of the random draws, the contract the golden test holds: one for the count (`base`); for an abandoned container one more (empty or not); then a full
 * weighted order of the pool (one draw per entry, before the cut to the count); then one per kept entry for its quantity; and only for an abandoned and empty
 * container one last draw for the junk. Fortified: more entries, supplies weigh x2.5 and give +1. Abandoned: 40% empty, otherwise one entry, plus junk and,
 * in a fridge or freezer, spoiled food.
 */
export const rollExplicitPool = (pool: readonly PoolEntry[], state: FindState, query: FindsQuery, rules: ItemRules): PoolPick[] => {
  const settings = rules.finds.pool
  const n = countFor(pool, state, query.footprint ?? settings.defaultFootprint, query, rules)
  const isFortified = state === 'fortified'
  const candidates = pool.map((entry) => ({ entry, weight: isFortified && entry.isSupply ? entry.weight * settings.supplyWeight : entry.weight }))

  const picks: PoolPick[] = []
  for (const { entry } of weightedOrder(candidates, query.rng).slice(0, n)) {
    const [low, high] = entry.qty
    const bonus = isFortified && entry.isSupply ? settings.supplyExtraQty : 0
    picks.push({ itemId: entry.item, count: low + Math.floor(query.rng() * (high - low + 1)) + bonus, entry })
  }
  if (state === 'abandoned') {
    if (picks.length === 0 && query.rng() < settings.junkChance) picks.push({ itemId: settings.junkItem, count: 1 })
    if (settings.coldContainers.includes(query.key ?? query.container)) picks.push({ itemId: settings.spoiledFoodItem, count: 1 })
  }
  return picks
}
