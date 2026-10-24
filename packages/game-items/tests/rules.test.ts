import { describe, expect, it } from 'vitest'

import { DEFAULT_RULES, RARITIES } from '../src'

describe('DEFAULT_RULES', () => {
  it('weights rarities 60/28/9/2.5/0.5 and keeps unique for fixed spots', () => {
    expect(RARITIES.map((rarity) => DEFAULT_RULES.rarity.weights[rarity])).toEqual([60, 28, 9, 2.5, 0.5, 0])
    expect(DEFAULT_RULES.rarity.fixedOnly).toEqual(['unique'])
  })

  it('keeps the freshness, carry and protection numbers of the team', () => {
    expect(DEFAULT_RULES.freshness).toEqual({ stale: 0.5, spoiled: 1, rotten: 1.5 })
    expect(DEFAULT_RULES.carry).toEqual({ baseKg: 8, perStrengthKg: 2.5, factor: 1.2, encumbered: 1, overloaded: 1.5 })
    expect(DEFAULT_RULES.protection).toEqual({ cap: 0.9, wear: { bite: 8, scratch: 3 }, tornShare: 0.25, repairMargin: 10 })
  })

  it('has the seven storage places, the cooler lasting two days', () => {
    expect(Object.keys(DEFAULT_RULES.storage)).toEqual(['fridge', 'freezer', 'cooler', 'delivery_bag', 'cellar', 'ambient', 'hot'])
    expect(DEFAULT_RULES.storage.cooler).toEqual({ multiplier: 0.5, limitDays: 2, afterLimit: 1 })
  })

  it('shows retail stock as new on day 0 by default', () => {
    expect(DEFAULT_RULES.spawn.retailNew).toBe(true)
  })
})
