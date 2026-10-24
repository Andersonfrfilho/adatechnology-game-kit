import { createItems } from '../src'
import type { ItemDef, ItemPack } from '../src'

export const item = (id: string, extra: Partial<ItemDef> = {}): ItemDef => ({ id, category: 'food', size: [0.1, 0.2, 0.1], weight: 0.4, rarity: 'common', ...extra })

export const makeCatalog = (items: ItemDef[], extra: Partial<ItemPack> = {}, options: Parameters<typeof createItems>[0] = {}) =>
  createItems({ packs: [{ id: 'test', items, ...extra }], ...options })

/** A deterministic generator that returns the given numbers in order, then repeats the last. */
export const sequence = (...values: number[]): (() => number) => {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)] as number
}
