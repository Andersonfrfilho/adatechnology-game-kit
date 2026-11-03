import { createUrban } from '@adatechnology/game-urban'
import type { PlacementPart } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'

import { createPlantProvider, createVehicleProvider, defaultUrbanProviders, PARKED_VEHICLE_IDS } from '../src'

const placements = (parts: readonly { shape: string }[], kind: PlacementPart['kind']): PlacementPart[] => parts.filter((part): part is PlacementPart => part.shape === 'placement' && (part as PlacementPart).kind === kind)

describe('the urban preset', () => {
  const kit = createUrban()

  it('parks the fleet of the pack where the pattern parks', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider() } })
    const cars = placements(b.parts, 'vehicle')
    expect(cars).toHaveLength(plan.vehicles.length)
    expect(cars.length).toBeGreaterThan(0)
    for (const car of cars) expect(PARKED_VEHICLE_IDS).toContain(car.id)
  })

  it('keeps the options of the old providers: ids, pick, paint, region, contexts, seed', () => {
    const b = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider({ ids: ['taxi'] }) } })
    expect(new Set(placements(b.parts, 'vehicle').map((car) => car.id))).toEqual(new Set(['taxi']))
    const ids = (seed: number) => {
      const rural = kit.builder({ seed: 7 })
      kit.neighbourhoods.get('rural').compose(rural, { x: 0, z: 0 }, { providers: { plant: createPlantProvider({ seed }) } })
      return placements(rural.parts, 'plant').map((plant) => plant.id)
    }
    expect(ids(1)).toEqual(ids(1))
    expect(ids(1)).not.toEqual(ids(2))
  })

  it('defaultUrbanProviders gives both providers and plants species of the regional table', () => {
    const b = kit.builder({ seed: 7 })
    const providers = defaultUrbanProviders()
    const plan = kit.neighbourhoods.get('mountain_resort').compose(b, { x: 0, z: 0 }, { providers })
    const plants = placements(b.parts, 'plant')
    expect(plants).toHaveLength(plan.plants.length)
    expect(plants.length).toBeGreaterThan(0)
    expect(plants.every((plant) => plant.id.length > 0)).toBe(true)
  })
})
