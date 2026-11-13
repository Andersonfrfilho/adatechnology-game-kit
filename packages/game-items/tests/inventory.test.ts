import { describe, expect, it } from 'vitest'

import { bagOption, createInventory } from '../src'
import type { InventoryOptions, ItemState } from '../src'
import { item } from './fixtures'

const SHOVEL = item('shovel', { category: 'tools', size: [1.1, 0.07, 0.22], weight: 2, stack: 1 })
const BEANS = item('beans', { weight: 0.4, stack: 6, size: [0.07, 0.11, 0.07] })
const ROCK = item('rock', { weight: 5, size: [0.2, 0.2, 0.2] })
const CUSHION = item('cushion', { weight: 0.5, size: [0.4, 0.5, 0.1] })
const BACKPACK = item('backpack', { category: 'bags', size: [0.3, 0.3, 0.2], weight: 0.5, carry: { capacityKg: 10, weightReduction: 0.15, quickSlots: 0 } })

const catalog = new Map([SHOVEL, BEANS, ROCK, CUSHION, BACKPACK].map((entry) => [entry.id, entry]))
const makeInventory = (overrides: Partial<InventoryOptions> = {}) => createInventory({ items: catalog, bag: { slots: 6, capacityKg: 20, capacityLitres: 30 }, ...overrides })

/** A destruction object with two holes and a blade bent 0.6 rad, as `serializeObject` writes it. */
const damagedShovel = (): ItemState => ({
  destruction: {
    id: 'shovel_1',
    spec: { id: 'shovel', parts: [{ id: 'blade', tags: ['blade'] }, { id: 'handle', tags: ['handle'] }] },
    state: { parts: [{ id: 'blade', status: 'intact', hp: 40, maxHp: 60, bend: 0.6, holes: [{ x: 0.01, y: 0.02, r: 0.004 }, { x: -0.02, y: 0.05, r: 0.006 }] }, { id: 'handle', status: 'intact', hp: 30, maxHp: 30 }], joints: [] },
    runtime: { parts: { blade: { prevTemp: 20 } }, joints: {}, collapsed: [] },
  } as unknown as NonNullable<ItemState['destruction']>,
  condition: { handleBroken: false, bend: 0.6 },
  wear: 0.35,
  temperatureC: 41.5,
  ammo: { loaded: 3, reserve: 12 },
})

