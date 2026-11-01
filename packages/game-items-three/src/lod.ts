import type * as THREE_NS from 'three'

import { ITEM_BUDGETS, cullDistanceOf } from './budgets'
import type { ItemBudgets } from './budgets'
import { buildItem } from './build-item'
import type { BuildItemOptions, DrawableItem, ItemModel } from './build-item'
import { createItemKit } from './kit'
import { mergeItem } from './merge'

export interface ItemLodOptions extends Omit<BuildItemOptions, 'simple' | 'detail' | 'kit'> {
  budgets?: ItemBudgets
  /** Join the meshes of each level by material (default true). */
  merge?: boolean
  /** Distance of the second level in metres; default a third of the distance at which the item disappears. */
  lod1Distance?: number
}

export interface ItemLod {
  /** Add this to the scene and call `update(camera)` (or let the renderer do it). */
  readonly root: THREE_NS.LOD
  /** Full detail: the showcase model, or the shape at full segments. */
  readonly near: ItemModel
  /** The simple shape at half the segments. */
  readonly far: ItemModel
  /** Metres from the camera at which the item is no longer drawn. */
  readonly cullDistance: number
  readonly lod1Distance: number
}

/**
 * Three levels of an item: the model (or the shape) up close, the simple shape at half the segments from `lod1Distance`, and nothing from the distance of its class
 * (a small item goes at 30 m, a large one at 60 m).
 */
export function buildItemLod(T: typeof THREE_NS, item: DrawableItem, options: ItemLodOptions = {}): ItemLod {
  const budgets = options.budgets ?? ITEM_BUDGETS
  const cullDistance = cullDistanceOf(item.size, budgets)
  const lod1Distance = options.lod1Distance ?? cullDistance / 3
  const joined = (model: ItemModel): ItemModel => (options.merge === false ? model : mergeItem(T, model))
  const wear = { ...(options.wear === undefined ? {} : { wear: options.wear }), ...(options.models === undefined ? {} : { models: options.models }) }
  const near = joined(buildItem(T, item, { ...wear, kit: createItemKit(T) }))
  const far = joined(buildItem(T, item, { ...wear, simple: true, detail: budgets.lod1Ratio, kit: createItemKit(T) }))
  const root = new T.LOD()
  root.name = item.id
  root.addLevel(near.root, 0)
  root.addLevel(far.root, lod1Distance)
  root.addLevel(new T.Group(), cullDistance)
  root.userData.wear = options.wear ?? 0
  return { root, near, far, cullDistance, lod1Distance }
}
