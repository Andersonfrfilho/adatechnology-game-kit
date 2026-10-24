import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createItems, resolveUse } from '../src'
import type { UseEffectDef } from '../src'
import { item, makeCatalog } from './fixtures'

const effects: UseEffectDef[] = [
  { id: 'painkiller', effect: 'heal', params: { amount: 15 }, consumes: true, items: ['painkillers'] },
  { id: 'toggle_light', effect: 'toggle_light', consumes: false, items: ['flashlight'] },
  { id: 'eat_and_drink', effect: 'consume_nutrition', consumes: true, category: ['food', 'drink'] },
  { id: 'swap_bag', effect: 'swap_bag', consumes: true, category: ['bags'] },
]

const stew = item('stew', { nutrition: { satiety: 40, hydration: 10 } })

describe('resolveUse', () => {
  it('matches an item by id before its category', () => {
    expect(resolveUse(item('painkillers', { category: 'medical' }), effects)).toEqual({ useId: 'painkiller', effect: 'heal', params: { amount: 15 }, consumes: true })
    expect(resolveUse(item('flashlight', { category: 'tools' }), effects)).toMatchObject({ effect: 'toggle_light', consumes: false })
    expect(resolveUse(item('backpack', { category: 'bags' }), effects)?.effect).toBe('swap_bag')
  })

  it('answers undefined when nothing happens', () => {
    expect(resolveUse(item('rock', { category: 'materials' }), effects)).toBeUndefined()
  })

  it('gives fresh food in full', () => {
    expect(resolveUse(stew, effects)?.nutrition).toEqual({ satiety: 40, hydration: 10, morale: 0, poisonChance: 0, isEdible: true })
  })

  it('gives 30% less satiety and a 10% poison chance for stale food', () => {
    const { nutrition } = resolveUse(stew, effects, { freshness: 'stale' }) ?? {}
    expect(nutrition).toMatchObject({ satiety: 28, hydration: 10, poisonChance: 0.1, morale: 0 })
  })

  it('gives 50% poison and -20 morale for spoiled food, 25% of it when cooked', () => {
    expect(resolveUse(stew, effects, { freshness: 'spoiled' })?.nutrition).toMatchObject({ poisonChance: 0.5, morale: -20 })
    expect(resolveUse(stew, effects, { freshness: 'spoiled', isCooked: true })?.nutrition?.poisonChance).toBeCloseTo(0.125)
  })

  it('does not let rotten food be eaten or spent', () => {
    const result = resolveUse(stew, effects, { freshness: 'rotten' })
    expect(result?.nutrition).toMatchObject({ satiety: 0, isEdible: false })
    expect(result?.consumes).toBe(false)
  })

  it('lets a game replace the stale rule', () => {
    const { rules } = createItems({ rules: { use: { freshness: { stale: { satietyFactor: 0.5 } } } } })
    expect(resolveUse(stew, effects, { freshness: 'stale' }, rules)?.nutrition?.satiety).toBe(20)
  })
})

describe('with the effects read from the team game', () => {
  const goods = JSON.parse(readFileSync(new URL('../../game-items-goods/src/data/use-effects.json', import.meta.url), 'utf8')) as UseEffectDef[]
  const catalog = makeCatalog([item('bandage', { category: 'medical' }), item('ibuprofen', { category: 'medical' }), item('machete', { category: 'melee' })], { useEffects: goods })

  it('loads the nine effects in order', () => {
    expect(catalog.useEffects.map((entry) => entry.id)).toEqual(['eat_and_drink', 'dress_wound', 'painkiller', 'calm_down', 'clean_wound', 'assemble_molotov', 'toggle_light', 'swap_bag', 'equip_melee'])
  })

  it('uses a bandage, an analgesic (+15) and a melee weapon as the game does', () => {
    expect(resolveUse(catalog.get('bandage'), catalog.useEffects)).toMatchObject({ effect: 'stop_bleeding', consumes: true })
    expect(resolveUse(catalog.get('ibuprofen'), catalog.useEffects)).toMatchObject({ effect: 'heal', params: { amount: 15 } })
    expect(resolveUse(catalog.get('machete'), catalog.useEffects)).toMatchObject({ effect: 'equip_melee', consumes: false })
  })
})
