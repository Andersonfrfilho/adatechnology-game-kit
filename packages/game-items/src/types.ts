/**
 * Public types of @adatechnology/game-items.
 *
 * An `ItemDef` is a real-world thing (a can of beans, a hammer, a jacket) with its true size and weight; the rest of the fields are optional groups that
 * only the categories that need them fill (nutrition for food, protection for clothing, carry for bags). Units: metres, kilograms, litres, days.
 */
import type { ItemDef as BaseItemDef } from '@adatechnology/game-interactables'

import type { RecipeDef } from './recipe-types'
import type { UseEffectDef } from './use-types'

export type { BaseItemDef }

export const RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'unique'] as const
export type Rarity = (typeof RARITIES)[number]

export const BODY_SLOTS = ['head', 'eyes', 'torso', 'arms', 'hands', 'legs', 'feet'] as const
export type BodySlot = (typeof BODY_SLOTS)[number]

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
 * Where items are found inside a place (a fridge, a drawer, a locker): which categories it draws from and how many stacks. Provisional shape: the
 * finds logic (T3.1e) fixes the fields it needs.
 */
export interface ContainerDef {
  id: string
  name?: string
  /** Weight of each category when a stack is drawn for this container. */
  categories?: Readonly<Record<ItemCategory, number>>
  /** Range of stacks a container holds when it is filled. */
  count?: readonly [number, number]
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
  protection?: { slots: readonly BodySlot[]; bite?: number; scratch?: number; warmth?: number }
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
}
