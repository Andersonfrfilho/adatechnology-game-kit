import { describe, expect, it } from 'vitest'

import { bagOption, canTake, carriedKg, createItems, fitsInside, loadState, maxLoadKg } from '../src'
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
    expect(bagOption(undefined, 30)).toEqual({ slots: 10, capacityKg: 30, capacityLitres: 12, inside: [0.3, 0.25, 0.16] })
    expect(bagOption(backpack, 30)).toEqual({ slots: 24, capacityKg: 30, capacityLitres: 30, inside: [0.5, 0.3, 0.2] })
  })

  it('refuses first by slots, then by weight', () => {
    const rock = item('rock', { weight: 5 })
    const bag = { slots: 2, capacityKg: 10 }
    expect(canTake(rock, bag, { slots: 1, loadKg: 5 })).toBe('ok')
    expect(canTake(rock, bag, { slots: 2, loadKg: 0 })).toBe('bag_full')
    expect(canTake(rock, bag, { slots: 1, loadKg: 5.1 })).toBe('too_heavy')
    expect(canTake(rock, bag, { slots: 2, loadKg: 99 })).toBe('bag_full')
  })

  it('refuses a take that is too bulky after the slots and the weight pass', () => {
    const crate = item('crate', { weight: 1, size: [0.4, 0.4, 0.4] })
    const bag = { slots: 5, capacityKg: 50, capacityLitres: 100 }
    expect(canTake(crate, bag, { slots: 0, loadKg: 0, litres: 0 })).toBe('ok')
    expect(canTake(crate, bag, { slots: 0, loadKg: 0, litres: 0 }, { count: 2 })).toBe('too_bulky')
    expect(canTake(crate, bag, { slots: 4, loadKg: 0 }, { slotsNeeded: 2 })).toBe('bag_full')
  })

  it('refuses an item longer than the inside of the bag whatever its volume', () => {
    const shovel = item('shovel', { weight: 2, size: [1.1, 0.07, 0.22] })
    const brick = item('brick', { weight: 2, size: [0.2, 0.1, 0.1] })
    const backpack = bagOption(item('backpack', { category: 'bags', carry: { capacityKg: 10, weightReduction: 0, quickSlots: 0 } }), 30)
    expect(backpack.inside).toEqual([0.5, 0.3, 0.2])
    expect(canTake(shovel, backpack, { slots: 0, loadKg: 0, litres: 0 })).toBe('too_long')
    expect(canTake(brick, backpack, { slots: 0, loadKg: 0, litres: 0 })).toBe('ok')
    expect(fitsInside([0.2, 0.5, 0.3], [0.5, 0.3, 0.2])).toBe(true)
    expect(fitsInside([0.55, 0.1, 0.1], [0.5, 0.3, 0.2])).toBe(false)
  })
})
