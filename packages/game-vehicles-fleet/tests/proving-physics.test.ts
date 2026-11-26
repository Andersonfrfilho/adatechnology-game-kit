import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { createProvingTests, runTestOnPhysics } from '@adatechnology/game-vehicles-proving'

import { fleetProvingSubject, fleetVehicleIds } from '../src'

/**
 * The land fleet on the physics engine (T6.2b): each model, mapped from its card by `vehicleDescFromSemi` and run through the six measured tests of the proving ground on
 * the engine's vehicle, against the same ranges the semi-simulation is held to. The ranges are not touched here; what is out of them is written below, with the
 * measured numbers in `specs/008-motor-fisico-jolt/evidence.md` (`## T6.2b`). The test fails when a model's out-of-range set CHANGES, in either direction: a fix has to
 * shrink this table, a regression cannot hide in it.
 *
 * The three aircraft of the `military` group are left out: `fleetProvingSubject` takes the domain from the group, so they come back as land vehicles, and a helicopter
 * or a turboprop has no business on a road (the semi-simulation fails them too).
 */
const AIRCRAFT = ['transport_helicopter', 'light_attack_turboprop', 'attack_helicopter']

const OUT_OF_RANGE: Readonly<Record<string, readonly string[]>> = {
  entry_hatch: ['accel_0_100'],
  electric_hatch: ['accel_0_100'],
  bicycle: ['accel_0_100', 'top_speed', 'brake_100_0', 'wet_brake_80_0'],
  scooter: ['accel_0_100'],
  commuter_motorcycle: ['accel_0_100'],
  trail_bike: ['accel_0_100'],
  beetle: ['accel_0_100'],
  cargo_van: ['accel_0_100'],
  box_truck: ['accel_0_100'],
  tanker_truck: ['accel_0_100'],
  school_bus: ['accel_0_100'],
  city_bus: ['accel_0_100', 'turn_circle'],
  armored_truck: ['accel_0_100'],
  tractor: ['accel_0_100', 'top_speed', 'brake_100_0'],
  step_through_scooter: ['accel_0_100', 'top_speed', 'brake_100_0', 'wet_brake_80_0'],
  naked_bike: ['accel_0_100'],
  sport_bike: ['accel_0_100'],
  cruiser: ['accel_0_100'],
  delivery_bike: ['accel_0_100'],
  family_hatch: ['accel_0_100'],
  v8_coupe: ['accel_0_100'],
}

const TESTS = ['accel_0_100', 'top_speed', 'brake_100_0', 'turn_circle', 'wet_brake_80_0', 'mud_traction'] as const

const landFleet = fleetVehicleIds.filter((id) => fleetProvingSubject(id)?.domain === 'land' && !AIRCRAFT.includes(id))

describe('the land fleet on the physics engine (spec 008, T6.2b)', () => {
  const tests = createProvingTests()

  it('is the 48 land models of the fleet', () => {
    expect(landFleet).toHaveLength(48)
  })

  it.each(landFleet)('%s: runs the six measured tests, and what is out of its ranges is what the table says', async (id) => {
    const engine = await createJoltEngine()
    const subject = fleetProvingSubject(id)!
    const outside: string[] = []
    for (const test of TESTS) {
      const result = runTestOnPhysics(tests.get(test)!, subject, { createWorld: () => engine.createWorld(KIT_WORLD) })
      if (result.verdict !== 'pass') outside.push(test)
    }
    expect(outside).toEqual(OUT_OF_RANGE[id] ?? [])
  })

  it('the table lists only models of the land fleet, and 21 of 48 have something out of range', () => {
    for (const id of Object.keys(OUT_OF_RANGE)) expect(landFleet).toContain(id)
    expect(Object.keys(OUT_OF_RANGE)).toHaveLength(21)
  })
})
