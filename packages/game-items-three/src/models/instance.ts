import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial, Thumbnail } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import { buildItem } from '../build-item'
import { buildItemLod } from '../lod'
import type { ItemLod, ItemLodOptions } from '../lod'
import { itemThumbnail } from '../thumbnails'
import type { BuildItemOptions, DrawableItem, ItemModel } from '../build-item'
import { registryOver } from './registry'
import type { ItemModelBuilder, ItemModelEntry, ItemModelRegistry } from './registry'
import { SHIPPED_MODELS } from './shipped'

export interface ItemModelRecord {
  readonly entry: ItemModelEntry
  readonly builder: ItemModelBuilder
}

export interface ItemModelsOptions {
  /** Models added to the shipped ones; one with the id of a shipped model replaces it. */
  readonly packs?: readonly (readonly ItemModelRecord[])[]
  /** Changes to an entry by item id (`scale`, `teamBox`), merged field by field. */
  readonly patch?: Readonly<Record<string, DeepPartial<ItemModelEntry>>>
  /** Item ids whose model is taken out (the item then gets its simple shape). */
  readonly remove?: readonly string[]
}

export interface ItemModels extends ItemModelRegistry {
  /** `buildItem` that reads this set of models. */
  build(T: typeof THREE_NS, item: DrawableItem, options?: Omit<BuildItemOptions, 'models'>): ItemModel
  /** `buildItemLod` that reads this set of models. */
  buildLod(T: typeof THREE_NS, item: DrawableItem, options?: Omit<ItemLodOptions, 'models'>): ItemLod
  /** `itemThumbnail` that asks this set whether the item has a model. */
  thumbnail(item: DrawableItem): Thumbnail
}

type Keyed = ItemModelRecord & { readonly id: string }

/** A set of item models of its own: the shipped ones plus `packs`, `patch` and `remove`. Nothing is shared with any other set on the page. */
export function createItemModels(options: ItemModelsOptions = {}): ItemModels {
  const keyed = (record: ItemModelRecord): Keyed => ({ ...record, id: record.entry.id })
  const records = mergeById(SHIPPED_MODELS.map(keyed), (options.packs ?? []).flat().map(keyed))
  applyPatches(records, Object.fromEntries(Object.entries(options.patch ?? {}).map(([id, entry]) => [id, { entry }])) as Readonly<Record<string, DeepPartial<Keyed>>>)
  removeIds(records, options.remove)
  const registry = registryOver(new Map([...records].map(([id, record]) => [id, record.entry])), new Map([...records].map(([id, record]) => [id, record.builder])))
  const models: ItemModels = {
    ...registry,
    build: (T, item, buildOptions = {}) => buildItem(T, item, { ...buildOptions, models: registry }),
    buildLod: (T, item, lodOptions = {}) => buildItemLod(T, item, { ...lodOptions, models: registry }),
    thumbnail: (item) => itemThumbnail(item, registry),
  }
  return models
}
