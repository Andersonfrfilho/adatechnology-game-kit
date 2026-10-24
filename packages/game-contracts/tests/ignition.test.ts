import { describe, expect, it } from 'vitest'
import { DEFAULT_IGNITION_RULES, fillFactor, ignitionChance, resolveIgnitionRules, sparkTargetFactor } from '../src'

describe('ignition of a leak', () => {
  it('has a fill curve that peaks when the container is nearly empty and is low when it is full', () => {
    expect(fillFactor(0.1)).toBe(1)
    expect(fillFactor(1)).toBeCloseTo(0.12)
    expect(fillFactor(0)).toBeCloseTo(0.6)
    expect(fillFactor(0.1)).toBeGreaterThan(fillFactor(0.5))
    expect(fillFactor(0.5)).toBeGreaterThan(fillFactor(0.95))
    // linear between points, clamped outside
    expect(fillFactor(0.225)).toBeCloseTo(0.8)
    expect(fillFactor(-1)).toBe(fillFactor(0))
    expect(fillFactor(7)).toBe(fillFactor(1))
    expect(fillFactor(0.4, [])).toBe(1)
  })

  it('never lights with a round that carries nothing, and only sparks on metal', () => {
    expect(ignitionChance({}, { sparkTarget: 1, fill: 0.1 })).toBe(0)
    expect(ignitionChance({ ignition: { spark: 0.2, flame: 0 } }, { sparkTarget: 0, fill: 0.1 })).toBe(0)
    expect(ignitionChance({ ignition: { spark: 0.2, flame: 0 } }, { sparkTarget: 1, fill: 0.1 })).toBeCloseTo(0.2)
    expect(sparkTargetFactor('steel', true)).toBe(1)
    expect(sparkTargetFactor('aluminium', true)).toBe(0.25)
    expect(sparkTargetFactor('copper', true)).toBe(DEFAULT_IGNITION_RULES.sparkMetalDefault)
    expect(sparkTargetFactor('plastic', false)).toBe(0)
  })

  it('combines the spark and the flame as independent chances, weighed by the fill', () => {
    const hit = { ignition: { spark: 0.5, flame: 0.5 } }
    expect(ignitionChance(hit, { sparkTarget: 1, fill: 0.1 })).toBeCloseTo(0.75)
    const full = ignitionChance(hit, { sparkTarget: 1, fill: 1 })
    expect(full).toBeLessThan(0.75)
    expect(full).toBeCloseTo(1 - (1 - 0.5 * 0.12) * (1 - 0.5 * (1 - 0.5 * 0.88)))
  })

  it('takes the flags when the host sends only them, and the diesel spark is weak', () => {
    const rules = DEFAULT_IGNITION_RULES
    expect(ignitionChance({ incendiary: true }, { sparkTarget: 1, fill: 0.1 })).toBeCloseTo(rules.flameDefaults.incendiary)
    expect(ignitionChance({ tracer: true }, { sparkTarget: 1, fill: 0.1 })).toBeCloseTo(rules.flameDefaults.tracer)
    const spark = { ignition: { spark: 0.4, flame: 0 } }
    expect(ignitionChance(spark, { sparkTarget: 1, fill: 0.1, fluid: 'diesel' })).toBeCloseTo(0.4 * 0.15)
    expect(ignitionChance(spark, { sparkTarget: 1, fill: 0.1, fluid: 'fuel' })).toBeCloseTo(0.4)
  })

  it('resolves a partial configuration over the defaults', () => {
    const rules = resolveIgnitionRules({ fireNear: { radius: 3 } as never, sparkTarget: { copper: 0 } })
    expect(rules.fireNear.radius).toBe(3)
    expect(rules.fireNear.chancePerSecond).toBe(DEFAULT_IGNITION_RULES.fireNear.chancePerSecond)
    expect(rules.sparkTarget.copper).toBe(0)
    expect(rules.sparkTarget.steel).toBe(1)
    expect(ignitionChance({ ignition: { spark: 1, flame: 0 } }, { sparkTarget: 1, fill: 0.1 }, resolveIgnitionRules({ fillCurve: [[0, 0.5]] }))).toBeCloseTo(0.5)
  })
})
