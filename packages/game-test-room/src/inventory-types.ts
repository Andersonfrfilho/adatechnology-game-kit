import type { InventoryFailure, ItemState } from '@adatechnology/game-items'
import type { Vec3 } from '@adatechnology/game-contracts'

export type RoomText = (key: string, vars?: Record<string, string | number>) => string

/** Why a bag action did not happen: the inventory's reasons plus the room's own. */
export type BagFailure = InventoryFailure | 'not_equippable' | 'nothing_to_pick' | 'cannot_pick'

export type BagResult = { readonly ok: true } | { readonly ok: false; readonly reason: BagFailure }

/** One thing in the bag or in the hand, as the list shows it. `slotId` is null for the hand. */
export interface InventoryRow {
  readonly slotId: number | null
  readonly itemId: string
  readonly name: string
  readonly count: number
  readonly kg: number
  readonly litres: number
  /** The damage in words: `handle snapped · blade bent 23° · 2 holes`, or `intact`. */
  readonly condition: string
  readonly canEquip: boolean
}

export interface InventorySnapshot {
  readonly rows: readonly InventoryRow[]
  readonly held: InventoryRow | null
  readonly totals: { readonly slots: number; readonly kg: number; readonly litres: number }
  readonly limits: { readonly slots: number; readonly kg: number; readonly litres: number }
}

/** What the room knows about an object of the world that is going into the bag. */
export interface BagSubject {
  readonly itemId: string
  readonly name: string
  readonly weapon?: string
  readonly kg: number
  readonly size: Vec3
  readonly state: ItemState
}

/** What the room lends the bag: the world side of every action. */
export interface BagHost {
  readonly t: RoomText
  readonly say: (message: string) => void
  readonly action: (type: string, text: string, extra?: { itemId?: string; data?: Record<string, unknown> }) => void
  /** The object the player aims at, within reach. */
  aimedObject(): string | null
  /** The object as the bag would keep it (null: it cannot go in). */
  inspect(objectId: string): BagSubject | null
  /** Takes the object out of the world. */
  remove(objectId: string): void
  /** The piece held with both hands, if any. */
  heldObject(): string | null
  /** Puts the damaged object back in the world at the feet. */
  placeBack(subject: { itemId: string; name: string; state: ItemState }): void
  /** A tool taken out of the bag is now the weapon in hand, with this state. */
  equipTool(subject: { itemId: string; name: string; weapon: string; state: ItemState }): void
  /** The tool in hand went into the bag. */
  clearHandTool(): void
  /** The mouse is needed (or free again). */
  onOpen(open: boolean): void
}
