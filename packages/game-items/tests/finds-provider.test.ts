import { rng } from '@adatechnology/game-interactables'
import { describe, expect, it } from 'vitest'

import { createFindsProvider, rollByCategory } from '../src'
import type { FindsQuery, ItemDef } from '../src'
import { item, makeCatalog, scripted } from './fixtures'

const items: ItemDef[] = [
  item('beans', { finds: { places: ['house', 'supermarket'] }, shelfLife: 100 }),
  item('water', { category: 'drink', finds: { places: ['house', 'supermarket'] } }),
  item('batteries', { category: 'electronics', finds: { places: ['house'] }, charge: { lossPerMonth: 0.1 } }),
  item('jacket', { category: 'clothing', rarity: 'rare', finds: { places: ['house', 'supermarket'] }, protection: { slots: ['torso'], bite: 0.25 } }),
  item('fuel_jerrycan', { category: 'fuel', finds: { places: ['house'] } }),
  item('milk', { shelfLife: 10 }),
  item('food_packaging', { category: 'materials' }),
  item('leftover_meal', { shelfLife: 5 }),
]

const build = (extra: Parameters<typeof makeCatalog>[2] = {}) =>
  makeCatalog(
    items,
    { pools: { fridge: [{ item: 'milk', weight: 1, qty: [1, 1] }, { item: 'gone', weight: 1, qty: [1, 1] }], wardrobe: [{ item: 'jacket', weight: 1, qty: [1, 1] }] }, poolAliases: { garage_wardrobe: 'wardrobe' } },
    {
      containers: [
        { id: 'kitchen_cabinet', count: [3, 3], categories: { food: 1 } },
        { id: 'store_shelf', count: [3, 3], categories: { food: 1 } },
        { id: 'wardrobe', count: [1, 1], categories: { clothing: 1 } },
        { id: 'garage', count: [4, 4], categories: { electronics: 0.5, fuel: 0.5 } },
        { id: 'drinks', count: [1, 1], categories: { drink: 1 } },
        { id: 'zombie_corpse', count: [1, 1], categories: { clothing: 1 } },
      ],
      ...extra,
    },
  )

const ask = (container: string, random: () => number, extra: Partial<FindsQuery> = {}): FindsQuery => ({ place: 'house', container, state: 'normal', rng: random, ...extra })

describe('createFindsProvider', () => {
  const catalog = build()

  it('answers with the category roll for a container without a pool, one stack per pick', () => {
    const stacks = createFindsProvider(catalog).findsFor(ask('kitchen_cabinet', rng('a')))
    expect(stacks).toHaveLength(3)
    expect(stacks.every((stack) => stack.count === 1 && stack.itemId === 'beans')).toBe(true)
  })

  it('answers with the explicit pool of the key, or of the container, and drops items the catalog lost', () => {
    const provider = createFindsProvider(catalog)
    const stacks = provider.findsFor(ask('whatever', rng(3), { key: 'fridge', footprint: 2, state: 'fortified' }))
    expect(stacks.map((stack) => stack.itemId)).toEqual(['milk'])
    expect(provider.findsFor(ask('fridge', rng(3), { footprint: 2 })).map((stack) => stack.itemId)).toEqual(['milk'])
  })

  it('resolves pool aliases', () => {
    const stacks = createFindsProvider(catalog).findsFor(ask('x', rng(1), { key: 'garage_wardrobe' }))
    expect(stacks.map((stack) => stack.itemId)).toEqual(['jacket'])
  })

  it('ignores the pools with pools: none', () => {
    const stacks = createFindsProvider(catalog, { pools: 'none' }).findsFor(ask('wardrobe', rng(1)))
    expect(stacks.map((stack) => stack.itemId)).toEqual(['jacket'])
    const fridge = createFindsProvider(catalog, { pools: 'none' }).findsFor(ask('fridge', rng(1)))
    expect(fridge.map((stack) => stack.itemId)).toEqual(['jacket'])
  })

  it('is deterministic with the seed and different with another', () => {
    const provider = createFindsProvider(catalog)
    const run = (seed: string) => provider.findsFor(ask('garage', rng(seed)))
    expect(run('s1')).toEqual(run('s1'))
    expect(Array.from({ length: 12 }, (_, k) => JSON.stringify(run(`seed-${k}`))).filter((value, index, all) => all.indexOf(value) === index).length).toBeGreaterThan(1)
  })

  it('chooses every stack before drawing any state, so the choice matches the rolls of the game', () => {
    const provider = createFindsProvider(catalog)
    for (let k = 0; k < 15; k++) {
      expect(provider.findsFor(ask('garage', rng(k))).map((stack) => stack.itemId)).toEqual(rollByCategory(catalog, ask('garage', rng(k))))
    }
  })

  it('does not change what is found when another game rules the spawn', () => {
    const quiet = createFindsProvider(catalog, { rules: { spawn: { ageShare: [0, 0] } } })
    expect(quiet.findsFor(ask('garage', rng(2))).map((stack) => stack.itemId)).toEqual(rollByCategory(catalog, ask('garage', rng(2))))
  })
})

