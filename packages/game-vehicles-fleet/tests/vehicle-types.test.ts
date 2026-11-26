import { describe, expect, it } from 'vitest'

import { air, fleetProvingSubject, fleetVehicleTypeOf, water } from '../src'

describe('what the fleet builds each model as (T6.2c)', () => {
  it.each([
    ['compact_hatch', 'car'],
    ['quad_bike', 'car'],
    ['sport_bike', 'motorcycle'],
    ['step_through_scooter', 'motorcycle'],
    ['bicycle', 'bicycle'],
    ['city_bus', 'truck'],
    ['apc_6x6', 'truck'],
    ['tractor', 'tractor'],
    ['battle_tank', 'tracked'],
  ])('%s is a %s', (id, type) => {
    expect(fleetVehicleTypeOf(id)).toBe(type)
    expect(fleetProvingSubject(id)!.body.type).toBe(type)
  })

  it('takes the wheelbase and the axles from the model: the city bus turns on its real 6.4 m, not 0.6 of its length', () => {
    const bus = fleetProvingSubject('city_bus')!
    expect(bus.body.wheelbase).toBe(6.4)
    expect(bus.body.axles).toHaveLength(2)
    expect(fleetProvingSubject('apc_6x6')!.body.axles).toHaveLength(3)
  })

  it('a vehicle that is not on the ground has no type', () => {
    expect(fleetProvingSubject(air[0])!.body.type).toBeUndefined()
    expect(fleetProvingSubject(water[0])!.body.type).toBeUndefined()
  })
})
