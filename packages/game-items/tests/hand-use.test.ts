import { describe, expect, it } from 'vitest'

import { aimHandUse, createHandUse, HAND_USE_REACH, HAND_USES, handUseOf } from '../src'

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

  it('switches a flashlight, lights a lighter, talks on a radio and turns a key, each at its own action', () => {
    const actionsOf = (id: string): string[] => {
      const player = createHandUse(handUseOf(id)!)
      const seen: string[] = []
      while (!player.done) for (const event of player.update(1 / 60)) seen.push(event.action)
      return seen
    }
    expect(actionsOf('toggle_flashlight')).toEqual(['switch'])
    expect(actionsOf('light_lighter')).toEqual(['ignite'])
    expect(actionsOf('use_radio')).toEqual(['tune', 'talk'])
    expect(actionsOf('turn_key')).toEqual(['turn'])
    expect(handUseOf('use_radio')?.body).toBe('mouth')
    expect(handUseOf('turn_key')?.body).toBe('reach')
  })

  it('takes a key to the lock it is aimed at, no farther than an arm reaches, and leaves the other keys where they were', () => {
    const def = handUseOf('turn_key')!
    const lock = [0.05, -0.3, -0.5] as const
    const aimed = aimHandUse(def, lock)
    const firstReach = aimed.keys.find((key) => key.reach)!
    expect(firstReach.position.map((n) => +n.toFixed(6))).toEqual([...lock])
    expect(aimed.keys[0]!.position).toEqual(def.keys[0]!.position)
    const far = aimHandUse(def, [0, 0, -3]).keys.find((key) => key.reach)!
    expect(Math.hypot(...far.position)).toBeCloseTo(HAND_USE_REACH, 6)
    expect(aimHandUse(handUseOf('eat_food')!, lock)).toBe(handUseOf('eat_food'))
  })

  it('stops when cancelled', () => {
    const player = createHandUse(handUseOf('use_hygiene')!)
    player.update(0.5)
    player.cancel()
    expect(player.done).toBe(true)
    expect(player.update(1)).toEqual([])
  })
})
