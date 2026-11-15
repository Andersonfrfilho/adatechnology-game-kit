import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import type { PhysicsWorld, VehicleDesc, VehicleId, WheelDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { eulerXYZ, ground, HATCH, report, stats } from './scenes'

const KMH60 = 60 / 3.6
/** Chassis box (bottom at the ground clearance) plus the cabin; the centre of mass follows from the two. */
const BODY_HALF = 0.36
const centreY = HATCH.clearance + BODY_HALF

const wheel = (x: number, z: number, front: boolean): WheelDesc => ({
  position: [x, HATCH.tyre / 2 + 0.15 - centreY, z],
  radius: HATCH.tyre / 2,
  width: 0.185,
  suspensionMin: 0.05,
  suspensionMax: 0.25,
  frequency: 1.5,
  damping: 0.5,
  maxSteer: front ? 0.6 : 0,
  driven: front,
  maxBrakeTorque: 1500,
  maxHandBrakeTorque: front ? 0 : 4000,
})

const hatch = (world: PhysicsWorld, x: number, z: number, speed: number, user: number): VehicleId => {
  const w = HATCH.track / 2
  const l = HATCH.wheelbase / 2
  const desc: VehicleDesc = {
    chassis: {
      shape: {
        kind: 'compound',
        children: [
          { shape: { kind: 'box', half: [HATCH.width / 2, BODY_HALF, HATCH.length / 2] }, position: [0, 0, 0], tag: 0 },
          { shape: { kind: 'box', half: [HATCH.width / 2 - 0.1, 0.27, 1.0] }, position: [0, BODY_HALF + 0.27, -0.2], tag: 1 },
        ],
      },
      motion: 'dynamic',
      position: [x, centreY + 0.05, z],
      mass: HATCH.mass,
      user,
      linearVelocity: [0, 0, speed],
    },
    wheels: [wheel(w, l, true), wheel(-w, l, true), wheel(w, -l, false), wheel(-w, -l, false)],
    maxTorque: 160,
    minRpm: 1000,
    maxRpm: 6000,
    gears: [3.5, 2.0, 1.4, 1.0, 0.8],
    reverseGears: [-3.3],
    differentialRatio: 4.2,
    antiRoll: 1000,
  }
  return world.createVehicle(desc)
}

const upY = (q: Float64Array): number => 1 - 2 * (q[3] * q[3] + q[5] * q[5])

describe('case 3: vehicle', () => {
  const drive = (world: JoltWorld, car: VehicleId, seconds: number, holdUntil: number, watch: (i: number, pose: Float64Array, vel: Float64Array) => void): number[] => {
    const body = world.vehicleBody(car)
    const pose = new Float64Array(7)
    const vel = new Float64Array(6)
    const steps: number[] = []
    for (let i = 0; i < 60 * seconds; i++) {
      world.readVelocity(body, vel, 0)
      const forward = vel[2] < KMH60 && i < 60 * holdUntil ? 1 : 0
      world.driveVehicle(car, { forward, right: 0, brake: 0, handBrake: 0 })
      const t0 = performance.now()
      world.step(1 / 60)
      steps.push(performance.now() - t0)
      world.readPose(body, pose, 0)
      world.readVelocity(body, vel, 0)
      expect(Number.isFinite(pose[1])).toBe(true)
      watch(i, pose, vel)
    }
    return steps
  }

  it('compact hatch at 60 km/h into a 30 cm curb', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 }) as JoltWorld
    ground(world, 200)
    world.createBody({ shape: { kind: 'box', half: [4, 0.15, 0.15] }, motion: 'static', position: [0, 0.15, 25], user: -1 })
    const car = hatch(world, 0, 0, KMH60, 1)
    let atCurb = 0
    let minUp = 1
    let maxSpin = 0
    let maxRise = 0
    let settled = -1
    let last = new Float64Array(7)
    const steps = drive(world, car, 8, 1.2, (i, pose, vel) => {
      if (atCurb === 0 && pose[2] > 22.5) atCurb = Math.hypot(vel[0], vel[1], vel[2]) * 3.6
      minUp = Math.min(minUp, upY(pose))
      maxSpin = Math.max(maxSpin, Math.hypot(vel[3], vel[4], vel[5]))
      maxRise = Math.max(maxRise, pose[1] - (centreY + 0.05))
      if (settled < 0 && i > 120 && world.isSleeping(world.vehicleBody(car))) settled = i / 60
      last = pose.slice()
    })
    report('vehicle-curb', { speedAtCurbKmh: Math.round(atCurb), minUp, maxSpinRadS: maxSpin, maxRiseM: maxRise, settledAtS: settled, finalZ: last[2], wheelsOnGround: world.wheelContacts(car), step: stats(steps) })
    expect(atCurb).toBeGreaterThan(50)
    expect(minUp).toBeGreaterThan(0.5)
    world.dispose()
  })

  it('compact hatch at 60 km/h up a one-sided ramp: rolls over and settles', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 }) as JoltWorld
    ground(world, 200)
    // under the left wheels only: 0.9 m high over 3 m
    world.createBody({ shape: { kind: 'box', half: [0.6, 0.05, 1.6] }, motion: 'static', position: [0.75, 0.45, 25], rotation: eulerXYZ(-Math.atan2(0.9, 3), 0, 0), user: -1 })
    const car = hatch(world, 0, 0, KMH60, 1)
    let minUp = 1
    let maxSpin = 0
    let maxSpeed = 0
    let settled = -1
    let last = new Float64Array(7)
    const steps = drive(world, car, 12, 1.2, (i, pose, vel) => {
      minUp = Math.min(minUp, upY(pose))
      maxSpin = Math.max(maxSpin, Math.hypot(vel[3], vel[4], vel[5]))
      maxSpeed = Math.max(maxSpeed, Math.hypot(vel[0], vel[1], vel[2]))
      const still = Math.hypot(vel[0], vel[1], vel[2], vel[3], vel[4], vel[5]) < 0.05
      if (settled < 0 && still) settled = i / 60
      if (!still) settled = -1
      last = pose.slice()
    })
    // the body stays awake while a wheel in the air still turns (Jolt's vehicle constraint), so "settled" is at rest, and sleep is reported apart
    report('vehicle-ramp-rollover', { asleepAtEnd: world.isSleeping(world.vehicleBody(car)), minUp, finalUp: upY(last), rolledOver: minUp < 0, maxSpinRadS: maxSpin, maxSpeed, settledAtS: settled, finalPose: [...last].map((x) => Math.round(x * 100) / 100), step: stats(steps) })
    expect(minUp).toBeLessThan(0)
    expect(maxSpeed).toBeLessThan(25)
    expect(settled).toBeGreaterThan(0)
    world.dispose()
  })

  it('costs: 10 hatches driving around', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    ground(world, 200)
    const cars = Array.from({ length: 10 }, (_, i) => hatch(world, (i % 5) * 4 - 8, Math.floor(i / 5) * 8, 10, i))
    const steps: number[] = []
    for (let i = 0; i < 600; i++) {
      for (const [k, c] of cars.entries()) world.driveVehicle(c, { forward: 0.6, right: Math.sin(i / 60 + k) * 0.5, brake: 0, handBrake: 0 })
      const t0 = performance.now()
      world.step(1 / 60)
      steps.push(performance.now() - t0)
    }
    report('vehicle-x10', { step: stats(steps) })
    world.dispose()
  })
})
