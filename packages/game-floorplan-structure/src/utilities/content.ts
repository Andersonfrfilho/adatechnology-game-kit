import type { FindStack } from '@adatechnology/game-floorplan'

import { CONTENT_TABLES, SUPPLY_GROUPS } from './content-tables'
import type { ContentEntry } from './content-tables'
import type { Rng } from './shared'

export interface ContentStack extends FindStack {
  group: string
  pickable: boolean
}

export interface ContentQuery {
  /** Category or type of the container (`fridge`, `kitchen_cabinet`, `overhead_cabinet`...). */
  container: string
  state: string
  rng: Rng
  /** Footprint of the container in m2. */
  footprint: number
}

/** How a state changes what a container holds: how many kinds, how likely each is, how many of each, and what is left over. */
export interface ContentStateRule {
  kinds(base: number, available: number, rng: Rng): number
  weight(entry: ContentEntry): number
  extraQuantity(entry: ContentEntry): number
  leftovers?(found: ContentStack[], container: string, rng: Rng): void
}

const FRIDGES = ['fridge', 'display_fridge', 'freezer']
const isSupply = (entry: ContentEntry): boolean => SUPPLY_GROUPS.includes(entry.group)

/** The normal world is the base; `fortified` and `abandoned` are the genre's rules, kept here until the item catalogue and the genre pack own them. */
export const CONTENT_STATES: Record<string, ContentStateRule> = {
  normal: { kinds: (base) => base, weight: (entry) => entry.weight, extraQuantity: () => 0 },
  fortified: { kinds: (base, available) => Math.min(available, base + 2), weight: (entry) => (isSupply(entry) ? entry.weight * 2.5 : entry.weight), extraQuantity: (entry) => (isSupply(entry) ? 1 : 0) },
  abandoned: {
    kinds: (_base, _available, rng) => (rng() < 0.4 ? 0 : 1),
    weight: (entry) => entry.weight,
    extraQuantity: () => 0,
    leftovers(found, container, rng) {
      if (found.length === 0 && rng() < 0.5) found.push({ itemId: 'scraps_and_papers', count: 1, pickable: false, group: 'trash' })
      if (FRIDGES.includes(container)) found.push({ itemId: 'spoiled_food', count: 1, pickable: false, group: 'trash' })
    },
  },
}

export function registerContentState(state: string, rule: ContentStateRule): void {
  CONTENT_STATES[state] = rule
}

/** Weighted draw without replacement. */
function weightedOrder<T extends { weight: number }>(candidates: T[], rng: Rng): T[] {
  const pool = candidates.slice()
  const out: T[] = []
  while (pool.length) {
    let x = rng() * pool.reduce((sum, c) => sum + c.weight, 0)
    let i = 0
    for (; i < pool.length - 1; i++) {
      x -= pool[i]!.weight
      if (x < 0) break
    }
    out.push(pool.splice(i, 1)[0]!)
  }
  return out
}

/** What a container holds in a state: a few kinds of thing from the table of its category, more of the useful ones when fortified, almost nothing when abandoned. */
export function contentOf(query: ContentQuery): ContentStack[] {
  const pool = CONTENT_TABLES[query.container]
  if (!pool) return []
  const rule = CONTENT_STATES[query.state] ?? CONTENT_STATES.normal!
  const { rng } = query
  const base = Math.max(2, Math.min(5, Math.round(1.5 + query.footprint * 3 + rng() * 1.5)))
  const kinds = rule.kinds(base, pool.length, rng)
  const found: ContentStack[] = []
  for (const candidate of weightedOrder(pool.map((entry) => ({ entry, weight: rule.weight(entry) })), rng).slice(0, kinds)) {
    const { entry } = candidate
    const count = entry.min + Math.floor(rng() * (entry.max - entry.min + 1)) + rule.extraQuantity(entry)
    found.push({ itemId: entry.itemId, count, pickable: entry.pickable, group: entry.group })
  }
  rule.leftovers?.(found, query.container, rng)
  return found
}

export const hasContent = (container: string): boolean => container in CONTENT_TABLES

