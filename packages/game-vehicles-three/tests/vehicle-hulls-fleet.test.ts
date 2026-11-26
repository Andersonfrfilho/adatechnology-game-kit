import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { fleetGroupOf, fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'

import { MAX_HULL_POINTS, convexFaces, vehicleHulls } from '../src'
import { build } from './vehicle-colliders-support'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

/**
 * Hulls a vehicle of each class may have (design 10.3, H6): the most the 69 models made (spec 008 T6.4, `evidence.md`), rounded up to the next 50. They replace the design's
 * estimates (motorcycle 32, car 96, truck 160, bus 192): a drawn car is 1 172 to 1 401 hulls, not 96.
 */
const CEILING: Readonly<Record<string, number>> = {
  motorcycles: 200,
  cars: 1450,
  suvs: 1450,
  pickups: 1500,
  vans: 1200,
  heavy: 2000,
  agricultural: 850,
  military: 3100,
  air: 3000,
  water: 1800,
}

describe('the hulls of the whole fleet (design 10.3, H6)', () => {
  it('every class has a ceiling', () => {
    for (const id of fleetVehicleIds) expect(CEILING[fleetGroupOf(id) ?? '']).toBeGreaterThan(0)
  })

  it.each(fleetVehicleIds)('%s: at most 64 points a hull, every hull a volume, and no more hulls than its class', (id) => {
    const { vehicle, frame, dispose } = build(id)
    const hulls = vehicleHulls(THREE, vehicle, frame)
    const parts = new Set(vehicle.model.parts.map((part) => part.id))
    expect(hulls.length).toBeGreaterThan(0)
    expect(hulls.length).toBeLessThanOrEqual(CEILING[fleetGroupOf(id) ?? '']!)
    for (const hull of hulls) {
      expect(parts.has(hull.id)).toBe(true)
      expect(hull.points.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
      expect(convexFaces(hull.points)).not.toBeNull()
    }
    dispose()
  }, 240000)
})
