import type * as THREE_NS from 'three'

import type { ItemKit } from '../kit'
import { SHIPPED_MODELS } from './shipped'

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

/** The models of one registry: what `buildItem` reads through its `models` option. */
export interface ItemModelRegistry {
  has(id: string): boolean
  entry(id: string): ItemModelEntry | undefined
  builder(id: string): ItemModelBuilder | undefined
  /** The ids registered, in the order of registration (the order of the showcase for the ones the kit ships). */
  list(): string[]
  /** Adds (or replaces) the model of an item: `entry.id` is the catalog id the item's `model` field names. */
  register(entry: ItemModelEntry, builder: ItemModelBuilder): void
  /** Takes a model out (a game that wants the simple shape instead). */
  unregister(id: string): void
}

export const registryOver = (entries: Map<string, ItemModelEntry>, builders: Map<string, ItemModelBuilder>): ItemModelRegistry => ({
  has: (id) => builders.has(id),
  entry: (id) => entries.get(id),
  builder: (id) => builders.get(id),
  list: () => [...entries.keys()],
  register(entry, builder) {
    entries.set(entry.id, entry)
    builders.set(entry.id, builder)
  },
  unregister(id) {
    entries.delete(id)
    builders.delete(id)
  },
})

let defaultRegistry: ItemModelRegistry | undefined

/** The registry behind `registerItemModel`, `hasItemModel` and the rest of the global functions, created on first use. */
export const defaultItemModels = (): ItemModelRegistry =>
  (defaultRegistry ??= registryOver(new Map(SHIPPED_MODELS.map(({ entry }) => [entry.id, entry])), new Map(SHIPPED_MODELS.map(({ entry, builder }) => [entry.id, builder]))))

/**
 * Adds (or replaces) the model of an item: `entry.id` is the catalog id the item's `model` field names.
 * @deprecated use `createItemModels(...).register`.
 */
export const registerItemModel = (entry: ItemModelEntry, builder: ItemModelBuilder): void => defaultItemModels().register(entry, builder)

/** @deprecated use `createItemModels(...).unregister`. */
export const unregisterItemModel = (id: string): void => defaultItemModels().unregister(id)

/** @deprecated use `createItemModels(...).entry`. */
export const itemModelEntry = (id: string): ItemModelEntry | undefined => defaultItemModels().entry(id)
/** @deprecated use `createItemModels(...).builder`. */
export const itemModelBuilder = (id: string): ItemModelBuilder | undefined => defaultItemModels().builder(id)
/** @deprecated use `createItemModels(...).has`. */
export const hasItemModel = (id: string): boolean => defaultItemModels().has(id)
/** @deprecated use `createItemModels(...).list`. */
export const listItemModels = (): string[] => defaultItemModels().list()
