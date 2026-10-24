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

/** Returns the given numbers in order and records how many draws were made; throws if the code draws more than scripted. */
export const scripted = (...values: number[]): { random: () => number; draws: () => number } => {
  let index = 0
  return {
    random: () => {
      if (index >= values.length) throw new Error(`drew ${index + 1} numbers, only ${values.length} were scripted`)
      return values[index++] as number
    },
    draws: () => index,
  }
}
