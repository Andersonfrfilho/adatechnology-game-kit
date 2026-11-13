import { canTake, carriedKg, itemLitres, loadState } from './carry'
import type { CarryEntry, TakeResult } from './carry'
import type { Inventory, InventoryOptions, InventoryResult, InventorySlot, ItemStack } from './inventory-types'
import { DEFAULT_RULES } from './rules'
import type { ItemDef } from './types'

/** Deep copy so a state goes in and comes out equal but never shared. */
const copyStack = (stack: ItemStack): ItemStack => structuredClone(stack)

const isStackable = (item: ItemDef, stack: ItemStack): boolean => stack.state === undefined && (item.stack ?? 1) > 1

/**
 * A live inventory: slots (one stack or one unique item each), one item in hand, weight and volume limits from the carry rules.
 * Pure: no renderer, no room. Damage and every other state field survive take, store, equip and drop unchanged.
 */
export const createInventory = (options: InventoryOptions): Inventory => {
  const { items, bag, weightReduction = 0, rules = DEFAULT_RULES } = options
  const slotList: InventorySlot[] = []
  let held: ItemStack | undefined
  let nextSlotId = 1

  const entryOf = (stack: ItemStack): CarryEntry | undefined => {
    const item = items.get(stack.itemId)
    return item ? { item, count: stack.count } : undefined
  }
  const entries = (stacks: readonly ItemStack[]): CarryEntry[] => stacks.flatMap((stack) => entryOf(stack) ?? [])
  const slotKg = (stack: ItemStack): number => carriedKg({ loose: [], packed: entries([stack]), weightReduction })
  const litresOf = (stacks: readonly ItemStack[]): number => entries(stacks).reduce((sum, entry) => sum + itemLitres(entry.item) * entry.count, 0)

  const totals = () => {
    const kg = carriedKg({ loose: entries(held ? [held] : []), packed: entries(slotList), weightReduction })
    return { slots: slotList.length, kg, litres: litresOf(slotList), load: loadState(kg, bag.capacityKg, rules) }
  }

  /** Slots a stateless stack needs: it first fills partial slots of the same item, the rest takes new slots. */
  const planSlots = (item: ItemDef, stack: ItemStack): { fills: Map<number, number>; newStacks: number[] } => {
    const fills = new Map<number, number>()
    const limit = item.stack ?? 1
    let left = stack.count
    if (isStackable(item, stack)) {
      for (const slot of slotList) {
        if (left === 0) break
        if (slot.itemId !== stack.itemId || slot.state !== undefined || slot.count >= limit) continue
        const added = Math.min(left, limit - slot.count)
        fills.set(slot.slotId, added)
        left -= added
      }
    }
    const perSlot = isStackable(item, stack) ? limit : 1
    const newStacks: number[] = []
    for (; left > 0; left -= Math.min(left, perSlot)) newStacks.push(Math.min(left, perSlot))
    return { fills, newStacks }
  }

  const commit = (stack: ItemStack, plan: ReturnType<typeof planSlots>): number[] => {
    const slotIds: number[] = []
    for (const [slotId, added] of plan.fills) {
      const index = slotList.findIndex((slot) => slot.slotId === slotId)
      const slot = slotList[index] as InventorySlot
      slotList[index] = { ...slot, count: slot.count + added }
      slotIds.push(slotId)
    }
    for (const count of plan.newStacks) {
      const slotId = nextSlotId++
      slotList.push({ ...copyStack(stack), count, slotId })
      slotIds.push(slotId)
    }
    return slotIds
  }

  /** Whether `stack` fits into the bag given the weight and volume of everything else. */
  const fitsInBag = (item: ItemDef, stack: ItemStack, plan: ReturnType<typeof planSlots>, rest: { kg: number; litres: number }): TakeResult =>
    canTake(item, bag, { slots: slotList.length, loadKg: rest.kg, litres: rest.litres }, { count: stack.count, slotsNeeded: plan.newStacks.length, weightFactor: 1 - weightReduction })

  const putInBag = (stack: ItemStack, rest: { kg: number; litres: number }): InventoryResult<{ slotIds: readonly number[] }> => {
    const item = items.get(stack.itemId)
    if (!item) return { ok: false, reason: 'unknown_item' }
    if (!Number.isInteger(stack.count) || stack.count < 1 || (stack.state !== undefined && stack.count !== 1)) return { ok: false, reason: 'bad_count' }
    const plan = planSlots(item, stack)
    const verdict = fitsInBag(item, stack, plan, rest)
    if (verdict !== 'ok') return { ok: false, reason: verdict }
    return { ok: true, slotIds: commit(stack, plan) }
  }

  const findSlot = (slotId: number): number => slotList.findIndex((slot) => slot.slotId === slotId)

  return {
    take: ({ itemId, count = 1, state }) => {
      const stack: ItemStack = state === undefined ? { itemId, count } : { itemId, count, state }
      const now = totals()
      return putInBag(stack, { kg: now.kg, litres: now.litres })
    },
    store: () => {
      if (!held) return { ok: false, reason: 'hand_empty' }
      const now = totals()
      const result = putInBag(held, { kg: now.kg - carriedKg({ loose: entries([held]) }), litres: now.litres })
      if (result.ok) held = undefined
      return result
    },
    equip: (slotId) => {
      const index = findSlot(slotId)
      if (index < 0) return { ok: false, reason: 'not_found' }
      if (held) return { ok: false, reason: 'hand_full' }
      const slot = slotList[index] as InventorySlot
      const item = items.get(slot.itemId)
      if (!item) return { ok: false, reason: 'unknown_item' }
      const now = totals()
      const verdict = canTake(item, { ...bag, capacityLitres: undefined }, { slots: 0, loadKg: now.kg - slotKg(slot), litres: 0 }, { count: slot.count, slotsNeeded: 0 })
      if (verdict !== 'ok') return { ok: false, reason: verdict }
      slotList.splice(index, 1)
      held = { itemId: slot.itemId, count: slot.count, ...(slot.state ? { state: slot.state } : {}) }
      return { ok: true, held: copyStack(held) }
    },
    drop: ({ slotId, count } = {}) => {
      if (slotId === undefined) {
        if (!held) return { ok: false, reason: 'hand_empty' }
        const dropped = held
        held = undefined
        return { ok: true, dropped: copyStack(dropped) }
      }
      const index = findSlot(slotId)
      if (index < 0) return { ok: false, reason: 'not_found' }
      const slot = slotList[index] as InventorySlot
      const taken = count ?? slot.count
      if (!Number.isInteger(taken) || taken < 1 || taken > slot.count) return { ok: false, reason: 'bad_count' }
      const dropped: ItemStack = { itemId: slot.itemId, count: taken, ...(slot.state ? { state: slot.state } : {}) }
      if (taken === slot.count) slotList.splice(index, 1)
      else slotList[index] = { ...slot, count: slot.count - taken }
      return { ok: true, dropped: copyStack(dropped) }
    },
    slots: () => slotList.map((slot) => structuredClone(slot)),
    held: () => (held ? copyStack(held) : undefined),
    totals,
  }
}
