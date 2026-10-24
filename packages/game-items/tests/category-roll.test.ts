import { rng } from '@adatechnology/game-interactables'
import { describe, expect, it } from 'vitest'

import { rollByCategory } from '../src'
import type { ContainerDef, FindsQuery } from '../src'
import { item, makeCatalog, scripted } from './fixtures'

const fridge: ContainerDef = { id: 'fridge', count: [1, 3], categories: { food: 0.55, drink: 0.45 } }
const corpse: ContainerDef = { id: 'zombie_corpse', count: [1, 1], categories: { clothing: 1 } }
const shelf: ContainerDef = { id: 'store_shelf', count: [4, 4], categoriesByPlace: { pharmacy: { medical: 1 }, '*': { food: 1 } } }

const here = { finds: { places: ['house'] } }
const items = [
  item('beans', { ...here, rarity: 'common' }),
  item('cheese', { ...here, rarity: 'uncommon' }),
  item('caviar', { ...here, rarity: 'rare' }),
  item('relic', { ...here, rarity: 'legendary' }),
  item('water', { category: 'drink', ...here }),
  item('tshirt', { category: 'clothing' }),
  item('aspirin', { category: 'medical', finds: { places: ['pharmacy'] } }),
  item('gauze', { category: 'medical', finds: { places: ['pharmacy'] } }),
  item('cookie', { finds: { places: ['supermarket'] } }),
]
const catalog = makeCatalog(items, {}, { containers: [fridge, corpse, shelf] })

const query = (random: () => number, extra: Partial<FindsQuery> = {}): FindsQuery => ({ place: 'house', container: 'fridge', state: 'normal', rng: random, ...extra })

describe('rollByCategory: the order of the draws of the game rollItems', () => {
  it('draws the count first, then per stack the category and the item', () => {
    const script = scripted(0, 0.2, 0)
    expect(rollByCategory(catalog, query(script.random))).toEqual(['beans'])
    expect(script.draws()).toBe(3)
  })

  it('takes the count as low + floor(draw x (high - low + 1))', () => {
    expect(rollByCategory(catalog, query(scripted(0.99, 0, 0, 0, 0, 0, 0).random))).toHaveLength(3)
    expect(rollByCategory(catalog, query(scripted(0.34, 0, 0, 0, 0).random))).toHaveLength(2)
  })

  it('picks the category by subtracting the weights until the draw is at or below 0', () => {
    expect(rollByCategory(catalog, query(scripted(0, 0.55, 0).random))).toEqual(['beans'])
    expect(rollByCategory(catalog, query(scripted(0, 0.5500001, 0).random))).toEqual(['water'])
  })

  it('picks the item by rarity weight (60 / 28 / 9) among the items of the place', () => {
    const pick = (draw: number): string[] => rollByCategory(catalog, query(scripted(0, 0, draw).random))
    expect(pick(0)).toEqual(['beans'])
    expect(pick(60 / 97)).toEqual(['beans'])
    expect(pick(60.001 / 97)).toEqual(['cheese'])
    expect(pick(88.001 / 97)).toEqual(['caviar'])
    expect(pick(0.9999)).toEqual(['caviar'])
  })

  it('never rolls a legendary or unique item, nor an excluded id', () => {
    const everything = Array.from({ length: 40 }, (_, k) => rollByCategory(catalog, query(rng(`seed-${k}`)))).flat()
    expect(everything).not.toContain('relic')
    const withAmmo = makeCatalog([item('ammo_9x19', { category: 'ammo' }), item('ammo_7_62x39', { category: 'ammo' })], {}, { containers: [{ id: 'safe', count: [1, 1], categories: { ammo: 1 } }], categories: [{ id: 'ammo' }] })
    for (let k = 0; k < 20; k++) expect(rollByCategory(withAmmo, query(rng(k), { container: 'safe' }))).toEqual(['ammo_9x19'])
  })

  it('falls back to every item of the category when none lists the place, without an extra draw', () => {
    const script = scripted(0, 0, 0)
    expect(rollByCategory(catalog, query(script.random, { container: 'zombie_corpse' }))).toEqual(['tshirt'])
    expect(script.draws()).toBe(3)
  })

  it('draws nothing more for a category with nothing to roll', () => {
    const empty = makeCatalog([item('beans')], {}, { containers: [{ id: 'bin', count: [2, 2], categories: { tools: 1 } }] })
    const script = scripted(0, 0, 0)
    expect(rollByCategory(empty, query(script.random, { container: 'bin' }))).toEqual([])
    expect(script.draws()).toBe(3)
  })

  it('uses the corpse table for a container the catalog does not know, and gives nothing without a fallback', () => {
    expect(rollByCategory(catalog, query(scripted(0, 0, 0).random, { container: 'attic' }))).toEqual(['tshirt'])
    expect(rollByCategory(makeCatalog([item('beans')], {}, { containers: [fridge] }), query(scripted().random, { container: 'attic' }))).toEqual([])
  })

  it('takes the weights of the place when the container has none of its own', () => {
    expect(rollByCategory(catalog, query(scripted(0, 0, 0, 0, 0, 0, 0, 0, 0).random, { container: 'store_shelf', place: 'pharmacy' }))).toEqual(['aspirin', 'aspirin', 'aspirin', 'aspirin'])
    expect(rollByCategory(catalog, query(scripted(0, 0, 0, 0, 0, 0, 0, 0, 0).random, { container: 'store_shelf', place: 'supermarket' }))).toEqual(['cookie', 'cookie', 'cookie', 'cookie'])
  })

  it('is the same for the same seed', () => {
    const roll = (): string[] => rollByCategory(catalog, query(rng('same')))
    expect(roll()).toEqual(roll())
  })
})

describe('rollByCategory: the outbreak', () => {
  const supermarket = (day: number, region?: string): FindsQuery => query(scripted(0.99, 0, 0, 0, 0, 0, 0, 0, 0, 0).random, { container: 'store_shelf', place: 'supermarket', day, ...(region ? { region } : {}) })

  it('leaves day 0 exactly as the game rolls', () => {
    expect(rollByCategory(catalog, supermarket(0))).toHaveLength(4)
  })

  it('scales the count by max(floor, 1 - 4% x days) in a supermarket', () => {
    expect(rollByCategory(catalog, supermarket(10))).toHaveLength(2)
    expect(rollByCategory(catalog, supermarket(1000))).toHaveLength(1)
  })

  it('draws the count before scaling it: 3 stacks become 2 in a house on day 1000, and the draws follow the 2', () => {
    const script = scripted(0.99, 0, 0, 0, 0)
    expect(rollByCategory(catalog, query(script.random, { day: 1000 }))).toEqual(['beans', 'beans'])
    expect(script.draws()).toBe(5)
  })

  it('applies the multiplier of the region', () => {
    const regional = makeCatalog(items, {}, { containers: [shelf], rules: { finds: { regionMultiplier: { valley: 0.5 } } } })
    const result = rollByCategory(regional, query(scripted(0, 0, 0, 0, 0, 0, 0, 0, 0).random, { container: 'store_shelf', place: 'supermarket', region: 'valley' }))
    expect(result).toHaveLength(2)
  })
})
