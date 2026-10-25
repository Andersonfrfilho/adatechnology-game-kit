import { describe, expect, it } from 'vitest'

import { createPlantProvider, createUrban, createVehicleProvider, PARKED_VEHICLE_IDS } from '../src'
import type { PlacementPart, Providers } from '../src'

const placements = (parts: readonly { shape: string }[], kind: PlacementPart['kind']): PlacementPart[] => parts.filter((part): part is PlacementPart => part.shape === 'placement' && (part as PlacementPart).kind === kind)

describe('vehicle and plant providers', () => {
  const kit = createUrban()

  it('draw no vehicle and no placed plant when the game gives no provider', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 })
    expect(placements(b.parts, 'vehicle')).toHaveLength(0)
    expect(placements(b.parts, 'plant')).toHaveLength(0)
    expect(plan.vehicles.length).toBeGreaterThan(0)
  })

  it('a vehicle provider places one fleet vehicle where the pattern parks, with the colour it asks for', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider() } })
    const cars = placements(b.parts, 'vehicle')
    expect(cars).toHaveLength(plan.vehicles.length)
    cars.forEach((car, index) => {
      expect(PARKED_VEHICLE_IDS).toContain(car.id)
      expect(car.x).toBe(plan.vehicles[index]?.x)
      expect(car.color).toBe(plan.vehicles[index]?.color)
    })
  })

  it('the choice depends on the spot, not on the random: the scene around it is the same', () => {
    const run = (providers: Providers) => {
      const b = kit.builder({ seed: 7 })
      kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers })
      return { parts: b.parts.filter((part) => part.shape !== 'placement'), next: b.random() }
    }
    expect(run({ vehicle: createVehicleProvider() })).toEqual(run({}))
    expect(run({ vehicle: createVehicleProvider({ ids: ['taxi'] }) })).toEqual(run({}))
  })

  it('the game chooses the ids and the choice', () => {
    const b = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider({ ids: ['taxi'] }) } })
    expect(new Set(placements(b.parts, 'vehicle').map((car) => car.id))).toEqual(new Set(['taxi']))
    const painted = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(painted, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider({ pick: () => 'police_sedan', paint: () => 0x112233 }) } })
    expect(placements(painted.parts, 'vehicle').every((car) => car.id === 'police_sedan' && car.color === 0x112233)).toBe(true)
    expect(() => createVehicleProvider({ ids: [] })).toThrow()
  })

  it('a plant provider puts species of the regional table where the pattern plants trees', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('mountain_resort').compose(b, { x: 0, z: 0 }, { providers: { plant: createPlantProvider() } })
    const plants = placements(b.parts, 'plant')
    expect(plants).toHaveLength(plan.plants.length)
    expect(plants.length).toBeGreaterThan(0)
    expect(plants.every((plant) => typeof plant.id === 'string' && plant.id.length > 0)).toBe(true)
  })

  it('the same seed picks the same species and another seed other ones', () => {
    const ids = (seed: number) => {
      const b = kit.builder({ seed: 7 })
      kit.neighbourhoods.get('rural').compose(b, { x: 0, z: 0 }, { providers: { plant: createPlantProvider({ seed }) } })
      return placements(b.parts, 'plant').map((plant) => plant.id)
    }
    expect(ids(1)).toEqual(ids(1))
    expect(ids(1)).not.toEqual(ids(2))
  })

  it('the context of each kind and the choice are options', () => {
    const b = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('rural').compose(b, { x: 0, z: 0 }, { providers: { plant: createPlantProvider({ contexts: { tree: 'semiarid', pine: 'semiarid' }, pick: (_request, context) => `ctx:${context}` }) } })
    expect(new Set(placements(b.parts, 'plant').map((plant) => plant.id))).toEqual(new Set(['ctx:semiarid']))
  })
})
