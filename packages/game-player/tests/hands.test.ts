import { describe, expect, it } from 'vitest'
import { drawBackOf, interactionHandsFor, planHands } from '../src'
import type { HandWeapon } from '../src'

const pistol: HandWeapon = { id: 'glock_17', hands: 1, slot: 'hip' }
const rifle: HandWeapon = { id: 'ak_47', hands: 2, slot: 'back' }
const knife: HandWeapon = { id: 'knife', hands: 1, slot: 'hip' }
const extinguisher: HandWeapon = { id: 'extinguisher', hands: 2, slot: null }

describe('hands and holster', () => {
  it('a one-hand interaction with a pistol takes the off hand and the pistol stays in hand', () => {
    const plan = planHands({ hands: 1, weapons: { R: pistol }, slots: ['hip'] })
    expect(plan).toEqual({ hand: 'L', moves: [] })
    expect(drawBackOf(plan)).toEqual([])
  })

  it('a two-hand interaction holsters the pistol and draws it back after', () => {
    const plan = planHands({ hands: 2, weapons: { R: pistol }, slots: ['hip'] })
    expect(plan).toEqual({ hand: 'both', moves: [{ hand: 'R', weapon: 'glock_17', move: 'holster', slot: 'hip' }] })
    expect(drawBackOf(plan)).toEqual([{ hand: 'R', weapon: 'glock_17' }])
  })

  it('a two-hand interaction with a pistol and no holster drops it, and it does not come back', () => {
    const plan = planHands({ hands: 2, weapons: { R: pistol }, slots: [] })
    expect(plan.moves).toEqual([{ hand: 'R', weapon: 'glock_17', move: 'drop' }])
    expect(drawBackOf(plan)).toEqual([])
  })

  it('a holster of the wrong kind is no holster: a pistol with only a back sling drops', () => {
    expect(planHands({ hands: 2, weapons: { R: pistol }, slots: ['back'] }).moves[0]?.move).toBe('drop')
  })

  it('a rifle takes both hands: even a one-hand interaction puts it on the back slot and draws it back after', () => {
    for (const hands of [1, 2] as const) {
      const plan = planHands({ hands, weapons: { R: rifle }, slots: ['hip', 'back'] })
      expect(plan.moves).toEqual([{ hand: 'R', weapon: 'ak_47', move: 'holster', slot: 'back' }])
      expect(drawBackOf(plan)).toEqual([{ hand: 'R', weapon: 'ak_47' }])
    }
    expect(planHands({ hands: 1, weapons: { R: rifle }, slots: ['back'] }).hand).toBe('L')
  })

  it('a rifle with no back slot falls to the ground and stays there', () => {
    const plan = planHands({ hands: 2, weapons: { R: rifle }, slots: ['hip'] })
    expect(plan.moves).toEqual([{ hand: 'R', weapon: 'ak_47', move: 'drop' }])
    expect(drawBackOf(plan)).toEqual([])
  })

  it('a weapon no slot takes always drops', () => {
    expect(planHands({ hands: 2, weapons: { R: extinguisher }, slots: ['hip', 'back'] }).moves[0]?.move).toBe('drop')
  })

  it('bare hands: one hand takes the weapon hand, two take both, nothing is put away', () => {
    expect(planHands({ hands: 1, weapons: {}, slots: [] })).toEqual({ hand: 'R', moves: [] })
    expect(planHands({ hands: 2, weapons: { R: { id: 'hand', hands: 0, slot: null } }, slots: [] })).toEqual({ hand: 'both', moves: [] })
  })

  it('a weapon in each hand: one hand puts the off-hand one away, two hands put both away, one slot each', () => {
    expect(planHands({ hands: 1, weapons: { R: pistol, L: knife }, slots: ['hip'] })).toEqual({ hand: 'L', moves: [{ hand: 'L', weapon: 'knife', move: 'holster', slot: 'hip' }] })
    const both = planHands({ hands: 2, weapons: { R: pistol, L: pistol }, slots: ['hip'] })
    expect(both.moves.map((move) => move.move)).toEqual(['holster', 'drop'])
  })

  it('a small light thing goes in one hand, a big or heavy one takes both', () => {
    expect(interactionHandsFor({ massKg: 0.4, size: [0.07, 0.12, 0.07] })).toBe(1)
    expect(interactionHandsFor({ massKg: 12, size: [0.4, 0.4, 0.4] })).toBe(2)
    expect(interactionHandsFor({ massKg: 2, size: [1.2, 0.1, 0.1] })).toBe(2)
    expect(interactionHandsFor({ massKg: 3 }, { oneHand: { maxKg: 2, maxLength: 1 } })).toBe(2)
  })
})
