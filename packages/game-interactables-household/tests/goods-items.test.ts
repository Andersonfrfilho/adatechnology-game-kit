import { readFileSync } from 'node:fs'

import { ITEM_CATEGORIES } from '@adatechnology/game-items'
import { GOODS_ITEMS, GOODS_STRINGS } from '@adatechnology/game-items-goods'
import { describe, expect, it } from 'vitest'

import { createHousehold, HOUSEHOLD_ITEM_IDS } from '../src'

const frozenIds = Object.keys(JSON.parse(readFileSync(new URL('../../../tools/items-catalog/base/household-items.sdk.json', import.meta.url), 'utf8')) as Record<string, unknown>)
const categories = new Set(ITEM_CATEGORIES.map((category) => category.id))

describe('household items come from the goods catalog', () => {
  const hh = createHousehold({ locale: 'en' })

  it('keeps every id the pack published, and only those', () => {
    expect([...HOUSEHOLD_ITEM_IDS].sort()).toEqual([...frozenIds].sort())
    expect(Object.keys(hh.items).sort()).toEqual([...frozenIds].sort())
  })

  it('serves the goods definitions: new categories, the old one as a tag, team measures where the team had them', () => {
    const goods = new Map(GOODS_ITEMS.map((item) => [item.id, item]))
    for (const id of frozenIds) {
      expect(hh.items[id]).toEqual(goods.get(id))
      expect(categories.has(hh.items[id]?.category ?? ''), id).toBe(true)
    }
    expect(goods.get('hammer')?.category).toBe('tools')
  })

  it('takes the item texts from the goods locales: the team name in pt-BR for a merged item, the SDK name otherwise', () => {
    expect(createHousehold().strings['pt-BR']['item.canned_food']).toBe('Comida enlatada')
    expect(hh.strings.en['item.canned_food']).toBe('Canned food')
    expect(createHousehold().strings['pt-BR']['item.hammer']).toBe(GOODS_STRINGS['pt-BR']['item.hammer'])
  })

  it('every loot entry points at an item that exists, even after the merges', () => {
    for (const table of Object.values(hh.loot)) for (const entry of table.entries) expect(hh.items[entry.type], entry.type).toBeDefined()
  })
})
