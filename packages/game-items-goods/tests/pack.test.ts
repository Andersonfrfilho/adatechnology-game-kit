import { createItems, itemsFromArsenal, RARITIES } from '@adatechnology/game-items'
import { checkArsenal, createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createGoodsItems, GOODS_ARSENAL_RECORDS, GOODS_CATEGORIES, GOODS_CONTAINERS, GOODS_HOUSE_POOLS, GOODS_ITEMS, GOODS_PLACES, GOODS_PROVENANCE, GOODS_RECIPES, GOODS_TABLES, GOODS_USE_EFFECTS, goodsPack } from '../src'

const catalog = createGoodsItems()
const ids = GOODS_ITEMS.map((item) => item.id)

describe('the goods pack', () => {
  it('is a valid catalog for createItems, alone and through createGoodsItems', () => {
    expect(createItems({ packs: [goodsPack] }).items.size).toBe(GOODS_ITEMS.length)
    expect(catalog.items.size).toBe(327)
    expect(catalog.categories.size).toBe(14 + 3)
    expect(catalog.places.size).toBe(24)
    expect(catalog.containers.size).toBe(17)
    expect(catalog.recipes.size).toBe(33)
    expect(catalog.useEffects).toHaveLength(9)
  })

  it('has unique, English, snake_case ids', () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id, id).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
  })

  it('lets the game extend and change it after the goods', () => {
    const extended = createGoodsItems({ patch: { canned_beans: { weight: 0.5 } }, remove: ['dvd'], packs: [{ id: 'game', items: [{ ...catalog.get('note'), id: 'diary', category: 'collectibles' }] }] })
    expect(extended.get('canned_beans').weight).toBe(0.5)
    expect(extended.has('dvd')).toBe(false)
    expect(extended.has('diary')).toBe(true)
  })

  it('uses only categories, places and rarities the pack declares', () => {
    const categories = new Set(GOODS_CATEGORIES.map((category) => category.id))
    const places = new Set(GOODS_PLACES.map((place) => place.id))
    for (const item of GOODS_ITEMS) {
      expect(categories.has(item.category), `${item.id}: ${item.category}`).toBe(true)
      expect(RARITIES).toContain(item.rarity)
      for (const place of item.finds?.places ?? []) expect(places.has(place), `${item.id}: ${place}`).toBe(true)
    }
    for (const container of GOODS_CONTAINERS) {
      for (const place of container.places ?? []) expect(places.has(place), `${container.id}: ${place}`).toBe(true)
      for (const category of Object.keys(container.categories ?? {})) expect(categories.has(category), `${container.id}: ${category}`).toBe(true)
    }
    expect(GOODS_TABLES.rarities.map((rarity) => rarity.id)).toEqual([...RARITIES])
  })

  it('has every item the pools, recipes, use effects, melee table and ammo boxes name', () => {
    const known = new Set(ids)
    for (const [key, entries] of Object.entries(GOODS_HOUSE_POOLS.pools)) for (const entry of entries) expect(known.has(entry.item), `${key}: ${entry.item}`).toBe(true)
    for (const recipe of GOODS_RECIPES) {
      for (const input of recipe.inputs) for (const id of [...(input.item ? [input.item] : []), ...(input.any ?? [])]) expect(known.has(id), `${recipe.id}: ${id}`).toBe(true)
      for (const tool of recipe.tools) for (const id of tool.anyOf) expect(known.has(id), `${recipe.id}: ${id}`).toBe(true)
      if ('item' in recipe.output) expect(known.has(recipe.output.item), recipe.id).toBe(true)
    }
    for (const effect of GOODS_USE_EFFECTS) for (const id of effect.items ?? []) expect(known.has(id), `${effect.id}: ${id}`).toBe(true)
    for (const row of GOODS_TABLES.melee) expect(known.has(row.id), row.id).toBe(true)
    for (const record of GOODS_ARSENAL_RECORDS) expect(record.id, 'ammo box id').toMatch(/^(ammo|firearm|throwable)_/)
  })

  it('keeps the measures real: every size is between 1 mm and 2 m and every weight is positive', () => {
    for (const item of GOODS_ITEMS) {
      expect(item.weight, item.id).toBeGreaterThan(0)
      for (const side of item.size) expect(side, item.id).toBeGreaterThanOrEqual(0.001)
      for (const side of item.size) expect(side, item.id).toBeLessThanOrEqual(2)
    }
  })
})

describe('provenance', () => {
  it('covers every item and only items', () => {
    expect(Object.keys(GOODS_PROVENANCE).sort()).toEqual([...ids].sort())
  })

  it('gives every item one origin: the team, the household or a decision', () => {
    for (const [id, origin] of Object.entries(GOODS_PROVENANCE)) expect(Boolean(origin.ite ?? origin.household ?? origin.created), id).toBe(true)
  })
})

describe('melee items and the arsenal', () => {
  const arsenal = createArsenal()
  const melee = GOODS_ITEMS.filter((item) => item.category === 'melee')

  it('resolves every `weapon` in the arsenal, and only melee items carry one', () => {
    const withWeapon = GOODS_ITEMS.filter((item) => item.weapon !== undefined)
    expect(withWeapon).toHaveLength(18)
    for (const item of withWeapon) {
      expect(item.category, item.id).toBe('melee')
      expect(arsenal.weapons.has(item.weapon ?? ''), `${item.id}: ${item.weapon}`).toBe(true)
    }
  })

  it('leaves without a weapon only the two melee items the decisions explain', () => {
    expect(melee.filter((item) => item.weapon === undefined).map((item) => item.id).sort()).toEqual(['arrows_and_bolts', 'slingshot'])
  })

  it('gives each generic melee weapon added for an item the reach, noise and mass of that item', () => {
    const added = ['tactical_knife', 'meat_cleaver', 'hatchet', 'nail_bat', 'iron_pipe', 'pickaxe', 'sickle', 'police_baton', 'cast_iron_skillet', 'improvised_spear', 'chainsaw']
    for (const id of added) {
      const row = GOODS_TABLES.melee.find((candidate) => candidate.id === id)
      const def = arsenal.weapons.get(catalog.get(id).weapon ?? '')
      expect(def?.action.kind, id).toBe('melee')
      if (def?.action.kind !== 'melee') continue
      expect(def.action.reach, id).toBe(row?.reach)
      expect(def.action.noise, id).toBe(row?.noise)
      expect(def.mass, id).toBe(catalog.get(id).weight)
    }
  })

  it('keeps the arsenal consistent and itemsFromArsenal valid next to the goods', () => {
    expect(checkArsenal({ weapons: arsenal.weapons, calibers: arsenal.calibers, explosives: arsenal.explosives })).toEqual([])
    const bridge = itemsFromArsenal(arsenal, { records: GOODS_ARSENAL_RECORDS })
    expect(() => createGoodsItems({ packs: [bridge] })).not.toThrow()
  })
})
