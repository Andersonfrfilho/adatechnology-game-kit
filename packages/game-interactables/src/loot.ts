import { rng } from './rng'
import type { ItemCatalog, ItemStack, LootTables, SlotSpec, Vec3 } from './types'

/** True when an item of `size` [w, h, d] fits in a slot of `max`; width and depth may be swapped (the item is turned). */
export function fitsSize(size: Vec3, max: Vec3): boolean {
  const eps = 1e-9
  if (size[1] > max[1] + eps) return false
  return (size[0] <= max[0] + eps && size[2] <= max[2] + eps) || (size[2] <= max[0] + eps && size[0] <= max[2] + eps)
}

/** Does the item type fit the slot. Types missing from the catalog are accepted (the host owns unknown items). */
export function fitsSlot(type: string, slot: SlotSpec, items?: ItemCatalog): boolean {
  const def = items?.[type]
  return def ? fitsSize(def.size, slot.max) : true
}

/**
 * Deterministic contents for a container: one entry per slot. A slot is filled with probability `fill`; the entry is a weighted pick
 * among the table entries whose item fits the slot. Same seed, same table and same slots always give the same result.
 */
export function generateLoot(
  tables: LootTables | undefined,
  tableId: string,
  slots: SlotSpec[],
  seed: number | string,
  items?: ItemCatalog,
): Array<ItemStack | null> {
  const table = tables?.[tableId]
  const out: Array<ItemStack | null> = slots.map(() => null)
  if (!table) return out
  const rand = rng(seed)
  slots.forEach((slot, i) => {
    // Always draw the same number of random values per slot so a change in one slot does not shift the others.
    const roll = rand()
    const pick = rand()
    const q = rand()
    if (roll >= table.fill) return
    const candidates = table.entries.filter((e) => e.weight > 0 && fitsSlot(e.type, slot, items))
    const total = candidates.reduce((s, e) => s + e.weight, 0)
    if (total <= 0) return
    let r = pick * total
    let chosen = candidates[candidates.length - 1]
    for (const e of candidates) {
      r -= e.weight
      if (r < 0) {
        chosen = e
        break
      }
    }
    const [lo, hi] = chosen.qty ?? [1, 1]
    const def = items?.[chosen.type]
    const stackMax = def ? (def.stack ?? 1) : Number.POSITIVE_INFINITY
    const qty = Math.max(1, Math.min(stackMax, lo + Math.floor(q * (hi - lo + 1))))
    out[i] = { type: chosen.type, qty }
  })
  return out
}
