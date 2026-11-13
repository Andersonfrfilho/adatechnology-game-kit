/**
 * Types of the live inventory: slots that each hold one stack or one unique item with its full state, plus one item in hand.
 * The inventory never looks inside the state; it only keeps it and gives it back exactly as it came.
 */
import type { ToolCondition } from '@adatechnology/game-contracts'
import type { DestructionSnapshot } from '@adatechnology/game-destruction'

import type { BagOption, LoadState } from './carry'
import type { ItemDef } from './types'
import type { ItemRules } from './rules-types'

/** One object as `DestructionWorld.serializeObject` writes it (spec, state with holes and bend, runtime). */
export type DestructionObjectState = DestructionSnapshot['objects'][number]

export interface AmmoState {
  /** Rounds in the weapon. */
  readonly loaded: number
  /** Rounds carried for it. */
  readonly reserve: number
}

/** Everything that makes this item different from a fresh one of the same catalog id. */
export interface ItemState {
  readonly destruction?: DestructionObjectState
  readonly condition?: ToolCondition
  /** 0..1 worn out. */
  readonly wear?: number
  readonly temperatureC?: number
  readonly ammo?: AmmoState
}

/** A stack (a count of the same stateless item) or one unique item (count 1, with its state). */
export interface ItemStack {
  readonly itemId: string
  readonly count: number
  readonly state?: ItemState
}

export interface InventorySlot extends ItemStack {
  readonly slotId: number
}

export type InventoryFailure = 'unknown_item' | 'bad_count' | 'bag_full' | 'too_heavy' | 'too_bulky' | 'not_found' | 'hand_full' | 'hand_empty'

export type InventoryResult<TSuccess extends object = object> = ({ readonly ok: true } & TSuccess) | { readonly ok: false; readonly reason: InventoryFailure }

export interface InventoryOptions {
  /** The catalog items (`ItemsCatalog.items`). */
  items: ReadonlyMap<string, ItemDef>
  /** Slots, weight limit and volume of the bag (`bagOption`). */
  bag: BagOption
  /** Share of the weight inside the bag that does not count (`ItemDef.carry.weightReduction` of the bag). */
  weightReduction?: number
  rules?: ItemRules
}

export interface InventoryTotals {
  readonly slots: number
  readonly kg: number
  /** Volume inside the bag; the item in hand is not in it. */
  readonly litres: number
  readonly load: LoadState
}

export interface TakeParams {
  readonly itemId: string
  readonly count?: number
  readonly state?: ItemState
}

export interface Inventory {
  /** Puts an item from the world into the bag. */
  take(params: TakeParams): InventoryResult<{ slotIds: readonly number[] }>
  /** Puts an item from the world straight into the hand (it takes no slot and no bag volume, only weight). */
  hold(params: Omit<TakeParams, 'count'>): InventoryResult<{ held: ItemStack }>
  /** Moves the item in hand back into the bag (unequip). */
  store(): InventoryResult<{ slotIds: readonly number[] }>
  /** Moves a slot to the hand; returns what is now held. */
  equip(slotId: number): InventoryResult<{ held: ItemStack }>
  /** Takes `count` (default all) out of a slot, or the hand when no slot is given, and returns what the world must restore. */
  drop(params?: { slotId?: number; count?: number }): InventoryResult<{ dropped: ItemStack }>
  slots(): readonly InventorySlot[]
  held(): ItemStack | undefined
  totals(): InventoryTotals
}
