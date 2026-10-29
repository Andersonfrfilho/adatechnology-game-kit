import { describe, expect, it } from 'vitest'

import { MATERIALS } from '@adatechnology/game-destruction'
import { CALIBERS, WEAPONS } from '@adatechnology/game-weapons'

import { checkGoodsItems, createGoodsKinds, GOODS_ITEMS, GOODS_KINDS, GOODS_KNOWN_GAPS, GOODS_RECIPES, lootCategoriesOf } from '../src'
import type { CheckGoodsOptions, KindedItem } from '../src'

const engines: CheckGoodsOptions = {
  materials: MATERIALS.map((material) => material.id),
  weaponIds: WEAPONS.map((weapon) => weapon.id),
  calibers: CALIBERS.map((caliber) => caliber.id),
}
const items = GOODS_ITEMS as unknown as readonly KindedItem[]
const kinds = createGoodsKinds()

/** The most the known gaps may ever be: lower it as gaps are closed, never raise it (a new item must satisfy its kind). */
const MAX_KNOWN_GAPS = 7

const tin: KindedItem = {
  id: 'test_tin',
  category: 'tools',
  kind: 'metal_can',
  size: [0.07, 0.1, 0.07],
  weight: 0.3,
  stack: 1,
  shape: 'can',
  color: 0,
} as unknown as KindedItem

