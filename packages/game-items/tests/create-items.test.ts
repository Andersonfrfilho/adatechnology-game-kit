import { describe, expect, it } from 'vitest'

import { createItems, ITEM_CATEGORIES } from '../src'
import type { ItemDef, ItemPack } from '../src'

const item = (id: string, extra: Partial<ItemDef> = {}): ItemDef => ({ id, category: 'food', size: [0.1, 0.2, 0.1], weight: 0.4, rarity: 'common', ...extra })
const pack = (id: string, items: ItemDef[], extra: Partial<ItemPack> = {}): ItemPack => ({ id, items, ...extra })

describe('createItems', () => {
  it('starts empty with the 14 categories and the default rules', () => {
    const catalog = createItems()
    expect(catalog.list()).toEqual([])
    expect([...catalog.categories.keys()]).toEqual(ITEM_CATEGORIES.map((category) => category.id))
    expect(ITEM_CATEGORIES).toHaveLength(14)
    expect(catalog.rules.freshness).toEqual({ stale: 0.5, spoiled: 1, rotten: 1.5 })
  })

  it('merges packs in order, a later item replacing the same id', () => {
    const catalog = createItems({ packs: [pack('a', [item('can'), item('rope')]), pack('b', [item('can', { weight: 0.5 })])] })
    expect(catalog.list().map((entry) => entry.id)).toEqual(['can', 'rope'])
    expect(catalog.get('can').weight).toBe(0.5)
  })

  it('derives the volume from the size unless the pack gives it', () => {
    const catalog = createItems({ packs: [pack('a', [item('can', { size: [0.1, 0.2, 0.5] }), item('jug', { volume: 4 })])] })
    expect(catalog.get('can').volume).toBeCloseTo(10)
    expect(catalog.get('jug').volume).toBe(4)
  })

  it('patches nested fields, ignoring ids that do not exist', () => {
    const catalog = createItems({
      packs: [pack('a', [item('can', { nutrition: { satiety: 20, hydration: 5 } })])],
      patch: { can: { weight: 0.6, nutrition: { satiety: 30 } }, ghost: { weight: 1 } },
    })
    expect(catalog.get('can')).toMatchObject({ weight: 0.6, nutrition: { satiety: 30, hydration: 5 } })
    expect(catalog.has('ghost')).toBe(false)
  })

  it('removes ids and filters with include, after the patches', () => {
    const catalog = createItems({
      packs: [pack('a', [item('can'), item('rope', { category: 'tools' }), item('saw', { category: 'tools' })])],
      remove: ['saw'],
      include: (entry) => entry.category === 'tools',
    })
    expect(catalog.list().map((entry) => entry.id)).toEqual(['rope'])
  })

  it('indexes by category, place and tag', () => {
    const catalog = createItems({
      packs: [
        pack('a', [item('can', { tags: ['kitchen', 'perishable'], finds: { places: ['house'] } }), item('rope', { category: 'tools', finds: { places: ['house', 'farm'] } })], {
          places: [{ id: 'house' }, { id: 'farm' }],
        }),
      ],
    })
    expect(catalog.byCategory('tools').map((entry) => entry.id)).toEqual(['rope'])
    expect(catalog.byPlace('house').map((entry) => entry.id)).toEqual(['can', 'rope'])
    expect(catalog.byPlace('farm').map((entry) => entry.id)).toEqual(['rope'])
    expect(catalog.byTag('perishable').map((entry) => entry.id)).toEqual(['can'])
    expect(catalog.byTag('none')).toEqual([])
  })

  it('accepts categories, places and containers from packs and options', () => {
    const catalog = createItems({
      packs: [pack('a', [item('relic', { category: 'lore' })], { categories: [{ id: 'lore' }], places: [{ id: 'crypt' }] })],
      places: [{ id: 'house' }],
      containers: [{ id: 'fridge', categories: { food: 3 }, count: [1, 4] }],
    })
    expect(catalog.categories.has('lore')).toBe(true)
    expect([...catalog.places.keys()]).toEqual(['crypt', 'house'])
    expect(catalog.containers.get('fridge')?.count).toEqual([1, 4])
  })

  it('merges rules field by field', () => {
    const catalog = createItems({ rules: { carry: { baseKg: 10 }, storage: { fridge: { multiplier: 0.2 } }, spawn: { retailNew: false } } })
    expect(catalog.rules.carry).toMatchObject({ baseKg: 10, perStrengthKg: 2.5, factor: 1.2 })
    expect(catalog.rules.storage.fridge).toEqual({ multiplier: 0.2, needsPower: true })
    expect(catalog.rules.storage.freezer?.multiplier).toBe(0.1)
    expect(catalog.rules.spawn.retailNew).toBe(false)
  })

  it('throws on an unknown id', () => {
    expect(() => createItems().get('nothing')).toThrow('unknown item "nothing"')
  })
})

describe('createItems validation', () => {
  const failure = (options: Parameters<typeof createItems>[0]): string => {
    try {
      createItems(options)
    } catch (error) {
      return (error as Error).message
    }
    return ''
  }

  it('reports duplicate ids inside a pack and in the option lists', () => {
    const message = failure({ packs: [pack('a', [item('can'), item('can')])], categories: [{ id: 'x' }, { id: 'x' }] })
    expect(message).toContain('item in pack "a" "can" is listed more than once')
    expect(message).toContain('category "x" is listed more than once')
  })

  it('reports every problem of an item in one error', () => {
    const message = failure({
      packs: [pack('a', [item('bad', { category: 'nope', rarity: 'epic' as ItemDef['rarity'], size: [0, 1, 1], weight: -1, shelfLife: 0, portions: 1.5 })])],
    })
    for (const text of ['unknown category "nope"', 'unknown rarity "epic"', 'invalid size', 'weight of -1', 'shelf life of 0', '1.5 portions']) expect(message).toContain(text)
  })

  it('checks protection, carry, places and containers', () => {
    const message = failure({
      packs: [
        pack(
          'a',
          [
            item('vest', { category: 'clothing', protection: { slots: ['tail' as never], bite: 1.4 }, finds: { places: ['moon'] }, carry: { capacityKg: 0, weightReduction: 0.1, quickSlots: 0 } }),
          ],
          { places: [{ id: 'house' }], containers: [{ id: 'box', categories: { ghost: 1 }, count: [3, 1] }] },
        ),
      ],
    })
    for (const text of ['unknown body slot "tail"', 'protection value outside 0..1', 'invalid carry', 'unknown place "moon"', 'unknown category "ghost"', 'invalid count [3, 1]']) expect(message).toContain(text)
  })

  it('does not check places while none is registered', () => {
    expect(() => createItems({ packs: [pack('a', [item('can', { finds: { places: ['anywhere'] } })])] })).not.toThrow()
  })

  it('rejects inconsistent rules', () => {
    const message = failure({ rules: { freshness: { stale: 2 }, carry: { overloaded: 0.5 }, protection: { cap: 1.5 }, rarity: { weights: { common: 0, uncommon: 0, rare: 0, very_rare: 0, legendary: 0 } } } })
    for (const text of ['rules.freshness', 'rules.carry', 'rules.protection', 'rules.rarity.weights']) expect(message).toContain(text)
  })
})
