import { describe, expect, it } from 'vitest'
import { HAND_USES } from '@adatechnology/game-items'
import type { ItemDef } from '@adatechnology/game-items'

import { LIQUIDS } from '@adatechnology/game-fluids'

import { drinkHydrationOf, goodsItemUse, GOODS_ITEMS } from '../src'

const item = (id: string): ItemDef => GOODS_ITEMS.find((entry) => entry.id === id)!

describe('goods item use', () => {
  it('eats food and spends it, with its nutrition', () => {
    expect(goodsItemUse(item('apple'))).toEqual({ clip: 'eat_food', consumes: true, effect: { id: 'consume_nutrition', satiety: 8, hydration: 6 } })
  })

  it('quenches by the volume drunk and the thirst a litre of the liquid quenches (game-fluids), the same as the liquid poured in a cup', () => {
    const water = LIQUIDS.find((liquid) => liquid.id === 'water')!.drink!.thirst
    expect(goodsItemUse(item('water_bottle'))?.effect?.hydration).toBeCloseTo(water * 0.5, 6)
    // a 5 l jug of ten doses: one dose is half a litre, the same as the bottle
    expect(goodsItemUse(item('water_jug_5l'))?.effect?.hydration).toBeCloseTo(goodsItemUse(item('water_bottle'))!.effect!.hydration!, 6)
    expect(drinkHydrationOf(item('soda_can'))).toBeCloseTo(LIQUIDS.find((liquid) => liquid.id === 'soda')!.drink!.thirst * 0.35, 6)
    expect(goodsItemUse(item('soda_can'))?.effect?.satiety).toBe(4)
    expect(drinkHydrationOf(item('apple'))).toBeUndefined()
  })

  it('takes a painkiller for health, dresses a wound, dabs alcohol on it and rubs soap in without spending it', () => {
    expect(goodsItemUse(item('painkillers'))).toMatchObject({ clip: 'take_medicine', consumes: true, effect: { id: 'heal', params: { amount: 15 } } })
    expect(goodsItemUse(item('adhesive_bandages'))).toMatchObject({ clip: 'apply_dressing', consumes: true, effect: { id: 'stop_bleeding' } })
    expect(goodsItemUse(item('alcohol_70'))).toMatchObject({ clip: 'apply_dressing', effect: { id: 'clean_wound' } })
    expect(goodsItemUse(item('alcohol_70'))?.effect?.params).toBeUndefined()
    expect(goodsItemUse(item('soap'))).toEqual({ clip: 'use_hygiene', consumes: false, effect: { id: 'wash' } })
  })

  it('plays no use for what is not used in the hand', () => {
    expect(goodsItemUse(item('knife'))).toBeUndefined()
  })

  it('names a hand use of game-items or a fluid drink for every item that has one', () => {
    const known = new Set([...HAND_USES.map((use) => use.id), 'open_can_eat', 'open_can_drink'])
    for (const entry of GOODS_ITEMS) {
      const clip = goodsItemUse(entry)?.clip
      if (clip !== undefined) expect(known.has(clip), `${entry.id}: ${clip}`).toBe(true)
    }
  })
})
