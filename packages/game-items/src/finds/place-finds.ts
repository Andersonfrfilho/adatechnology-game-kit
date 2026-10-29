import { fitsSize } from '@adatechnology/game-interactables'
import type { ItemStack, SlotSpec } from '@adatechnology/game-interactables'

import type { ItemsCatalog } from '../catalog-types'

import type { FindStack } from './types'

export interface PlacedFinds {
  /** One entry per slot, in the order of `slots`; null is empty. */
  contents: Array<ItemStack | null>
  /** Stacks that fit no free slot. */
  leftover: FindStack[]
}

/**
 * Puts the stacks in the slots of a container: each in the first free slot its item fits (`fitsSize`, width and depth may swap), a stack larger than the
 * item's `stack` splits over several slots. Pure and in order, so the same finds always land in the same slots. The result is the floorplan's `contents`.
 */
export const placeFinds = (stacks: readonly FindStack[], slots: readonly SlotSpec[], catalog: ItemsCatalog): PlacedFinds => {
  const contents: Array<ItemStack | null> = slots.map(() => null)
  const leftover: FindStack[] = []
  for (const stack of stacks) {
    const item = catalog.get(stack.itemId)
    const stackMax = item.stack ?? 1
    let remaining = stack.count
    while (remaining > 0) {
      const index = slots.findIndex((slot, position) => contents[position] === null && fitsSize(item.size, slot.max))
      if (index < 0) break
      const qty = Math.min(remaining, stackMax)
      contents[index] = { type: item.id, qty, ...(stack.data ? { data: { ...stack.data } } : {}) }
      remaining -= qty
    }
    if (remaining > 0) leftover.push({ ...stack, count: remaining })
  }
  return { contents, leftover }
}
