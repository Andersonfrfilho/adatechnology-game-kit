import type * as THREE_NS from 'three'

import type { ItemKit } from '../kit'

/** One model of the showcase as `data/models.json` keeps it: the item it draws, the id the team gave it, the box it has in the units of the page and the scale to metres. */
export interface ItemModelEntry {
  /** Catalog id of the item (`canned_beans`). */
  readonly id: string
  /** The id in the team's `MODELS` (`feijao_lata`). */
  readonly teamId: string
  /** Box of the builder's group in the page's units (`Box3.setFromObject`), x y z. */
  readonly teamBox: readonly [number, number, number]
  /** Metres per unit of the page, from one real measure of the object. */
  readonly scale: number
}

/** A builder of the showcase, ported as it is: it draws in the page's units and returns the group. */
export type ItemModelBuilder = (kit: ItemKit) => THREE_NS.Group

const entries = new Map<string, ItemModelEntry>()
const builders = new Map<string, ItemModelBuilder>()

/** Adds (or replaces) the model of an item: `entry.id` is the catalog id the item's `model` field names. */
export function registerItemModel(entry: ItemModelEntry, builder: ItemModelBuilder): void {
  entries.set(entry.id, entry)
  builders.set(entry.id, builder)
}

/** Takes a model out (a game that wants the simple shape instead). */
export function unregisterItemModel(id: string): void {
  entries.delete(id)
  builders.delete(id)
}

export const itemModelEntry = (id: string): ItemModelEntry | undefined => entries.get(id)
export const itemModelBuilder = (id: string): ItemModelBuilder | undefined => builders.get(id)
export const hasItemModel = (id: string): boolean => builders.has(id)
/** The ids of the models registered, in the order of registration (the order of the showcase for the ones the kit ships). */
export const listItemModels = (): string[] => [...entries.keys()]
