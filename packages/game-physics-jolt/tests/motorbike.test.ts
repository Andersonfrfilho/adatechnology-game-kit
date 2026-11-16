import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { WheelDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const wheel = (z: number, steer: number): WheelDesc => ({
  position: [0, 0.1, z], radius: 0.3, width: 0.12, suspensionMin: 0.1, suspensionMax: 0.3, frequency: 2, damping: 0.5,
  maxSteer: steer, driven: z < 0, maxBrakeTorque: 500, maxHandBrakeTorque: 0,
})

describe('a two-wheeled vehicle', () => {
  it('is read with its two wheels (never a third) and its driven wheel pulls it forward', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    const bike = world.createVehicle({
      chassis: { shape: { kind: 'box', half: [0.15, 0.3, 0.8] }, motion: 'dynamic', position: [0, 0.75, 0], mass: 200, user: 1 },
      wheels: [wheel(0.7, 0.5), wheel(-0.7, 0)],
      maxTorque: 200, minRpm: 1000, maxRpm: 6000, gears: [3, 2, 1.4], reverseGears: [-3], differentialRatio: 3,
    })
    for (let i = 0; i < 60; i++) world.step(1 / 120)
    expect(world.wheelContacts(bike)).toBeLessThanOrEqual(2)
    const out = new Float64Array(7)
    for (let i = 0; i < 360; i++) {
      world.driveVehicle(bike, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      world.step(1 / 120)
    }
    world.readPose(world.vehicleBody(bike), out, 0)
    expect(out[2]).toBeGreaterThan(0.5)
    world.dispose()
  })
})
