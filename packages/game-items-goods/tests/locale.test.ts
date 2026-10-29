import { describe, expect, it } from 'vitest'

import { GOODS_CATEGORIES, GOODS_CONTAINERS, GOODS_ITEMS, GOODS_KINDS, GOODS_PLACES, GOODS_RECIPES, GOODS_STRINGS, GOODS_TABLES, goodsText, pickGoodsLocale } from '../src'

const keysOfItems = GOODS_ITEMS.map((item) => `item.${item.id}`)
const expectedKeys = [
  ...keysOfItems,
  ...GOODS_CATEGORIES.map((category) => `category.${category.id}`),
  ...GOODS_KINDS.flatMap((kind) => [`kind.${kind.id}`, `kind.${kind.id}.description`]),
  ...GOODS_PLACES.map((place) => `place.${place.id}`),
  ...GOODS_TABLES.rarities.map((rarity) => `rarity.${rarity.id}`),
  ...GOODS_CONTAINERS.map((container) => `container.${container.id}`),
  ...GOODS_RECIPES.map((recipe) => `recipe.${recipe.id}`),
]

describe('texts', () => {
  for (const locale of ['pt-BR', 'en'] as const) {
    it(`${locale} has a text for every item, category, kind (name and description), place, rarity, container and recipe, and nothing else`, () => {
      const strings = GOODS_STRINGS[locale]
      expect(Object.keys(strings).sort()).toEqual([...expectedKeys].sort())
      for (const key of expectedKeys) expect(strings[key]?.trim(), `${locale} ${key}`).toBeTruthy()
    })
  }

  it('keeps the team names in pt-BR and a translation in en', () => {
    expect(GOODS_STRINGS['pt-BR']['item.canned_beans']).toBe('Feijão em lata')
    expect(GOODS_STRINGS.en['item.canned_beans']).toBe('Canned beans')
    expect(GOODS_STRINGS['pt-BR']['place.pharmacy']).toBe('Farmácia')
  })

  it('translates every name except the ones that are the same word in both languages', () => {
    const same = keysOfItems.filter((key) => GOODS_STRINGS.en[key] === GOODS_STRINGS['pt-BR'][key])
    expect(same.sort()).toEqual(['item.dvd', 'item.ketchup', 'item.power_bank', 'item.shampoo'])
  })

  it('picks the locale by language and falls back to the key', () => {
    expect(pickGoodsLocale('pt_BR')).toBe('pt-BR')
    expect(pickGoodsLocale('pt')).toBe('pt-BR')
    expect(pickGoodsLocale('de')).toBe('en')
    expect(pickGoodsLocale()).toBe('en')
    expect(goodsText('item.axe', 'pt-BR')).toBe('Machado')
    expect(goodsText('item.unknown')).toBe('item.unknown')
  })
})
