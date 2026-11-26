import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { createProvingTests, defaultRangeTable, expectedAcceleration, runTest, runTestOnPhysics } from '@adatechnology/game-vehicles-proving'

import { FLEET_ACCELERATION_SOURCES, fleetProvingSubject, fleetVehicleIds } from '../src'

/**
 * The land fleet on the physics engine (T6.2b): each model, mapped from its card by `vehicleDescFromSemi` and run through the six measured tests of the proving ground on
 * the engine's vehicle, against the same ranges the semi-simulation is held to. The ranges are the sourced class bands of `ranges.ts` (cars, suvs, motorcycles) and the table by rating for the rest; what is out of them is written below, with the
 * measured numbers in `specs/008-motor-fisico-jolt/evidence.md` (`## T6.2b`). The test fails when a model's out-of-range set CHANGES, in either direction: a fix has to
 * shrink this table, a regression cannot hide in it.
 *
 * The three aircraft of the `military` group are left out: `fleetProvingSubject` takes the domain from the group, so they come back as land vehicles, and a helicopter
 * or a turboprop has no business on a road (the semi-simulation fails them too).
 */
const AIRCRAFT = ['transport_helicopter', 'light_attack_turboprop', 'attack_helicopter']

/**
 * What is still out, and why (T6.2c: the ficha follows the vehicle's type, so the bikes have two wheels, the trucks their axles, the bicycle a cyclist, the tractor its low top speed and the tank tracks):
 * - cars and SUVs, `accel_0_100` (entry_hatch, beetle, hybrid_suv, rideshare_hatch, v8_coupe): the car ficha is unchanged; the engine's tyre-limited launch and gearbox take 1.4 to 1.8 times what the semi-simulation does, on a band that is sourced.
 * - heavy and military, `accel_0_100` (monster_truck, tanker_truck, troop_truck, apc_6x6, armored_car_6x6, battle_tank): TOO FAST, not too slow. The torque per kg of the ficha is the car's (about 59 kW/t at rating 5, a 25 t armoured car in 4.4 s) and the band is a table by rating
 *   with no source, so neither is a figure to calibrate to ("sem fonte"): they wait for a real power to weight and a real 0-100 for the class.
 * - bicycle `accel_0_100`: the band (0.6-1.2 s to 22 km/h) asks 5 m/s^2 of a cyclist, 250 W cannot give it; it stays out unless the owner re-rates the bicycle or the band.
 * - battle_tank `turn_circle`: on its tracks it pivots on the spot (a 0.1 m circle) and the class band starts at 9 m.
 * - tractor `wet_brake_80_0`: on wet asphalt it never reaches the 22 km/h target (18.7 km/h): a slipping driven wheel stops the engine's gearbox from upshifting.
 * - scooter, trail_bike, step_through_scooter, delivery_bike `wet_brake_80_0`: stop 0.2 to 1.2 m inside the band; the engine combines tyre and ground grip by the geometric mean (0.9 g on a 0.75 road), the semi-simulation by the product (0.8 g).
 */
const OUT_OF_RANGE: Readonly<Record<string, readonly string[]>> = {
  entry_hatch: ['accel_0_100'],
  beetle: ['accel_0_100'],
  hybrid_suv: ['accel_0_100'],
  rideshare_hatch: ['accel_0_100'],
  v8_coupe: ['accel_0_100'],
  bicycle: ['accel_0_100'],
  scooter: ['wet_brake_80_0'],
  trail_bike: ['wet_brake_80_0'],
  step_through_scooter: ['wet_brake_80_0'],
  delivery_bike: ['wet_brake_80_0'],
  monster_truck: ['accel_0_100'],
  tanker_truck: ['accel_0_100'],
  troop_truck: ['accel_0_100'],
  apc_6x6: ['accel_0_100'],
  armored_car_6x6: ['accel_0_100'],
  battle_tank: ['accel_0_100', 'turn_circle'],
  tractor: ['wet_brake_80_0'],
}

/** The same for the semi-simulation (the bikes' two wheels brake in a shorter distance than the band's, the semi has no weight transfer to a stoppie; the tractor has the car's launch). */
const SEMI_OUT_OF_RANGE: Readonly<Record<string, readonly string[]>> = {
  bicycle: ['accel_0_100'],
  scooter: ['brake_100_0', 'wet_brake_80_0'],
  commuter_motorcycle: ['brake_100_0', 'wet_brake_80_0'],
  trail_bike: ['brake_100_0', 'wet_brake_80_0'],
  quad_bike: ['brake_100_0', 'wet_brake_80_0'],
  beetle: ['accel_0_100'],
  hybrid_suv: ['accel_0_100'],
  tractor: ['accel_0_100', 'brake_100_0', 'wet_brake_80_0'],
  light_4x4: ['turn_circle', 'wet_brake_80_0'],
  troop_truck: ['accel_0_100'],
  battle_tank: ['accel_0_100'],
  step_through_scooter: ['brake_100_0', 'wet_brake_80_0'],
  naked_bike: ['brake_100_0', 'wet_brake_80_0'],
  delivery_bike: ['brake_100_0', 'wet_brake_80_0'],
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

  it('the table lists only models of the land fleet, and 17 of 48 have something out of range', () => {
    for (const id of Object.keys(OUT_OF_RANGE)) expect(landFleet).toContain(id)
    expect(Object.keys(OUT_OF_RANGE)).toHaveLength(17)
  })

  it.each(landFleet)('%s on the semi-simulation: what is out of its ranges is what the table says', (id) => {
    const subject = fleetProvingSubject(id)!
    const outside = TESTS.filter((test) => runTest(tests.get(test)!, subject).verdict !== 'pass')
    expect(outside).toEqual(SEMI_OUT_OF_RANGE[id] ?? [])
  })

  it('15 of 48 have something out of range on the semi-simulation', () => {
    expect(Object.keys(SEMI_OUT_OF_RANGE)).toHaveLength(15)
  })
})

describe('the acceleration ratings of cars and suvs come from the real 0-100 km/h', () => {
  it.each(Object.entries(FLEET_ACCELERATION_SOURCES).filter(([, entry]) => entry.seconds !== null))('%s: its rating is the nearest one to the sourced time on the class band', (id, entry) => {
    const subject = fleetProvingSubject(id)!
    const distanceAt = (rating: number): number => Math.abs(expectedAcceleration(defaultRangeTable, { ...subject, stats: { ...subject.stats, acceleration: rating } }, 100) - entry.seconds!)
    const rating = subject.stats.acceleration
    expect(distanceAt(rating)).toBeLessThanOrEqual(Math.min(distanceAt(Math.max(1, rating - 1)), distanceAt(Math.min(10, rating + 1))))
  })
})
