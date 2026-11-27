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
 * What is still out: nothing (T6.2d). The 17 models that were out after T6.2c were fixed at the cause, not by loosening a band that has a source:
 * - the engine gave every differential the whole engine torque and a tracked controller the whole torque to each track, so the 4x4s, the 6x6s and the tank pulled with two or three engines (adapter, `vehicle-controllers.ts`);
 * - the engine's cars and bikes took 1.2 to 1.8 times the semi-simulation's 0-100 km/h (a wheel spins, a spinning wheel blocks the gearbox's upshift, the shift cuts the drive, the rotating parts have inertia): `PHYSICS_TORQUE_SCALE`;
 * - the engine mixed the tyre's grip and the ground's by the geometric mean (0.9 g on a 0.75 road), the semi-simulation by the product (0.8 g): the wheels' own callback now mixes by the product at the peak (`vehicles.ts`);
 * - the tank has the real power of a main battle tank (20 kW/t, not 52), pivots on the spot (the turn band starts at 0) and the cyclist holds his 250 W down to a low cadence, against a band that is the span of real riders.
 * Every number and source is in `specs/008-motor-fisico-jolt/evidence.md` (`## T6.2d`). The test still fails when a model's out-of-range set CHANGES, in either direction.
 */
const OUT_OF_RANGE: Readonly<Record<string, readonly string[]>> = {}

/** The same for the semi-simulation (the bikes' two wheels brake in a shorter distance than the band's, the semi has no weight transfer to a stoppie; the tractor has the car's launch; the naked bike no longer has the 1.3 on its power that was never sourced). */
const SEMI_OUT_OF_RANGE: Readonly<Record<string, readonly string[]>> = {
  scooter: ['brake_100_0', 'wet_brake_80_0'],
  commuter_motorcycle: ['brake_100_0', 'wet_brake_80_0'],
  trail_bike: ['brake_100_0', 'wet_brake_80_0'],
  quad_bike: ['brake_100_0', 'wet_brake_80_0'],
  beetle: ['accel_0_100'],
  hybrid_suv: ['accel_0_100'],
  tractor: ['accel_0_100', 'brake_100_0', 'wet_brake_80_0'],
  light_4x4: ['turn_circle', 'wet_brake_80_0'],
  troop_truck: ['accel_0_100'],
  step_through_scooter: ['brake_100_0', 'wet_brake_80_0'],
  naked_bike: ['accel_0_100', 'brake_100_0'],
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

  it('the table lists only models of the land fleet, and none of the 48 has anything out of range', () => {
    for (const id of Object.keys(OUT_OF_RANGE)) expect(landFleet).toContain(id)
    expect(Object.keys(OUT_OF_RANGE)).toHaveLength(0)
  })

  it.each(landFleet)('%s on the semi-simulation: what is out of its ranges is what the table says', (id) => {
    const subject = fleetProvingSubject(id)!
    const outside = TESTS.filter((test) => runTest(tests.get(test)!, subject).verdict !== 'pass')
    expect(outside).toEqual(SEMI_OUT_OF_RANGE[id] ?? [])
  })

  it('13 of 48 have something out of range on the semi-simulation', () => {
    expect(Object.keys(SEMI_OUT_OF_RANGE)).toHaveLength(13)
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
