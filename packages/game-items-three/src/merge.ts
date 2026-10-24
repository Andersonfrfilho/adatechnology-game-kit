import { mergeByMaterial } from '@adatechnology/game-shapes-three'
import type * as THREE_NS from 'three'

import type { ItemModel } from './build-item'

/**
 * The same item with its meshes joined by material: one mesh and one draw call per material instead of one per part (the "one material for all the items" of the page's
 * budget, as far as the materials of the kit allow). The materials are the same objects, so `setWear` still reaches them. The model's scale stays on the root.
 */
export function mergeItem(T: typeof THREE_NS, model: ItemModel): ItemModel {
  model.root.updateMatrixWorld(true)
  const merged = new T.Group()
  merged.name = model.root.name
  merged.scale.copy(model.root.scale)
  merged.userData = { ...model.root.userData }
  // baked into the space of the root, which leaves the root's own scale out of the geometry
  merged.add(...mergeByMaterial(T, model.root, model.root))
  return { ...model, root: merged }
}
