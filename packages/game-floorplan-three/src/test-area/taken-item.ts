import type { HostTakenItem, Vec3 } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import type { ContainedItemModel } from '../adapter-shapes.js'
import type { InteractionTarget, KitTarget } from '../kernel-types-systems.js'

export interface TakenItemParams {
  /** What E is aimed at in the house (`House.target`). */
  readonly target: InteractionTarget | null
  /** The real model of a contained stack (`interactives.itemModel`); without it nothing is handed over. */
  readonly itemModel: ContainedItemModel | undefined
  /** A point of the house (its own space) in the world. */
  readonly toWorld: (point: readonly number[]) => Vec3
}

const isKitTarget = (target: InteractionTarget['target'] | undefined): target is KitTarget => !!target && (target as Partial<KitTarget>).kit === true

/**
 * The item a `take` of the kit hands over (a pair of jeans in a wardrobe), read before the take empties its slot: the host puts it in the hand (`ModuleHost.takeInHand`)
 * with the hands the kit asks for, drawn by the same model the furniture showed it with. Null when the target is not such a take.
 */
export function takenItemOf({ target, itemModel, toWorld }: TakenItemParams): HostTakenItem | null {
  const ref = target?.target
  if (!itemModel || !isKitTarget(ref)) return null
  const take = ref.item
  if (take.kind !== 'take' || !take.itemType || !take.hands) return null
  const stack = { type: take.itemType, qty: 1 }
  return {
    itemId: take.itemType,
    name: take.noun,
    position: toWorld(take.pos),
    hands: take.hands,
    build: (T) => {
      const model = itemModel(stack, T as typeof THREE_NS)
      if (!model) throw new Error(`game-floorplan-three: no model for the item "${stack.type}" taken out of the furniture`)
      return model
    },
  }
}