describe('the state of what is found', () => {
  const provider = createFindsProvider(build())

  it('gives food the age of the outbreak days plus 0 to 60% of the shelf life', () => {
    const stack = provider.findsFor(ask('kitchen_cabinet', scripted(0, 0, 0, 0, 0, 0.5, 0).random, { day: 20 }))[0]
    expect(stack?.data?.ageDays).toBeCloseTo(20 + 0.5 * 0.6 * 100)
  })

  it('at day 0 the age is just the normal turnover of the shelf', () => {
    const stack = provider.findsFor(ask('kitchen_cabinet', scripted(0, 0, 0, 0, 0, 0, 0, 1, 0, 0).random))[0]
    expect(stack?.data?.ageDays).toBeCloseTo(60)
  })

  it('draws condition by rarity: a rare jacket 50 to 100', () => {
    const low = provider.findsFor(ask('wardrobe', scripted(0, 0, 0, 0).random, { day: 5 }))[0]
    const high = provider.findsFor(ask('wardrobe', scripted(0, 0, 0, 0.999).random, { day: 5 }))[0]
    expect(low?.data?.condition).toBe(50)
    expect(high?.data?.condition).toBe(100)
  })

  it('shop stock is brand new on day 0 and has the rare range after', () => {
    const shop = build({ containers: [{ id: 'store_shelf', count: [1, 1], categories: { clothing: 1 } }] })
    const shopProvider = createFindsProvider(shop)
    const day0 = shopProvider.findsFor(ask('store_shelf', scripted(0, 0, 0).random, { place: 'supermarket' }))[0]
    const later = shopProvider.findsFor(ask('store_shelf', scripted(0, 0, 0, 0).random, { place: 'supermarket', day: 3 }))[0]
    const house = shopProvider.findsFor(ask('store_shelf', scripted(0, 0, 0, 0).random))[0]
    expect(day0?.data?.condition).toBe(100)
    expect(later?.data?.condition).toBe(50)
    expect(house?.data?.condition).toBe(50)
  })

  it('lets a game turn the new-stock rule off', () => {
    const shop = createFindsProvider(build({ containers: [{ id: 'store_shelf', count: [1, 1], categories: { clothing: 1 } }] }), { rules: { spawn: { retailNew: false } } })
    expect(shop.findsFor(ask('store_shelf', scripted(0, 0, 0, 0).random, { place: 'supermarket' }))[0]?.data?.condition).toBe(50)
  })

  it('gives batteries 20 to 100% of the charge and a jerrycan 0 to 60% full', () => {
    const battery = provider.findsFor(ask('garage', scripted(0.99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0).random))[0]
    expect(battery?.itemId).toBe('batteries')
    expect(battery?.data?.charge).toBeCloseTo(0.2)
    const jerrycan = provider.findsFor(ask('garage', scripted(0.99, 0.99, 0, 0, 0.99, 0, 0, 0, 0, 0, 0, 0, 0).random))[0]
    expect(jerrycan?.itemId).toBe('fuel_jerrycan')
    expect(jerrycan?.data?.fill).toBeCloseTo(0)
  })

  it('has no data for an item with nothing to remember', () => {
    const stack = provider.findsFor(ask('drinks', scripted(0, 0, 0).random))[0]
    expect(stack).toEqual({ itemId: 'water', count: 1 })
  })
})

describe('day 0 against day N', () => {
  const provider = createFindsProvider(build())

  it('finds fewer stacks in a shop as the days pass, down to the floor', () => {
    const count = (day: number): number => provider.findsFor(ask('store_shelf', () => 0, { place: 'supermarket', day })).length
    expect([count(0), count(5), count(100)]).toEqual([3, 2, 1])
  })

  it('leaves a military base untouched, whatever the day', () => {
    const base = makeCatalog(items, {}, { containers: [{ id: 'military_crate', count: [4, 4], categories: { food: 1 } }] })
    const military = createFindsProvider(base)
    expect(military.findsFor(ask('military_crate', () => 0, { place: 'military_base', day: 500 }))).toHaveLength(4)
    expect(military.findsFor(ask('military_crate', () => 0, { place: 'military_base' }))).toHaveLength(4)
  })
})

describe('the options of a host that composes the provider (a floorplan)', () => {
  const catalog = build()

  it('maps the places a host names differently, and the pools only apply in the places that list them', () => {
    const provider = createFindsProvider(catalog, { placeAliases: { cabin: 'house' }, poolPlaces: ['house'] })
    expect(provider.findsFor(ask('fridge', rng(3), { place: 'cabin', footprint: 2 })).map((stack) => stack.itemId)).toEqual(['milk'])
    // outside the listed places the pool is left alone: the container has no table, so it falls to the corpse table
    expect(provider.findsFor(ask('fridge', rng(3), { place: 'supermarket', footprint: 2 })).map((stack) => stack.itemId)).toEqual(['jacket'])
  })

  it('answers null for a container it knows nothing about, when asked to pass', () => {
    const provider = createFindsProvider(catalog, { unknownContainers: 'pass' })
    expect(provider.findsFor(ask('sofa', rng(1)))).toBeNull()
    expect(provider.findsFor(ask('kitchen_cabinet', rng(1)))).toHaveLength(3)
    expect(provider.findsFor(ask('fridge', rng(3), { footprint: 2 }))?.map((stack) => stack.itemId)).toEqual(['milk'])
  })

  it('keeps the spoiled food of the abandoned state by container id as well as by key', () => {
    const cold = createFindsProvider(catalog, { rules: { finds: { pool: { coldContainers: ['fridge'] } } } })
    const stacks = cold.findsFor(ask('fridge', () => 0.99, { key: 'fridge_1', state: 'abandoned', footprint: 1 }))
    expect(stacks.map((stack) => stack.itemId)).toContain('leftover_meal')
  })
})
