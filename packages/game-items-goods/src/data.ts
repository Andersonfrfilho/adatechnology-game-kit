import type { ArsenalItemRecord, CategoryDef, ContainerDef, ItemDef, PlaceDef, PoolEntry, RecipeDef, UseEffectDef } from '@adatechnology/game-items'

import ammoBoxesJson from './data/ammo-boxes.json'
import categoriesJson from './data/categories.json'
import containersJson from './data/containers.json'
import depletionJson from './data/depletion.json'
import housePoolsJson from './data/house-pools.json'
import itemsJson from './data/items.json'
import meleeJson from './data/melee.json'
import placesJson from './data/places.json'
import provenanceJson from './data/provenance.json'
import raritiesJson from './data/rarities.json'
import recipesJson from './data/recipes.json'
import spawnJson from './data/spawn.json'
import storageJson from './data/storage.json'
import useEffectsJson from './data/use-effects.json'

/** Where an item of the catalog comes from: the team's item, the household one, the pool types of the 3D house viewer and the game ids. */
export interface ItemProvenance {
  /** The item exists only because `decisions.json` asked for it. */
  created?: true
  ite?: string
  household?: string
  vc3?: readonly string[]
  game?: readonly string[]
  idSource: 'household' | 'merge' | 'decision'
  sizeSource: 'household' | 'REF' | 'model' | 'derived'
}

export interface RarityRow {
  id: string
  weight: number
  isFixedOnly: boolean
}

export interface StorageRow {
  id: string
  multiplier: number
  needsPower?: true
  limitDays?: number
  afterLimit?: number
  /** Line of the team's page the number was read from. */
  line: number
}

export interface DepletionRow {
  places: readonly string[]
  perDay: number
  floor: number
}

export interface MeleeRow {
  id: string
  reach: number
  noise: number
}

export interface HousePools {
  /** Pools by the key of the 3D house viewer (`geladeira`, `pia`...), as `PoolEntry` of the catalog. */
  pools: Readonly<Record<string, readonly PoolEntry[]>>
  /** Keys that share another key's pool. */
  aliasOf: Readonly<Record<string, string>>
}

export const GOODS_ITEMS = itemsJson as unknown as readonly ItemDef[]
export const GOODS_CATEGORIES = categoriesJson as readonly CategoryDef[]
export const GOODS_PLACES = placesJson as readonly PlaceDef[]
export const GOODS_CONTAINERS = containersJson as unknown as readonly ContainerDef[]
export const GOODS_RECIPES = recipesJson as unknown as readonly RecipeDef[]
export const GOODS_USE_EFFECTS = useEffectsJson as unknown as readonly UseEffectDef[]

type HousePoolsFile = { pools: Record<string, readonly (PoolEntry & { type: string })[]>; aliasOf: Record<string, string> }
const housePoolsFile = housePoolsJson as unknown as HousePoolsFile

/** The explicit pools, cut to what `createItems` reads (the viewer's `type`, `name` and `viewerCategory` stay in `data/house-pools.json`). */
export const GOODS_HOUSE_POOLS: HousePools = {
  pools: Object.fromEntries(
    Object.entries(housePoolsFile.pools).map(([key, entries]) => [
      key,
      entries.map(({ item, weight, qty, isSupply }): PoolEntry => ({ item, weight, qty, ...(isSupply ? { isSupply } : {}) })),
    ]),
  ),
  aliasOf: housePoolsFile.aliasOf,
}

/** The team's numbers and tables, as read. The rules in `DEFAULT_RULES` of `game-items` are proven equal to them by test. */
export const GOODS_TABLES = {
  rarities: raritiesJson as readonly RarityRow[],
  storage: storageJson as readonly StorageRow[],
  depletion: depletionJson as readonly DepletionRow[],
  spawn: spawnJson,
  melee: meleeJson as readonly MeleeRow[],
} as const

/** Ammo boxes, three firearms and two throwables as items (the game's `EXTRA` table), for `itemsFromArsenal(arsenal, { records })`. */
export const GOODS_ARSENAL_RECORDS = ammoBoxesJson as unknown as readonly ArsenalItemRecord[]

export const GOODS_PROVENANCE = provenanceJson as unknown as Readonly<Record<string, ItemProvenance>>
