import forcesData from './data/forces.json'
import loadoutsData from './data/loadouts.json'
import lootPoolsData from './data/loot-pools.json'
import ranksData from './data/ranks.json'
import type { Force, Loadout, LootEntry, RankData } from './types'

export const FORCES = forcesData as unknown as readonly Force[]
export const RANKS = ranksData as unknown as RankData
export const LOADOUTS = loadoutsData as unknown as Readonly<Record<string, Loadout>>
export const LOOT_POOLS = lootPoolsData as unknown as Readonly<Record<string, readonly LootEntry[]>>
