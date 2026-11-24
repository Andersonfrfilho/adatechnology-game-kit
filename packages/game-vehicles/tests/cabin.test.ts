import { describe, expect, it } from 'vitest'

import { CABIN_CATEGORIES, CABIN_MINIMUMS, CABIN_SOURCE, ENTRY_DUCK_FACTOR, cabinMinimumOf } from '../src/index'
import type { CabinCategory, CabinMinimum } from '../src/index'

describe('cabin minimums table (Spec 012 R6)', () => {
  it('defines all 11 fleet cabin categories with cited source', () => {
    expect(CABIN_CATEGORIES).toEqual([
      'passenger_car',
      'suv_pickup',
      'van',
      'truck',
      'bus',
      'agricultural',
      'military_light',
      'military_armored',
      'open_vehicle',
      'boat_cabin',
      'aircraft_enclosed',
    ])
    expect(CABIN_SOURCE.length).toBeGreaterThan(0)
    expect(ENTRY_DUCK_FACTOR).toBe(0.44)
  })

  it('meets R6 passenger car front headroom >= 0.95 m and rear >= 0.90 m', () => {
    const car: CabinMinimum = cabinMinimumOf('passenger_car')
    expect(car.frontHeadroomMetres).toBeGreaterThanOrEqual(0.95)
    expect(car.rearHeadroomMetres).toBe(0.9)
    expect(car.frontLegroomMetres).toBe(0.62)
    expect(car.widthMetres).toBe(0.52)
    expect(car.door).toEqual({ widthMetres: 0.65, heightMetres: 0.8 })
  })

  it('uses Infinity clearances and no door for open vehicles', () => {
    const open = cabinMinimumOf('open_vehicle')
    expect(open.frontHeadroomMetres).toBe(Number.POSITIVE_INFINITY)
    expect(open.rearHeadroomMetres).toBe(Number.POSITIVE_INFINITY)
    expect(open.frontLegroomMetres).toBe(Number.POSITIVE_INFINITY)
    expect(open.widthMetres).toBe(Number.POSITIVE_INFINITY)
    expect(open.door).toBeUndefined()
  })

  it('keeps armored military cabins tighter than passenger cars', () => {
    const armored = cabinMinimumOf('military_armored')
    expect(armored.frontHeadroomMetres).toBe(0.88)
    expect(armored.frontHeadroomMetres).toBeLessThan(cabinMinimumOf('passenger_car').frontHeadroomMetres)
  })

  it('has valid positive finite minimums for every enclosed category', () => {
    const enclosed: readonly CabinCategory[] = CABIN_CATEGORIES.filter((c) => c !== 'open_vehicle')
    for (const category of enclosed) {
      const min = CABIN_MINIMUMS[category]
      expect(Number.isFinite(min.frontHeadroomMetres) && min.frontHeadroomMetres > 0).toBe(true)
      expect(Number.isFinite(min.frontLegroomMetres) && min.frontLegroomMetres > 0).toBe(true)
      expect(Number.isFinite(min.widthMetres) && min.widthMetres > 0).toBe(true)
      expect(min.door).toBeDefined()
      expect(min.door!.widthMetres).toBeGreaterThan(0)
      expect(min.door!.heightMetres).toBeGreaterThan(0)
    }
  })
})
