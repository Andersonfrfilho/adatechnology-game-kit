import type * as THREE_NS from 'three'

import { buildItem } from './build-item'
import type { BuildItemOptions, DrawableItem } from './build-item'

/** A stack held in a container (`ItemStack` of game-interactables): the item id and its free data. */
export interface ContainedStack {
  readonly type: string
}

/** What `createContainedItemModel` returns: the real model of a stack drawn with the caller's `THREE`, or null for an id the catalogue does not have. */
export type ContainedItemModel = (stack: ContainedStack, T: typeof THREE_NS) => THREE_NS.Object3D | null

/**
 * The model of the items inside furniture, for `createContentsView` of game-interactables-three and `interactives.itemModel` of game-floorplan-three: each
 * stack is drawn by `buildItem` from the catalogue (the team's model where there is one, the item's own shape otherwise), never a stand-in. Every item gets its
 * own materials, so the view can discard it alone when it is taken. `root.userData.item` says what was drawn (`{ id, kind }`).
 */
export function createContainedItemModel(items: Iterable<DrawableItem>, options: Omit<BuildItemOptions, 'kit'> = {}): ContainedItemModel {
  const byId = new Map<string, DrawableItem>()
  for (const item of items) byId.set(item.id, item)
  return (stack, T) => {
    const item = byId.get(stack.type)
    if (!item) return null
    const model = buildItem(T, item, options)
    model.root.userData.item = { id: item.id, kind: model.kind }
    return model.root
  }
}
