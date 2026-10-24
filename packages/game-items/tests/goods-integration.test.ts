import { readFileSync } from 'node:fs'

import { rng } from '@adatechnology/game-interactables'
import { describe, expect, it } from 'vitest'

import { createFindsProvider, createItems, DEFAULT_RULES, rollByCategory, toLootTables } from '../src'
import type { ContainerDef, ItemDef, PoolEntry, UseEffectDef } from '../src'

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../game-items-goods/src/data/${name}.json`, import.meta.url), 'utf8')) as T

const pools = read<{ pools: Record<string, PoolEntry[]>; aliasOf: Record<string, string> }>('house-pools')
const catalog = createItems({
  packs: [{ id: 'goods', items: read<ItemDef[]>('items'), categories: read('categories'), places: read('places'), containers: read<ContainerDef[]>('containers'), useEffects: read<UseEffectDef[]>('use-effects'), pools: pools.pools, poolAliases: pools.aliasOf }],
})

describe('the default rules agree with the data read from the team deliveries', () => {
  it('has the depletion table of the page', () => {
    expect(DEFAULT_RULES.finds.depletion).toEqual(read<{ places: string[]; perDay: number; floor: number }[]>('depletion'))
  })

  it('has the spawn numbers of the page: condition by rarity, age share, battery charge, jerrycan fill', () => {
    const spawn = read<{ condition: Record<string, [number, number]>; ageShareOfShelfLife: [number, number]; batteryCharge: [number, number]; jerrycanFill: [number, number] }>('spawn')
    expect(DEFAULT_RULES.spawn).toMatchObject({ condition: spawn.condition, ageShare: spawn.ageShareOfShelfLife, charge: spawn.batteryCharge, fill: spawn.jerrycanFill })
  })

  it('has the rarity weights of the game and the id of the box the game never rolls', () => {
    const spawn = read<{ rarityWeights: Record<string, number> }>('spawn')
    expect(DEFAULT_RULES.rarity.weights).toMatchObject(spawn.rarityWeights)
    expect(read<{ id: string }[]>('ammo-boxes').map((box) => box.id)).toContain(DEFAULT_RULES.finds.rollExcluded[0])
    expect(catalog.containers.has(DEFAULT_RULES.finds.fallbackContainer)).toBe(true)
  })

  it('has the items the pool rules name', () => {
    for (const id of [DEFAULT_RULES.finds.pool.junkItem, DEFAULT_RULES.finds.pool.spoiledFoodItem, ...DEFAULT_RULES.spawn.fillable]) expect(catalog.has(id), id).toBe(true)
  })
})

describe('finds over the real catalog', () => {
  const provider = createFindsProvider(catalog)
  const query = (container: string, place: string, seed: number, extra: object = {}) => ({ place, container, state: 'normal', rng: rng(seed), ...extra })

  it('rolls every container of the catalog, in every place it lists, without error and only with real items', () => {
    for (const container of catalog.containers.values()) {
      for (const place of container.places?.length ? container.places : ['house']) {
        for (let seed = 1; seed <= 5; seed++) for (const stack of provider.findsFor(query(container.id, place, seed))) expect(catalog.has(stack.itemId), `${container.id}/${place}: ${stack.itemId}`).toBe(true)
      }
    }
  })

  it('draws from the explicit pool of every key, in the three states', () => {
    for (const key of [...Object.keys(pools.pools), ...Object.keys(pools.aliasOf)]) {
      for (const state of ['normal', 'fortified', 'abandoned']) {
        const stacks = provider.findsFor(query('house_furniture', 'house', 7, { key, state, footprint: 1 }))
        for (const stack of stacks) expect(catalog.has(stack.itemId), `${key}/${state}`).toBe(true)
      }
    }
  })

  it('finds fewer things in a pharmacy as the days pass', () => {
    const total = (day: number): number => Array.from({ length: 40 }, (_, seed) => provider.findsFor(query('store_shelf', 'pharmacy', seed, { day })).length).reduce((sum, count) => sum + count, 0)
    expect(total(0)).toBeGreaterThan(total(10))
    expect(total(10)).toBeGreaterThan(total(100))
  })

  it('never rolls a legendary or unique item', () => {
    for (let seed = 0; seed < 200; seed++) for (const id of rollByCategory(catalog, query('safe', 'police_station', seed))) expect(['legendary', 'unique']).not.toContain(catalog.get(id).rarity)
  })

  it('builds loot tables for the interactables for a house and a pharmacy', () => {
    expect(Object.keys(toLootTables(catalog, { place: 'house' }))).toEqual(expect.arrayContaining(['fridge', 'kitchen_cabinet', 'wardrobe']))
    expect(toLootTables(catalog, { place: 'pharmacy' }).store_shelf?.entries.every((entry) => catalog.get(entry.type).category === 'medical')).toBe(true)
  })
})
