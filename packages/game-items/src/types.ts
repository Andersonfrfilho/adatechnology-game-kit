/**
 * Public types of @adatechnology/game-items.
 *
 * An `ItemDef` is a real-world thing (a can of beans, a hammer, a jacket) with its true size and weight; the rest of the fields are optional groups that
 * only the categories that need them fill (nutrition for food, protection for clothing, carry for bags). Units: metres, kilograms, litres, days.
 */
import type { BodySlot, SealSpec } from '@adatechnology/game-contracts'
import type { ItemDef as BaseItemDef } from '@adatechnology/game-interactables'

import type { RecipeDef } from './recipe-types'
import type { UseEffectDef } from './use-types'

export type { BaseItemDef }

export const RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'unique'] as const
export type Rarity = (typeof RARITIES)[number]

/** The body slots an item covers: the vocabulary is `BodySlot` of game-contracts (`over` is a layer worn over the others, such as a coat or a vest). */
export type { BodySlot } from '@adatechnology/game-contracts'
export const BODY_SLOTS: readonly BodySlot[] = ['head', 'eyes', 'torso', 'arms', 'hands', 'legs', 'feet', 'over']

export const DURABILITY_KINDS = ['uses', 'portions', 'doses', 'hits', 'cuts', 'shots', 'condition', 'charges', 'seconds', 'days', 'infinite', 'container'] as const
export type DurabilityKind = (typeof DURABILITY_KINDS)[number]

/** How long an item lasts, read from the source text ("10 uses", "4 portions", "300 hits", "infinite"). */
export interface Durability {
  kind: DurabilityKind
  amount?: number
  /** Source qualifier when the amount alone is not enough (for example the voltage of a battery). */
  per?: string
}

/** Id of a place where items turn up (house, hospital, farm...). Places are a registry: a pack or the game declares the ones it uses. */
export type PlaceTag = string

/** Id of an item category. The 14 of `ITEM_CATEGORIES` are always present; a game adds its own through `createItems({ categories })`. */
export type ItemCategory = string

export interface CategoryDef {
  id: ItemCategory
  /** Display name in English; games translate by id. */
  name?: string
}

export interface PlaceDef {
  id: PlaceTag
  name?: string
}

/**
 * Where items are found inside a place (a fridge, a drawer, a locker): which categories it draws from and how many stacks. The finds roll reads `count`,
 * `categories` (or `categoriesByPlace`, with `*` for any other place) and `places`; other fields of a pack's container are kept and ignored.
 */
export interface ContainerDef {
  id: string
  name?: string
  /** Places the container turns up in (`toLootTables` only); empty or missing means any. */
  places?: readonly PlaceTag[]
  /** Weight of each category when a stack is drawn for this container. */
  categories?: Readonly<Record<ItemCategory, number>>
  /** When `categories` is missing: the weights by place (a shop shelf stocks what the shop sells). */
  categoriesByPlace?: Readonly<Record<PlaceTag, Readonly<Record<ItemCategory, number>>>>
  /** Range of stacks a container holds when it is filled. */
  count?: readonly [number, number]
}

/** One thing an explicit pool can hold (a fridge: water bottle, milk, eggs...): `item` is the catalog id, `weight` the odds, `qty` the range. */
export interface PoolEntry {
  item: string
  weight: number
  qty: readonly [number, number]
  /** Supplies (food, water, medicine, tools) are what a fortified house stocks up on. */
  isSupply?: boolean
}

export interface ItemDef extends BaseItemDef {
  category: ItemCategory
  /** The old household category (`kitchen`, `hygiene`, `office`...), `perishable` or `craft_only`. */
  tags?: readonly string[]
  rarity: Rarity
  /** Litres. Derived from `size` when the pack does not give it. */
  volume?: number
  durability?: Durability
  /** Days to spoil at room temperature. */
  shelfLife?: number
  portions?: number
  cookable?: boolean
  nutrition?: { satiety?: number; hydration?: number }
  /** Fractions 0..1 per attack, per body slot covered. */
  protection?: {
    slots: readonly BodySlot[]
    bite?: number
    scratch?: number
    warmth?: number
    /** Against projectiles (read by game-characters): `resistance` in penetration units; a stopped projectile does `blunt` of its damage, one that goes through `pass`. */
    ballistic?: { resistance: number; blunt?: number; pass?: number; consumable?: boolean }
  }
  carry?: { capacityKg: number; weightReduction: number; quickSlots: number; wheels?: boolean }
  /** Id of the weapon in the arsenal when the item is also one. */
  weapon?: string
  /** Id of the liquid (`game-fluids`) when the item holds one. */
  fluid?: { liquid: string; liters: number }
  uses?: readonly string[]
  finds?: { places: readonly PlaceTag[] }
  /** Battery-like items: share of the charge lost per month. */
  charge?: { lossPerMonth: number }
  /** Fuel-like items: after `afterDays` each use fails with probability `chance`. */
  agingFault?: { afterDays: number; chance: number }
  /** Key of the 3D model in `game-items-three`; without it a simple shape from `shape` is drawn. */
  /** A sealed container (a food tin, a drink can): what opens it and whether a breach spoils it. The kinds of a content pack give it (`game-items-goods`). */
  seal?: SealSpec
  model?: string
}

/** A bundle of content: items plus the categories, places and containers they rely on. */
export interface ItemPack {
  id: string
  items: readonly ItemDef[]
  categories?: readonly CategoryDef[]
  places?: readonly PlaceDef[]
  containers?: readonly ContainerDef[]
  /** What using an item does, in priority order (`resolveUse`). */
  useEffects?: readonly UseEffectDef[]
  recipes?: readonly RecipeDef[]
  /** Explicit pools of what a kind of furniture holds, by key (`fridge`, `sink`...); they win over the category roll of a container. */
  pools?: Readonly<Record<string, readonly PoolEntry[]>>
  /** Keys that share another key's pool (`garage_wardrobe` -> `wardrobe`). */
  poolAliases?: Readonly<Record<string, string>>
}
