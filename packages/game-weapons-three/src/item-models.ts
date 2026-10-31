import type * as THREE_NS from 'three'

/** What a weapon or an explosive asks of an item model: the fields of `DrawableItem` of game-items-three that it fills in. */
export interface ItemModelRequest {
  id: string
  category: string
  size: [number, number, number]
  model?: string
}

/**
 * The item models of game-items-three, lent by the host (game-weapons-three does not import game-items-three). `itemModels` of game-items-three fits it.
 * Without it the weapons the gallery did not draw keep their low-poly prop and the world explosives their plain shape.
 */
export interface ItemModels {
  has(id: string): boolean
  /** `wear`: 0 new, 1 used, 2 spoiled. */
  build(THREE: typeof THREE_NS, item: ItemModelRequest, options?: { wear?: 0 | 1 | 2 }): { root: THREE_NS.Group; kind: string }
}
