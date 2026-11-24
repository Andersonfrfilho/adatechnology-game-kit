import { describe, expect, it } from 'vitest'

import { DEFAULT_NETWORK_RULES, diversifiedDemand, pickTransformer, resolveNetworkRules } from '../../src/networks'

const power = DEFAULT_NETWORK_RULES.power

describe('network rules', () => {
  it('reads the diversified demand by the count of consumers and the installed load of each', () => {
    expect(diversifiedDemand([], power)).toBe(0)
    expect(diversifiedDemand([3, 3, 8], power)).toBeCloseTo(2 + 2 + 3)
    expect(diversifiedDemand(Array.from({ length: 10 }, () => 4), power)).toBeCloseTo(15)
    expect(diversifiedDemand(Array.from({ length: 100 }, () => 6), power)).toBeCloseTo(150)
  })

  it('picks the smallest transformer within the loading limit', () => {
    expect(pickTransformer(20, power)?.id).toBe('t30')
    expect(pickTransformer(24.1, power)?.id).toBe('t45')
    expect(pickTransformer(90, power)?.id).toBe('t112')
    expect(pickTransformer(91, power)).toBeUndefined()
  })

  it('patches a number and keeps the others', () => {
    const rules = resolveNetworkRules({ power: { maxLoading: 1 }, clearance: { telecom: { road: 5.5 } } })
    expect(rules.power.maxLoading).toBe(1)
    expect(rules.power.transformers).toBe(power.transformers)
    expect(rules.clearance.telecom).toEqual({ road: 5.5, sidewalk: 4.5, lot: 3 })
    expect(resolveNetworkRules()).toBe(DEFAULT_NETWORK_RULES)
  })

  it('keeps the medium voltage out of the lots and the telecom under the low voltage', () => {
    const clearance = DEFAULT_NETWORK_RULES.clearance
    expect(clearance.power_mv.lot).toBeNull()
    for (const surface of ['road', 'sidewalk', 'lot'] as const) expect(clearance.telecom[surface] as number).toBeLessThanOrEqual(clearance.power_lv[surface] as number)
  })
})
