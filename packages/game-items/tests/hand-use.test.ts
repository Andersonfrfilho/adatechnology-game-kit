import { describe, expect, it } from 'vitest'

import { createHandUse, HAND_USES, handUseOf } from '../src'

describe('hand uses', () => {
  it('starts and ends every use at the hand rest, with keys in order inside the duration', () => {
    for (const def of HAND_USES) {
      const first = def.keys[0]!
      const last = def.keys[def.keys.length - 1]!
      expect(first.t, def.id).toBe(0)
      expect(last.t, def.id).toBe(def.duration)
      expect(last.position, def.id).toEqual(first.position)
      for (let i = 1; i < def.keys.length; i++) expect(def.keys[i]!.t, def.id).toBeGreaterThan(def.keys[i - 1]!.t)
      expect(def.keys.some((key) => key.action), def.id).toBe(true)
    }
  })

  it('eats in three bites, the food at the mouth on each', () => {
    const player = createHandUse(handUseOf('eat_food')!)
    const bites: number[] = []
    let atMouth = 0
    while (!player.done) {
      for (const event of player.update(1 / 60)) {
        bites.push(event.share)
        const { position } = player.pose()
        atMouth = Math.max(atMouth, position[1])
      }
    }
    expect(bites.map((share) => Math.round(share * 100))).toEqual([33, 67, 100])
    expect(atMouth).toBeGreaterThan(-0.02)
    expect(player.pose().position).toEqual([0.22, -0.2, -0.4])
  })

  it('takes medicine to the mouth and keeps both hands together for soap and dressings', () => {
    expect(handUseOf('take_medicine')?.body).toBe('mouth')
    expect(handUseOf('apply_dressing')?.body).toBe('two_hands')
    expect(handUseOf('use_hygiene')?.body).toBe('two_hands')
  })

  it('stops when cancelled', () => {
    const player = createHandUse(handUseOf('use_hygiene')!)
    player.update(0.5)
    player.cancel()
    expect(player.done).toBe(true)
    expect(player.update(1)).toEqual([])
  })
})
