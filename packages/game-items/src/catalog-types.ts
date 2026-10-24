import type { DeepPartial } from '@adatechnology/game-contracts'

import type { RecipeDef } from './recipe-types'
import type { ItemRules } from './rules-types'
import type { UseEffectDef } from './use-types'
import type { CategoryDef, ContainerDef, ItemCategory, ItemDef, ItemPack, PlaceDef, PlaceTag, PoolEntry } from './types'

export interface ItemsOptions {
  /** Content bundles, merged in order (a later item replaces one with the same id). */
  packs?: readonly ItemPack[]
  /** Changes to items, by id, applied after the packs are merged; `size`, `nutrition`, `protection`... merge field by field, arrays replace. */
  patch?: Readonly<Record<string, DeepPartial<Omit<ItemDef, 'id'>>>>
  /** Ids to take out after the patches. */
  remove?: readonly string[]
  /** Keeps only the items it returns true for, after `remove`. */
  include?: (item: ItemDef) => boolean
  /** Extra categories, places and containers, added to those of the packs (by id). */
  categories?: readonly CategoryDef[]
  places?: readonly PlaceDef[]
  containers?: readonly ContainerDef[]
  useEffects?: readonly UseEffectDef[]
  recipes?: readonly RecipeDef[]
  pools?: ItemPack['pools']
  poolAliases?: ItemPack['poolAliases']
  rules?: DeepPartial<ItemRules>
}

export interface ItemsCatalog {
  readonly items: ReadonlyMap<string, ItemDef>
  readonly categories: ReadonlyMap<ItemCategory, CategoryDef>
  readonly places: ReadonlyMap<PlaceTag, PlaceDef>
  readonly containers: ReadonlyMap<string, ContainerDef>
  /** Explicit pools by key, with the aliases already resolved. */
  readonly pools: ReadonlyMap<string, readonly PoolEntry[]>
  readonly useEffects: readonly UseEffectDef[]
  readonly recipes: ReadonlyMap<string, RecipeDef>
  readonly rules: ItemRules
  has(id: string): boolean
  /** Throws on an unknown id. */
  get(id: string): ItemDef
  list(): ItemDef[]
  byCategory(category: ItemCategory): ItemDef[]
  /** Items that can be found in `place` (`finds.places`). */
  byPlace(place: PlaceTag): ItemDef[]
  byTag(tag: string): ItemDef[]
}
