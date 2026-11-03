import { itemModels } from '@adatechnology/game-items-three'
import type * as THREE_NS from 'three'

/** What a weapon or an explosive asks of an item model: the fields of `DrawableItem` of game-items-three that it fills in. */
export interface ItemModelRequest {
  id: string
  category: string
  size: [number, number, number]
  model?: string
}

/**
 * The item models of game-items-three, lent by the host as `items`; `itemModels` of game-items-three fits it, and the host that passes none gets it as the default.
 * The default is deprecated and removed in the next major: pass `items`.
 */
export interface ItemModels {
  has(id: string): boolean
  /** `wear`: 0 new, 1 used, 2 spoiled. */
  build(THREE: typeof THREE_NS, item: ItemModelRequest, options?: { wear?: 0 | 1 | 2 }): { root: THREE_NS.Group; kind: string }
}

/** What the weapons draw with when the host passes no `items`: the item models of game-items-three, as before the `items` option existed. */
export const DEFAULT_ITEM_MODELS: ItemModels = itemModels
