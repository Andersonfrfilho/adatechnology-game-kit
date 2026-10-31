import { createItems } from '@adatechnology/game-items'
import type { ItemDef, ItemPack, ItemsCatalog, ItemsOptions } from '@adatechnology/game-items'
import type { SealSpec } from '@adatechnology/game-contracts'

import { FLOORPLAN_POOL_ALIASES } from './floorplan'
import { createGoodsKinds } from './kinds'
import { GOODS_CATEGORIES, GOODS_CONTAINERS, GOODS_HOUSE_POOLS, GOODS_ITEMS, GOODS_PLACES, GOODS_RECIPES, GOODS_USE_EFFECTS } from './data'

const KINDS = createGoodsKinds()

/** The item with the seal of its kind underneath (a food tin opens with a can opener or a knife, a drink can by its tab); the item's own seal wins. */
const withSeal = (item: ItemDef): ItemDef => {
  const kind = (item as ItemDef & { kind?: string }).kind
  const seal = kind && KINDS.has(kind) ? (KINDS.defaults(kind).seal as SealSpec | undefined) : undefined
  return seal ? { ...item, seal: { ...seal, ...item.seal } } : item
}

/** The pack for `createItems({ packs })`: items, the three categories the game adds, 24 places, 17 containers, house pools, use effects and recipes. */
export const goodsPack: ItemPack = {
  id: 'goods',
  items: GOODS_ITEMS.map(withSeal),
  categories: GOODS_CATEGORIES,
  places: GOODS_PLACES,
  containers: GOODS_CONTAINERS,
  useEffects: GOODS_USE_EFFECTS,
  recipes: GOODS_RECIPES,
  pools: GOODS_HOUSE_POOLS.pools,
  poolAliases: { ...GOODS_HOUSE_POOLS.aliasOf, ...FLOORPLAN_POOL_ALIASES },
}

/** `createItems` with the goods pack first; the packs and options of the game come after and win. */
export const createGoodsItems = (options: ItemsOptions = {}): ItemsCatalog => createItems({ ...options, packs: [goodsPack, ...(options.packs ?? [])] })
