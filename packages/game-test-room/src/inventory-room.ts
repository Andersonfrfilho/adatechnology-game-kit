import { DEFAULT_RULES, createInventory, itemLitres } from '@adatechnology/game-items'
import type { Inventory, InventoryFailure, ItemDef, ItemStack, ItemState } from '@adatechnology/game-items'

import { createInventoryPanel } from './inventory-panel'
import type { InventoryPanel } from './inventory-panel'
import type { BagFailure, BagHost, BagResult, BagSubject, InventoryRow, InventorySnapshot, RoomText } from './inventory-types'

export type { BagFailure, BagHost, BagResult, BagSubject, InventoryRow, InventorySnapshot } from './inventory-types'

export interface RoomBagOptions {
  /** Weight the bag carries at most, kg. */
  readonly maxKg: number
  /** Volume of the bag, litres (a backpack: 30). */
  readonly litres?: number
  readonly slots?: number
  /** Inside length, width and height of the bag, metres. */
  readonly inside?: readonly [number, number, number]
}

/** The default bag is a backpack of the carry rules: its litres and inside dimensions are data in `DEFAULT_RULES.inventory`. */
export const DEFAULT_BAG = { litres: DEFAULT_RULES.inventory.bagLitres.backpack ?? 30, slots: 20, inside: DEFAULT_RULES.inventory.bagInside.backpack ?? DEFAULT_RULES.inventory.defaultInside } as const
const HOT_CELSIUS = 40
const CHARRED = 0.5
const MIN_DENT_MM = 1

export interface RoomBag {
  readonly element: HTMLElement
  readonly panel: InventoryPanel
  snapshot(): InventorySnapshot
  /** Puts what the player aims at into the bag, with its damage. */
  pickToBag(): BagResult
  /** Puts the hand (the tool, or the piece held) into the bag. */
  storeHeld(): BagResult
  equipSlot(slotId: number): BagResult
  dropSlot(slotId: number): BagResult
  /** A tool taken from the world into the hand: the inventory keeps it as `held`. False (and said) when it weighs too much. */
  holdTool(objectId: string): boolean
  /** The hand tool left (dropped, thrown, cleared). */
  releaseHand(): void
  /** I, P, O, Escape and the digits while the list is open; true when the key was used. */
  handleKey(code: string, modifiers: { shift: boolean; repeat: boolean }): boolean
}

/** The condition in words: a snapped handle, a bent blade in degrees, the holes, a heat worth noticing. */
export function describeCondition(state: ItemState | undefined, t: RoomText): string {
  const words: string[] = []
  const parts = state?.destruction?.state.parts ?? []
  if (state?.condition?.handleBroken) words.push(t('inv.handle_broken'))
  const bend = Math.max(state?.condition?.bend ?? 0, ...parts.map((part) => part.bend ?? 0))
  if (bend > 0.02) words.push(t('inv.blade_bent', { deg: Math.round((bend * 180) / Math.PI) }))
  const dentMm = Math.max(0, ...parts.flatMap((part) => part.dents.map((dent) => dent.depth * 1000)))
  if (dentMm >= MIN_DENT_MM) words.push(t('inv.dented', { mm: Math.round(dentMm) }))
  if (parts.some((part) => part.char >= CHARRED)) words.push(t('inv.charred'))
  const holes = parts.reduce((sum, part) => sum + part.holes.length, 0)
  if (holes > 0) words.push(t(holes === 1 ? 'count.hole.one' : 'count.hole.other', { n: holes }))
  if ((state?.temperatureC ?? 0) >= HOT_CELSIUS) words.push(t('inv.temperature', { degrees: Math.round(state?.temperatureC ?? 0) }))
  return words.length > 0 ? words.join(' · ') : t('inv.intact')
}

const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits

