import { generateLoot } from '@adatechnology/game-interactables'
import type { SlotSpec } from '@adatechnology/game-interactables'
import { describe, expect, it } from 'vitest'

import { placeFinds, toLootTables } from '../src'
import { item, makeCatalog } from './fixtures'

const catalog = makeCatalog([
  item('can', { size: [0.08, 0.11, 0.08], stack: 4 }),
  item('bottle', { size: [0.07, 0.28, 0.07] }),
  item('cereal', { size: [0.2, 0.3, 0.07] }),
  item('rare_wine', { rarity: 'rare', category: 'drink', size: [0.08, 0.3, 0.08], finds: { places: ['house'] } }),
  item('cheap_wine', { category: 'drink', size: [0.08, 0.3, 0.08], finds: { places: ['house'] } }),
])

const slot = (max: [number, number, number]): SlotSpec => ({ pos: [0, 0, 0], max })

describe('placeFinds', () => {
  const shelf = [slot([0.1, 0.12, 0.1]), slot([0.1, 0.3, 0.1]), slot([0.25, 0.35, 0.1])]

  it('puts each stack in the first free slot its item fits', () => {
    const { contents, leftover } = placeFinds([{ itemId: 'bottle', count: 1 }, { itemId: 'can', count: 1 }], shelf, catalog)
    expect(contents.map((stack) => stack?.type ?? null)).toEqual(['can', 'bottle', null])
    expect(leftover).toEqual([])
  })

  it('turns an item sideways (width and depth swap)', () => {
    const narrow = [slot([0.07, 0.4, 0.2])]
    expect(placeFinds([{ itemId: 'cereal', count: 1 }], narrow, catalog).contents[0]?.type).toBe('cereal')
  })

  it('splits a stack larger than the item stack over several slots', () => {
    const { contents } = placeFinds([{ itemId: 'can', count: 6 }], shelf, catalog)
    expect(contents.map((stack) => stack?.qty ?? 0)).toEqual([4, 2, 0])
  })

  it('returns what does not fit as leftover and keeps the data', () => {
    const { contents, leftover } = placeFinds([{ itemId: 'cereal', count: 2, data: { ageDays: 3 } }, { itemId: 'bottle', count: 1 }], [slot([0.25, 0.35, 0.1])], catalog)
    expect(contents[0]).toEqual({ type: 'cereal', qty: 1, data: { ageDays: 3 } })
    expect(leftover).toEqual([{ itemId: 'cereal', count: 1, data: { ageDays: 3 } }, { itemId: 'bottle', count: 1 }])
  })

  it('is the same for the same input', () => {
    const run = () => placeFinds([{ itemId: 'bottle', count: 2 }, { itemId: 'can', count: 3 }], shelf, catalog)
    expect(run()).toEqual(run())
  })
})

describe('toLootTables', () => {
  const tabled = makeCatalog(
    [
      item('cheap_wine', { category: 'drink', finds: { places: ['house'] } }),
      item('rare_wine', { category: 'drink', rarity: 'rare', finds: { places: ['house'] } }),
      item('relic', { category: 'drink', rarity: 'legendary', finds: { places: ['house'] } }),
      item('beans', { finds: { places: ['house'] } }),
    ],
    {},
    {
      containers: [
        { id: 'fridge', places: ['house'], count: [0, 4], categories: { food: 0.75, drink: 0.25 } },
        { id: 'bar', places: ['bar_place'], count: [1, 2], categories: { drink: 1 } },
        { id: 'crate', count: [2, 2], categories: { drink: 1 } },
      ],
    },
  )

  it('makes a table per container of the place, with the category and rarity weights', () => {
    const tables = toLootTables(tabled, { place: 'house' })
    expect(Object.keys(tables)).toEqual(['fridge', 'crate'])
    const fridge = tables.fridge
    expect(fridge?.entries.map((entry) => entry.type)).toEqual(['beans', 'cheap_wine', 'rare_wine'])
    expect(fridge?.entries.map((entry) => Number(entry.weight.toFixed(4)))).toEqual([0.75, 0.25 * (60 / 69), 0.25 * (9 / 69)].map((weight) => Number(weight.toFixed(4))))
  })

  it('fills a slot with the expected count over the most stacks, scaled by the day', () => {
    expect(toLootTables(tabled, { place: 'house' }).fridge?.fill).toBeCloseTo(0.5)
    expect(toLootTables(tabled, { place: 'house', day: 10 }).fridge?.fill).toBeCloseTo(0.5 * 0.9)
    expect(toLootTables(tabled, { place: 'house', day: 1000 }).fridge?.fill).toBeCloseTo(0.5 * 0.7)
    expect(toLootTables(tabled, { place: 'house' }).crate?.fill).toBe(1)
  })

  it('feeds generateLoot of the interactables and stays deterministic', () => {
    const tables = toLootTables(tabled, { place: 'house' })
    const slots = [slot([0.2, 0.4, 0.2]), slot([0.2, 0.4, 0.2]), slot([0.2, 0.4, 0.2])]
    const items = Object.fromEntries(tabled.list().map((entry) => [entry.id, entry]))
    const first = generateLoot(tables, 'crate', slots, 'seed', items)
    expect(first).toEqual(generateLoot(tables, 'crate', slots, 'seed', items))
    expect(first.filter(Boolean).every((stack) => ['cheap_wine', 'rare_wine'].includes(stack?.type ?? ''))).toBe(true)
  })
})
