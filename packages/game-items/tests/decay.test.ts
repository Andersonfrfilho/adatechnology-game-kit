import { describe, expect, it } from 'vitest'

import { advanceAge, createItems, chargeLevel, failsToStart, freshness, moveToStorage, shelfRatio, storageMultiplier } from '../src'
import type { AgeState } from '../src'
import { item, sequence } from './fixtures'

const beans = item('canned_beans', { shelfLife: 100 })
const start = (storage: string, extra: Partial<AgeState> = {}): AgeState => ({ ageDays: 0, since: 0, storage, storedAt: 0, ...extra })

describe('storage multipliers', () => {
  it('reads the seven storage places of the team', () => {
    const multipliers = ['fridge', 'freezer', 'cooler', 'delivery_bag', 'cellar', 'ambient', 'hot'].map((storage) => storageMultiplier(storage))
    expect(multipliers).toEqual([0.33, 0.1, 0.5, 0.8, 0.66, 1, 2])
  })

  it('drops fridge and freezer to the ambient rate without power', () => {
    expect(storageMultiplier('fridge', { powered: false })).toBe(1)
    expect(storageMultiplier('freezer', { powered: false })).toBe(1)
  })

  it('gives a cooler 0.5 for two days and 1 after', () => {
    expect(storageMultiplier('cooler', { heldDays: 1.9 })).toBe(0.5)
    expect(storageMultiplier('cooler', { heldDays: 2 })).toBe(1)
  })

  it('throws on an unknown storage', () => {
    expect(() => storageMultiplier('attic')).toThrow(/unknown storage "attic"/)
  })
})

describe('advanceAge', () => {
  it('adds elapsed time times the multiplier, only when asked (lazy)', () => {
    const state = advanceAge(start('fridge'), 30)
    expect(state.ageDays).toBeCloseTo(9.9)
    expect(state.since).toBe(30)
    expect(advanceAge(state, 30).ageDays).toBeCloseTo(9.9)
  })

  it('never goes back in time', () => {
    const state = advanceAge(start('ambient', { ageDays: 5, since: 10 }), 4)
    expect(state).toMatchObject({ ageDays: 5, since: 10 })
  })

  it('is pure: the input state is not changed', () => {
    const state = start('hot')
    advanceAge(state, 10)
    expect(state.ageDays).toBe(0)
  })

  it('ages a cooler at 0.5 for its first two days and at 1 afterwards, even across calls', () => {
    const first = advanceAge(start('cooler'), 1)
    const second = advanceAge(first, 5)
    expect(first.ageDays).toBeCloseTo(0.5)
    expect(second.ageDays).toBeCloseTo(0.5 + 0.5 + 3)
    expect(advanceAge(start('cooler'), 5).ageDays).toBeCloseTo(4)
  })

  it('counts a cooler from the moment the item entered it', () => {
    const state = moveToStorage(start('ambient'), 10, 'cooler')
    expect(state.ageDays).toBe(10)
    expect(advanceAge(state, 14).ageDays).toBeCloseTo(10 + 1 + 2)
  })

  it('closes the account in the old place when the item moves', () => {
    const moved = moveToStorage(start('fridge'), 10, 'ambient')
    expect(moved.ageDays).toBeCloseTo(3.3)
    expect(advanceAge(moved, 20).ageDays).toBeCloseTo(13.3)
  })

  it('turns a freezer without power into fresh food with 2 days to go', () => {
    const frozen = advanceAge(start('freezer'), 100)
    expect(frozen.ageDays).toBeCloseTo(10)
    const thawed = advanceAge(frozen, 101, { powered: false })
    expect(thawed.shelfLife).toBe(2)
    expect(thawed.ageDays).toBeCloseTo(1)
    expect(freshness(beans, thawed, 101)).toBe('stale')
    expect(freshness(beans, thawed, 102.5, { powered: false })).toBe('spoiled')
  })

  it('does not thaw a fridge: it only loses its multiplier', () => {
    const state = advanceAge(start('fridge'), 10, { powered: false })
    expect(state.shelfLife).toBeUndefined()
    expect(state.ageDays).toBe(10)
  })
})

describe('freshness', () => {
  const at = (ageDays: number): AgeState => start('ambient', { ageDays })

  it('changes state at 0.5, 1 and 1.5 of the shelf life', () => {
    expect([0, 49.9, 50, 99.9, 100, 149.9, 150, 400].map((age) => freshness(beans, at(age), 0))).toEqual(['fresh', 'fresh', 'stale', 'stale', 'spoiled', 'spoiled', 'rotten', 'rotten'])
  })

  it('computes the state lazily from time and place', () => {
    expect(freshness(beans, start('fridge'), 330)).toBe('spoiled')
    expect(freshness(beans, start('ambient'), 300)).toBe('rotten')
    expect(freshness(beans, start('freezer'), 300)).toBe('fresh')
  })

  it('never spoils an item without a shelf life', () => {
    expect(freshness(item('salt'), at(99999), 0)).toBe('fresh')
    expect(shelfRatio(item('salt'), at(9))).toBe(0)
  })

  it('follows the thresholds a game changes', () => {
    const rules = createItems({ rules: { freshness: { stale: 0.2, spoiled: 0.4, rotten: 0.8 } } }).rules
    expect([10, 20, 40, 80].map((age) => freshness(beans, at(age), 0, { rules }))).toEqual(['fresh', 'stale', 'spoiled', 'rotten'])
  })
})

describe('batteries and old fuel', () => {
  const battery = item('batteries', { category: 'electronics', charge: { lossPerMonth: 0.1 } })
  const gasoline = item('gasoline', { category: 'fuel', agingFault: { afterDays: 180, chance: 0.1 } })

  it('loses 10% of the charge per month, never below 0', () => {
    expect(chargeLevel(battery, 1, 30)).toBeCloseTo(0.9)
    expect(chargeLevel(battery, 0.5, 150)).toBe(0)
    expect(chargeLevel(item('lamp'), 0.7, 400)).toBe(0.7)
  })

  it('fails 10% of the starts after 180 days and draws only then', () => {
    const random = sequence(0.05, 0.5)
    expect(failsToStart(gasoline, 180, random)).toBe(false)
    expect(failsToStart(gasoline, 181, random)).toBe(true)
    expect(failsToStart(gasoline, 181, random)).toBe(false)
    expect(failsToStart(item('water'), 999, random)).toBe(false)
  })
})