export function createRoomBag(host: BagHost, options: RoomBagOptions): RoomBag {
  const { t } = host
  const items = new Map<string, ItemDef>()
  const known = new Map<string, { name: string; weapon?: string }>()
  const limits = { slots: options.slots ?? DEFAULT_BAG.slots, kg: options.maxKg, litres: options.litres ?? DEFAULT_BAG.litres, inside: options.inside ?? DEFAULT_BAG.inside }
  const inventory: Inventory = createInventory({ items, bag: { slots: limits.slots, capacityKg: limits.kg, capacityLitres: limits.litres, inside: limits.inside } })

  const register = (subject: BagSubject): void => {
    if (!items.has(subject.itemId)) items.set(subject.itemId, { id: subject.itemId, category: 'room', size: subject.size, weight: subject.kg, ...(subject.litres === undefined ? {} : { volume: subject.litres }), rarity: 'common', stack: 1 })
    known.set(subject.itemId, { name: subject.name, ...(subject.weapon ? { weapon: subject.weapon } : {}) })
  }
  const nameOf = (itemId: string): string => known.get(itemId)?.name ?? itemId
  const fail = (reason: BagFailure, name: string, itemId?: string): BagResult => {
    const item = itemId ? items.get(itemId) : undefined
    const text = t(`inv.refused.${reason}`, { name, kg: round(item?.weight ?? 0, 1), maxKg: round(limits.kg, 0), litres: round(item ? itemLitres(item) : 0, 1), maxLitres: round(limits.litres, 0), length: decimal(Math.max(...(item?.size ?? [0])), 1), maxLength: decimal(Math.max(...limits.inside), 1) })
    host.say(text)
    host.action('inventory_refused', text, { ...(itemId ? { itemId } : {}), data: { reason } })
    return { ok: false, reason }
  }
  const decimal = (value: number, digits: number): string => String(round(value, digits)).replace('.', t('locale.decimal'))
  const rowOf = (stack: ItemStack, slotId: number | null): InventoryRow => {
    const item = items.get(stack.itemId)
    return {
      slotId,
      itemId: stack.itemId,
      name: nameOf(stack.itemId),
      count: stack.count,
      kg: (item?.weight ?? 0) * stack.count,
      litres: item ? itemLitres(item) * stack.count : 0,
      condition: describeCondition(stack.state, t),
      canEquip: known.get(stack.itemId)?.weapon !== undefined,
    }
  }
  const snapshot = (): InventorySnapshot => {
    const held = inventory.held()
    const totals = inventory.totals()
    return { rows: inventory.slots().map((slot) => rowOf(slot, slot.slotId)), held: held ? rowOf(held, null) : null, totals: { slots: totals.slots, kg: totals.kg, litres: totals.litres }, limits }
  }

  const panel = createInventoryPanel({
    t,
    snapshot,
    onEquip: (slotId) => void bag.equipSlot(slotId),
    onDrop: (slotId) => void bag.dropSlot(slotId),
    onStore: () => void bag.storeHeld(),
    onOpen: host.onOpen,
  })

  const bagObject = (objectId: string): BagResult => {
    const subject = host.inspect(objectId)
    if (!subject) return fail('cannot_pick', objectId)
    register(subject)
    const result = inventory.take({ itemId: subject.itemId, state: subject.state })
    if (!result.ok) return fail(result.reason as InventoryFailure, subject.name, subject.itemId)
    host.remove(objectId)
    host.action('pickup_bag', t('act.pickup_bag', { name: subject.name, kg: round(subject.kg, 1), litres: round(itemLitres(items.get(subject.itemId) as ItemDef), 1) }), { itemId: subject.itemId })
    return { ok: true }
  }

  const bag: RoomBag = {
    element: panel.element,
    panel,
    snapshot,
    pickToBag: () => {
      const objectId = host.aimedObject()
      const result = objectId ? bagObject(objectId) : fail('nothing_to_pick', '')
      panel.refresh()
      return result
    },
    storeHeld: () => {
      const hand = inventory.held()
      const pieceId = host.heldObject()
      let result: BagResult
      if (hand) {
        const stored = inventory.store()
        if (stored.ok) {
          host.clearHandTool()
          host.action('store_bag', t('act.store_bag', { name: nameOf(hand.itemId) }), { itemId: hand.itemId })
        }
        result = stored.ok ? { ok: true } : fail(stored.reason, nameOf(hand.itemId), hand.itemId)
      } else result = pieceId ? bagObject(pieceId) : fail('hand_empty', '')
      panel.refresh()
      return result
    },
    equipSlot: (slotId) => {
      const slot = inventory.slots().find((candidate) => candidate.slotId === slotId)
      if (!slot) return fail('not_found', '')
      const name = nameOf(slot.itemId)
      const weapon = known.get(slot.itemId)?.weapon
      if (!weapon) return fail('not_equippable', name, slot.itemId)
      if (host.heldObject()) return fail('hand_full', name, slot.itemId)
      const result = inventory.equip(slotId)
      if (!result.ok) return fail(result.reason, name, slot.itemId)
      host.equipTool({ itemId: slot.itemId, name, weapon, state: result.held.state ?? {} })
      host.action('equip_slot', t('act.equip_slot', { name }), { itemId: slot.itemId })
      panel.refresh()
      return { ok: true }
    },
    dropSlot: (slotId) => {
      const result = inventory.drop({ slotId })
      if (!result.ok) return fail(result.reason, '')
      host.placeBack({ itemId: result.dropped.itemId, name: nameOf(result.dropped.itemId), state: result.dropped.state ?? {} })
      panel.refresh()
      return { ok: true }
    },
    holdTool: (objectId) => {
      const subject = host.inspect(objectId)
      if (!subject) return false
      register(subject)
      const result = inventory.hold({ itemId: subject.itemId, state: subject.state })
      if (!result.ok) {
        fail(result.reason, subject.name, subject.itemId)
        return false
      }
      panel.refresh()
      return true
    },
    releaseHand: () => {
      if (inventory.held()) inventory.drop()
      panel.refresh()
    },
    handleKey: (code, { shift, repeat }) => {
      if (code === 'KeyI') {
        if (!repeat) panel.toggle()
        return true
      }
      if (code === 'KeyP' || code === 'KeyO') {
        if (!repeat) void (code === 'KeyP' ? bag.pickToBag() : bag.storeHeld())
        return true
      }
      if (!panel.open) return false
      if (code === 'Escape') panel.toggle(false)
      const digit = /^Digit([1-9])$/.exec(code)
      const slot = digit ? snapshot().rows[Number(digit[1]) - 1] : undefined
      if (!slot) return code === 'Escape'
      void (shift ? bag.dropSlot(slot.slotId as number) : bag.equipSlot(slot.slotId as number))
      return true
    },
  }
  return bag
}
