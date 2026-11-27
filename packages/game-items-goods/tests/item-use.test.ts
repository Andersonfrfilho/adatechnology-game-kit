import { describe, expect, it } from 'vitest'
import { HAND_USES } from '@adatechnology/game-items'
import type { ItemDef } from '@adatechnology/game-items'

import { goodsItemUse, GOODS_ITEMS } from '../src'

const item = (id: string): ItemDef => GOODS_ITEMS.find((entry) => entry.id === id)!

describe('goods item use', () => {
  it('eats food and spends it, with its nutrition', () => {
    expect(goodsItemUse(item('apple'))).toEqual({ clip: 'eat_food', consumes: true, effect: { id: 'consume_nutrition', satiety: 8, hydration: 6 } })
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