describe('the kinds of the goods catalog', () => {
  it('has a sound tree', () => {
    expect(kinds.check()).toEqual([])
    expect(kinds.ids().length).toBe(GOODS_KINDS.length)
    expect(kinds.chain('canned_food')).toEqual(['item', 'consumable', 'food_ready', 'canned_food'])
    expect(kinds.requires('canned_food')).toEqual(['physical', 'destructible', 'impact', 'edible', 'use_animation', 'leftover'])
    expect(kinds.requires('cookware')).toContain('heat_resistant')
    expect(kinds.requires('electronics')).toContain('battery')
    expect(kinds.requires('fuel')).toContain('liquid_container')
  })

  it('gives every item a concrete kind', () => {
    for (const item of items) {
      expect(kinds.has(item.kind), `${item.id}: ${item.kind}`).toBe(true)
      expect(kinds.get(item.kind)?.abstract, `${item.id}: ${item.kind}`).not.toBe(true)
    }
  })

  it('keeps the category the loot rolls read inside what the kind declares', () => {
    for (const item of items) expect(lootCategoriesOf(kinds, item.kind), `${item.id}: ${item.kind}`).toContain(item.category)
  })

  it('passes every contract of its kind over the whole catalog, apart from the known gaps', () => {
    const report = checkGoodsItems({ ...engines })
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('lets a known gap through only while it still applies, and the list only shrinks', () => {
    const ids = new Set(items.map((item) => item.id))
    const strict = checkGoodsItems({ ...engines, allow: {} })
    const gapCount = Object.values(GOODS_KNOWN_GAPS).reduce((sum, list) => sum + list.length, 0)
    expect(gapCount).toBeLessThanOrEqual(MAX_KNOWN_GAPS)
    for (const [id, prefixes] of Object.entries(GOODS_KNOWN_GAPS)) {
      expect(ids.has(id), `known gap for unknown item ${id}`).toBe(true)
      for (const prefix of prefixes) {
        const reproduces = strict.problems.some((problem) => problem.startsWith(`"${id}" (`) && problem.includes(`: ${prefix}`))
        expect(reproduces, `the gap "${prefix}" of ${id} no longer applies: remove it from known-gaps.json`).toBe(true)
      }
    }
    expect(checkGoodsItems({ ...engines }).allowed.length).toBe(strict.problems.length)
  })

  it('marks every estimated field with a field the item really has', () => {
    for (const item of items) for (const field of item.estimated ?? []) expect(item, `${item.id}.${field}`).toHaveProperty(field)
  })

  it('accepts a new item that only declares what differs from its kind', () => {
    const report = checkGoodsItems({ ...engines, entries: [tin], allow: {} })
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('names the item, the kind, the problem and the kind that requires it', () => {
    const lacking = { ...tin, kind: 'canned_food', category: 'food' } as KindedItem
    const strangeMaterial = { ...lacking, id: 'test_can_b', parts: [{ id: 'body', material: 'unobtainium' }] } as unknown as KindedItem
    const report = checkGoodsItems({ ...engines, entries: [lacking, strangeMaterial], allow: {} })
    expect(report.problems).toContain('"test_tin" (canned_food): missing nutrition, required by food_ready')
    expect(report.problems).toContain('"test_tin" (canned_food): missing shelfLife (a number of days, or nonPerishable: true), required by food_ready')
    expect(report.problems).toContain('"test_can_b" (canned_food): part "body" has unknown material "unobtainium", required by item')
  })

  it('fails a bad size, an impossible density and a missing impact', () => {
    const bad = { ...tin, size: [0.07, 0, 0.07], weight: -1 } as unknown as KindedItem
    const heavy = { ...tin, id: 'test_heavy', weight: 500 } as KindedItem
    const report = checkGoodsItems({ ...engines, entries: [bad, heavy], allow: {} })
    expect(report.problems).toContain('"test_tin" (metal_can): size must be 3 finite positive numbers in metres, required by item')
    expect(report.problems).toContain('"test_tin" (metal_can): weight must be a finite number >= 0 (kg), required by item')
    expect(report.problems.some((problem) => problem.startsWith('"test_heavy" (metal_can): density 1'))).toBe(true)
    const odd = { ...tin, impact: { response: 'bounce', pushImpulse: 'yes' } } as unknown as KindedItem
    const impact = checkGoodsItems({ ...engines, entries: [odd], allow: {} })
    expect(impact.problems).toContain('"test_tin" (metal_can): impact.response must be one of dent, break, shatter, tear, squash, pierce, none, required by item')
    expect(impact.problems).toContain('"test_tin" (metal_can): impact.pushImpulse must be true or false, required by item')
  })

  it('fails an unknown or abstract kind', () => {
    const report = checkGoodsItems({ ...engines, entries: [{ ...tin, kind: 'spaceship' }, { ...tin, id: 'test_abstract', kind: 'container' }], allow: {} })
    expect(report.problems).toContain('"test_tin" has unknown kind "spaceship"')
    expect(report.problems).toContain('"test_abstract" has abstract kind "container"')
  })

  it('lets the kind supply what the item does not say, so changing the kind changes every item of it', () => {
    const tuned = createGoodsKinds({ patches: { metal_can: { defaults: { parts: [{ id: 'body', material: 'copper', thickness: 0.0005 }] } } } })
    expect(tuned.defaults('metal_can').parts).toEqual([{ id: 'body', material: 'copper', thickness: 0.0005 }])
    expect(kinds.defaults('metal_can').parts).toEqual([{ id: 'body', material: 'steel', thickness: 0.0002 }])
    expect(kinds.defaults('canned_food')).toMatchObject({ use: { clip: 'open_can_eat' }, leftover: { item: 'empty_can', despawnSeconds: 600 } })
  })

  it('inserts a parent between two kinds, and a new kind, by data alone', () => {
    const custom = createGoodsKinds({
      extra: [{ id: 'sealed_can', extends: 'food_ready', defaults: { impact: { response: 'dent', pushImpulse: true, shed: false } } }],
      patches: { canned_food: { extends: 'sealed_can' } },
    })
    expect(custom.check()).toEqual([])
    expect(custom.chain('canned_food')).toEqual(['item', 'consumable', 'food_ready', 'sealed_can', 'canned_food'])
    expect(custom.isA('canned_food', 'food_ready')).toBe(true)
    expect(checkGoodsItems({ ...engines, kinds: custom }).problems).toEqual([])
  })

  it('checks cookware against the materials that take a flame, plastic refused', () => {
    const pot = { ...tin, id: 'test_pot', kind: 'cookware', category: 'tools', parts: [{ id: 'body', material: 'plastic' }] } as unknown as KindedItem
    const report = checkGoodsItems({ ...engines, entries: [pot], allow: {} })
    expect(report.problems).toContain('"test_pot" (cookware): part "body" is plastic, which does not take a flame, required by cookware')
  })

  it('wants a recipe with fire and a pot for food that needs preparing, and a recipe at all for an ingredient', () => {
    const food = { ...tin, id: 'test_raw', kind: 'food_needs_prep', category: 'food', nutrition: { satiety: 5 }, shelfLife: 3, cookable: true, parts: [{ id: 'body', material: 'flesh_fruit' }] } as unknown as KindedItem
    const alone = checkGoodsItems({ ...engines, entries: [food], recipes: [], allow: {} })
    expect(alone.problems).toContain('"test_raw" (food_needs_prep): has no recipe that prepares it, required by food_needs_prep')
    const cooked = checkGoodsItems({ ...engines, entries: [food], items: [...items, food], recipes: GOODS_RECIPES, allow: {} })
    expect(cooked.problems.some((problem) => problem.includes('recipe'))).toBe(false)
  })
})
