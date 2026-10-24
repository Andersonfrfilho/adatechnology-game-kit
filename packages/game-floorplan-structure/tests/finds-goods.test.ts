import { createGoodsFindsProvider, createGoodsItems, FLOORPLAN_POOL_KEYS, GOODS_HOUSE_POOLS } from '@adatechnology/game-items-goods'
import { describe, expect, it } from 'vitest'

import { CONTENT_TABLES } from '../src/utilities/content-tables'
import { engine } from './support'

const catalog = createGoodsItems()
const generate = (template: string, seed: number, state = 'normal', extra: Record<string, unknown> = {}): any => engine.generate(template, { seed, state, ...extra })

describe('the goods catalog answers what the furniture holds (composition of the floorplan with the items)', () => {
  it('has a pool for every content table of the structure pack that the visor has one for, and no more', () => {
    const covered = Object.keys(FLOORPLAN_POOL_KEYS)
    for (const key of covered) expect(GOODS_HOUSE_POOLS.pools[FLOORPLAN_POOL_KEYS[key]!] ?? GOODS_HOUSE_POOLS.aliasOf[FLOORPLAN_POOL_KEYS[key]!], key).toBeDefined()
    for (const container of Object.keys(CONTENT_TABLES)) expect(covered, container).toContain(container)
    for (const container of covered) if (container !== 'overhead_cabinet') expect(CONTENT_TABLES[container], container).toBeDefined()
  })

  it('passes the outbreak day and the region from the plan options to the provider', () => {
    const asked: { day?: number; region?: string; place: string; footprint?: number }[] = []
    engine.registerFindsProvider({ findsFor: (query) => { asked.push({ place: query.place, ...(query.day === undefined ? {} : { day: query.day }), ...(query.region === undefined ? {} : { region: query.region }), ...(query.footprint === undefined ? {} : { footprint: query.footprint }) }); return null } })
    generate('single_storey_a', 2, 'normal', { day: 12, region: 'valley' })
    expect(asked.length).toBeGreaterThan(0)
    for (const query of asked) expect(query).toMatchObject({ place: 'house', day: 12, region: 'valley' })
    asked.length = 0
    generate('single_storey_a', 2)
    for (const query of asked) expect(query.day).toBeUndefined()
    asked.length = 0
  })

  it('draws a fridge from the visor pool, in a house, with real catalog items', () => {
    const before = engine.findsFor({ place: 'house', container: 'fridge', state: 'normal', rng: engine.createRng(1, 'k') })
    expect(before).toEqual([])
    engine.registerFindsProvider(createGoodsFindsProvider(catalog))
    const seen = new Set<string>()
    for (let seed = 1; seed <= 15; seed++) {
      const result = generate('single_storey_a', seed)
      const fridge = result.items.find((m: any) => m.category === 'fridge')
      const stacks = result.contents[fridge.id] as { itemId: string }[]
      expect(stacks.length, `seed ${seed}`).toBeGreaterThan(0)
      for (const stack of stacks) {
        expect(catalog.has(stack.itemId), stack.itemId).toBe(true)
        seen.add(stack.itemId)
      }
    }
    expect(seen.has('water_bottle') || seen.has('milk_carton')).toBe(true)
  })

  it('every piece of furniture that holds something gets its answer from the catalog, in the three states', () => {
    for (const state of ['normal', 'fortified', 'abandoned']) {
      for (const template of ['single_storey_a', 'townhouse', 'mansion', 'mid_modern_townhouse']) {
        const result = generate(template, 3, state)
        for (const stacks of Object.values(result.contents) as { itemId: string }[][]) for (const stack of stacks) expect(catalog.has(stack.itemId), `${template}/${state}: ${stack.itemId}`).toBe(true)
      }
    }
  })

  it('an abandoned fridge is nearly empty and keeps a rotten meal; a fortified house stocks more', () => {
    let spoiled = 0
    let normal = 0
    let fortified = 0
    for (let seed = 1; seed <= 20; seed++) {
      const abandoned = generate('single_storey_a', seed, 'abandoned')
      const fridge = abandoned.items.find((m: any) => m.category === 'fridge')
      if ((abandoned.contents[fridge.id] as { itemId: string }[]).some((stack) => stack.itemId === 'leftover_meal')) spoiled++
      for (const [state, set] of [['normal', 'n'], ['fortified', 'f']] as const) {
        const result = generate('single_storey_a', seed, state)
        const total = (Object.values(result.contents) as { count: number }[][]).flat().reduce((sum, stack) => sum + stack.count, 0)
        if (set === 'n') normal += total
        else fortified += total
      }
    }
    expect(spoiled).toBe(20)
    expect(fortified).toBeGreaterThan(normal)
  })

  it('a template place the catalog names differently is mapped (a cabin is a lodge, a shack a house)', () => {
    const provider = createGoodsFindsProvider(catalog)
    const query = (place: string) => provider.findsFor({ place, container: 'kitchen_cabinet', state: 'normal', rng: engine.createRng(5, 'k'), footprint: 1 })
    expect(query('shack')).toEqual(query('house'))
    expect(query('cabin')).toEqual(query('lodge'))
  })

  it('a supermarket shelf is not a house pool: it rolls its container table', () => {
    const provider = createGoodsFindsProvider(catalog)
    const stacks = provider.findsFor({ place: 'supermarket', container: 'fridge', state: 'normal', rng: engine.createRng(9, 'k'), footprint: 1 })
    for (const stack of stacks ?? []) expect(catalog.get(stack.itemId).finds?.places ?? ['supermarket']).toContain('supermarket')
  })
})
