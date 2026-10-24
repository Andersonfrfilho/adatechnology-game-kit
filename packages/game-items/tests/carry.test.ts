import { describe, expect, it } from 'vitest'

import { bagOption, canTake, carriedKg, createItems, loadState, maxLoadKg } from '../src'
import { item } from './fixtures'

describe('carry', () => {
  it('computes (8 + 2.5 x strength) x 1.2', () => {
    expect(maxLoadKg(0)).toBeCloseTo(9.6)
    expect(maxLoadKg(10)).toBeCloseTo(39.6)
  })

  it('lets a game change the formula', () => {
    const { rules } = createItems({ rules: { carry: { baseKg: 10, factor: 1 } } })
    expect(maxLoadKg(4, rules)).toBe(20)
  })

  it('counts what is in the bag times (1 - reduction) and what is outside in full', () => {
    const rock = item('rock', { weight: 2 })
    expect(carriedKg({ loose: [{ item: rock, count: 1 }], packed: [{ item: rock, count: 5 }], weightReduction: 0.3 })).toBeCloseTo(2 + 7)
    expect(carriedKg({ loose: [] })).toBe(0)
  })

  it('slows above 100% of the maximum and stops running above 150%', () => {
    expect(loadState(30, 40)).toMatchObject({ level: 'normal', runFactor: 1, canRun: true })
    expect(loadState(40, 40).level).toBe('normal')
    expect(loadState(41, 40)).toMatchObject({ level: 'encumbered', runFactor: 0.75, canRun: true })
    expect(loadState(60, 40).level).toBe('encumbered')
    expect(loadState(61, 40)).toMatchObject({ level: 'overloaded', runFactor: 0, canRun: false })
  })

  it('has 10 slots by default and the slots of a bag item', () => {
    const backpack = item('backpack', { category: 'bags', carry: { capacityKg: 24, weightReduction: 0.35, quickSlots: 4 } })
    expect(bagOption(undefined, 30)).toEqual({ slots: 10, capacityKg: 30 })
    expect(bagOption(backpack, 30)).toEqual({ slots: 24, capacityKg: 30 })
  })

  it('refuses first by slots, then by weight', () => {
    const rock = item('rock', { weight: 5 })
    const bag = { slots: 2, capacityKg: 10 }
    expect(canTake(rock, bag, { slots: 1, loadKg: 5 })).toBe('ok')
    expect(canTake(rock, bag, { slots: 2, loadKg: 0 })).toBe('bag_full')
    expect(canTake(rock, bag, { slots: 1, loadKg: 5.1 })).toBe('too_heavy')
    expect(canTake(rock, bag, { slots: 2, loadKg: 99 })).toBe('bag_full')
  })
})
