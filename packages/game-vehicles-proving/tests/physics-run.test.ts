import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createProvingTests, runTest, runTestOnPhysics, startPhysicsRun, subjectFromCard } from '../src'
import type { ProvingResult } from '../src'

// the same cards as `proving.test.ts`, so the two runners are held against one another
const hatch = subjectFromCard('compact_hatch', { stats: { acceleration: 7, handling: 7, maxSpeedKmh: 170 }, dims: { length: 4.212, width: 1.919, height: 1.472 }, group: 'cars', mass: 1034 })
const pickup = subjectFromCard('midsize_pickup', { stats: { acceleration: 7, handling: 6, maxSpeedKmh: 180 }, dims: { length: 5.339, width: 2.022, height: 2.029 }, group: 'pickups', mass: 2000, fourWheelDrive: true })
const tests = createProvingTests()

const engine = await createJoltEngine()
const createWorld = () => engine.createWorld(KIT_WORLD)
const onPhysics = (id: string, subject = hatch): ProvingResult => runTestOnPhysics(tests.get(id)!, subject, { createWorld })

describe('the proving ground on the physics engine', () => {
  it('a hatch tops out at its card, stops from 100 km/h, turns in about ten metres and stops on the wet, all inside the ranges', () => {
    for (const id of ['top_speed', 'brake_100_0', 'turn_circle', 'wet_brake_80_0']) {
      const result = onPhysics(id)
      expect(result.verdict, `${id}: ${result.value} outside ${JSON.stringify(result.range)}`).toBe('pass')
    }
  })

  it('agrees with the semi-simulation on the same card: top speed within 10% (the car has the engine vehicle\'s torque scale: 7% over), braking within 25%, the turning circle within 15%', () => {
    const near = (id: string, tolerance: number): void => {
      const physics = onPhysics(id).value!
      const semi = runTest(tests.get(id)!, hatch).value!
      expect(Math.abs(physics - semi) / semi, `${id}: physics ${physics}, semi ${semi}`).toBeLessThan(tolerance)
    }
    near('top_speed', 0.1)
    near('brake_100_0', 0.25)
    near('turn_circle', 0.15)
  })

  it('launch: 0 to 100 km/h on the engine takes less than in the semi-simulation, and more than half of it (recorded: the torque scale of the engine vehicle pays for the wheelspin, the rotating parts and the shifts the semi-simulation does not have)', () => {
    const physics = onPhysics('accel_0_100').value!
    const semi = runTest(tests.get('accel_0_100')!, hatch).value!
    expect(physics).toBeLessThan(semi)
    expect(physics).toBeGreaterThan(semi / 2)
  })

  it('a four-wheel drive gets through the mud and a two-wheel drive sinks, as in the semi-simulation', () => {
    expect(onPhysics('mud_traction', pickup).value).toBeGreaterThan(10)
    expect(onPhysics('mud_traction').value).toBeLessThan(25)
    expect(runTest(tests.get('mud_traction')!, hatch).value).toBeLessThan(5)
  })

  it('steps live: a trace for the chart, a state the procedures read, a pending result while it runs, and the world is let go at the end', () => {
    const run = startPhysicsRun(tests.get('accel_0_100')!, hatch, { createWorld })
    run.stepFixed(120)
    expect(run.done).toBe(false)
    expect(run.result().verdict).toBe('pending')
    expect(run.input.throttle).toBe(1)
    expect(run.state.u).toBeGreaterThan(1)
    expect(run.time).toBeCloseTo(1, 9)
    while (!run.done) run.stepFixed(120)
    expect(run.trace.length).toBeGreaterThan(20)
    expect(run.result().value).not.toBeNull()
    run.dispose()
  })

  it('refuses a test that is not measured', () => {
    expect(() => startPhysicsRun(tests.get('cabin')!, hatch, { createWorld })).toThrow(/not a measured test/)
  })
})