describe('inventory', () => {
  it('keeps damage deep-equal through take, equip, store and drop', () => {
    const inventory = makeInventory()
    const state = damagedShovel()
    const taken = inventory.take({ itemId: 'shovel', state })
    expect(taken.ok).toBe(true)
    const slotId = taken.ok ? (taken.slotIds[0] as number) : -1
    expect(inventory.slots()[0]?.state).toEqual(state)

    const equipped = inventory.equip(slotId)
    expect(equipped.ok && equipped.held.state).toEqual(state)
    expect(inventory.slots()).toHaveLength(0)

    const stored = inventory.store()
    expect(stored.ok).toBe(true)
    expect(inventory.slots()[0]?.state).toEqual(state)

    const dropped = inventory.drop({ slotId: inventory.slots()[0]?.slotId })
    expect(dropped.ok && dropped.dropped).toEqual({ itemId: 'shovel', count: 1, state })
  })

  it('keeps a bent shovel bent when it is equipped', () => {
    const inventory = makeInventory()
    const taken = inventory.take({ itemId: 'shovel', state: damagedShovel() })
    const equipped = taken.ok ? inventory.equip(taken.slotIds[0] as number) : undefined
    expect(equipped?.ok && equipped.held.state?.condition?.bend).toBe(0.6)
    const blade = inventory.held()?.state?.destruction?.state.parts.find((part) => part.id === 'blade')
    expect(blade?.bend).toBe(0.6)
    expect(blade?.holes).toHaveLength(2)
  })

  it('does not share state with the caller', () => {
    const inventory = makeInventory()
    const state = damagedShovel()
    inventory.take({ itemId: 'shovel', state })
    ;(state as { wear?: number }).wear = 0.99
    expect(inventory.slots()[0]?.state?.wear).toBe(0.35)
  })

  it('blocks by weight, then by volume, then by slots', () => {
    const inventory = makeInventory({ bag: { slots: 3, capacityKg: 8, capacityLitres: 30 } })
    expect(inventory.take({ itemId: 'rock' }).ok).toBe(true)
    expect(inventory.take({ itemId: 'rock' })).toEqual({ ok: false, reason: 'too_heavy' })
    expect(inventory.take({ itemId: 'cushion' }).ok).toBe(true)
    expect(inventory.take({ itemId: 'cushion' })).toEqual({ ok: false, reason: 'too_bulky' })
  })

  it('refuses when the slots are used', () => {
    const inventory = makeInventory({ bag: { slots: 1, capacityKg: 20, capacityLitres: 30 } })
    expect(inventory.take({ itemId: 'shovel' }).ok).toBe(true)
    expect(inventory.take({ itemId: 'rock' })).toEqual({ ok: false, reason: 'bag_full' })
  })

  it('reports unknown items, bad counts and an empty hand', () => {
    const inventory = makeInventory()
    expect(inventory.take({ itemId: 'nope' })).toEqual({ ok: false, reason: 'unknown_item' })
    expect(inventory.take({ itemId: 'beans', count: 0 })).toEqual({ ok: false, reason: 'bad_count' })
    expect(inventory.take({ itemId: 'shovel', count: 2, state: damagedShovel() })).toEqual({ ok: false, reason: 'bad_count' })
    expect(inventory.store()).toEqual({ ok: false, reason: 'hand_empty' })
    expect(inventory.drop()).toEqual({ ok: false, reason: 'hand_empty' })
    expect(inventory.equip(99)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('stacks stateless items up to their stack size and splits the rest', () => {
    const inventory = makeInventory()
    inventory.take({ itemId: 'beans', count: 4 })
    inventory.take({ itemId: 'beans', count: 5 })
    expect(inventory.slots().map((slot) => slot.count)).toEqual([6, 3])
    const dropped = inventory.drop({ slotId: 1, count: 2 })
    expect(dropped.ok && dropped.dropped.count).toBe(2)
    expect(inventory.slots()[0]?.count).toBe(4)
  })

  it('cannot equip into a full hand', () => {
    const inventory = makeInventory()
    const first = inventory.take({ itemId: 'shovel' })
    const second = inventory.take({ itemId: 'rock' })
    if (!first.ok || !second.ok) throw new Error('setup')
    expect(inventory.equip(first.slotIds[0] as number).ok).toBe(true)
    expect(inventory.equip(second.slotIds[0] as number)).toEqual({ ok: false, reason: 'hand_full' })
    expect(inventory.drop().ok).toBe(true)
    expect(inventory.held()).toBeUndefined()
  })

  it('totals weight and volume, counting the hand in kg only and a bag reduction on what is inside', () => {
    const inventory = makeInventory({ weightReduction: 0.5 })
    const shovel = inventory.take({ itemId: 'shovel' })
    inventory.take({ itemId: 'beans', count: 5 })
    expect(inventory.totals().kg).toBeCloseTo((2 + 5 * 0.4) * 0.5)
    expect(inventory.totals().litres).toBeCloseTo(1.1 * 0.07 * 0.22 * 1000 + 5 * 0.07 * 0.11 * 0.07 * 1000)
    if (shovel.ok) inventory.equip(shovel.slotIds[0] as number)
    expect(inventory.totals().kg).toBeCloseTo(2 + 5 * 0.4 * 0.5)
    expect(inventory.totals().litres).toBeCloseTo(5 * 0.07 * 0.11 * 0.07 * 1000)
    expect(inventory.totals().slots).toBe(1)
  })

  it('takes its limits from the bag item: a backpack holds 30 L', () => {
    expect(bagOption(BACKPACK, 20)).toMatchObject({ slots: 10, capacityKg: 20, capacityLitres: 30 })
    expect(bagOption(undefined, 20).capacityLitres).toBe(12)
  })
})

