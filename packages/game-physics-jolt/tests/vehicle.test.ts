import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { KIT_WORLD, WHEEL_READ, WHEEL_READ_STRIDE } from '@adatechnology/game-physics'
import type { PhysicsWorld, VehicleDesc, VehicleId, WheelDesc } from '@adatechnology/game-physics'
import { createPhysicsInputMapper, createSemiSimDriver, defaultSemiSpec, resistanceImpulse, vehicleDescFromSemi } from '@adatechnology/game-vehicles-driving'
import type { DriveStatus, PedalOptions, SemiInput, SemiSimSpec, VehicleCondition } from '@adatechnology/game-vehicles-driving'
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

describe('T6.2: the semi-simulation car on the engine (vehicleDescFromSemi, createPhysicsInputMapper, resistanceImpulse)', () => {
  const STEP = 1 / 120
  const idle: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
  const yawOf = (q: readonly number[]): number => Math.atan2(2 * (q[3]! * q[1]! + q[0]! * q[2]!), 1 - 2 * (q[1]! * q[1]! + q[0]! * q[0]!))

  interface Rig {
    readonly world: PhysicsWorld
    readonly id: VehicleId
    readonly body: ReturnType<PhysicsWorld['vehicleBody']>
    readonly pose: Float64Array
    readonly vel: Float64Array
    step(input: SemiInput, status?: Partial<DriveStatus>): void
    /** The yaw turned since the last call, unwrapped. */
    turned(): number
  }

  /** The spec's car on dry asphalt (the ground body's friction is the surface's grip, 1). */
  const rig = async (spec: SemiSimSpec, options: { speed?: number; heading?: number; condition?: VehicleCondition; pedal?: PedalOptions } = {}): Promise<Rig> => {
    const world = (await createJoltEngine()).createWorld({ fixedStep: STEP })
    world.createBody({ shape: { kind: 'box', half: [20000, 0.5, 20000] }, motion: 'static', position: [0, -0.5, 0], user: -1, material: { frictionStatic: 1, frictionDynamic: 1, restitution: 0 } })
    const heading = options.heading ?? 0
    const desc = vehicleDescFromSemi(spec, {
      chassis: {
        shape: { kind: 'box', half: [0.9, 0.35, 2.2] },
        position: [0, spec.centreHeight + 0.05, 0],
        user: 1,
        ...(options.speed ? { linearVelocity: [Math.sin(heading) * options.speed, 0, Math.cos(heading) * options.speed] as const } : {}),
        ...(heading ? { rotation: eulerXYZ(0, heading, 0) } : {}),
      },
      ...(options.condition ? { condition: options.condition } : {}),
      ...(options.pedal ? { pedal: options.pedal } : {}),
    })
    const id = world.createVehicle(desc)
    const body = world.vehicleBody(id)
    const mapper = createPhysicsInputMapper()
    const pose = new Float64Array(7)
    const vel = new Float64Array(6)
    let previous = heading
    return {
      world, id, body, pose, vel,
      step(input, status) {
        world.readVelocity(body, vel, 0)
        const forward = Math.sin(heading) * vel[0]! + Math.cos(heading) * vel[2]!
        world.driveVehicle(id, mapper.map({ input, speed: forward, dt: STEP, ...(status ? { status } : {}) }))
        world.addImpulse(body, resistanceImpulse(spec, [vel[0]!, vel[1]!, vel[2]!], STEP))
        world.step(STEP)
      },
      turned() {
        world.readPose(body, pose, 0)
        let delta = yawOf([pose[3]!, pose[4]!, pose[5]!, pose[6]!]) - previous
        if (delta > Math.PI) delta -= 2 * Math.PI
        if (delta < -Math.PI) delta += 2 * Math.PI
        previous += delta
        return delta
      },
    }
  }
  const speedOf = (r: Rig): number => {
    r.world.readVelocity(r.body, r.vel, 0)
    return Math.hypot(r.vel[0]!, r.vel[2]!)
  }

  it('stands on its wheels at the height the spec says it does (within 6 cm: the engine\'s spring uses the effective mass at the wheel, not a quarter of the car)', async () => {
    const r = await rig(defaultSemiSpec)
    for (let i = 0; i < 240; i++) r.step(idle)
    r.world.readPose(r.body, r.pose, 0)
    report('t6.2-stance', { y: r.pose[1], spec: defaultSemiSpec.centreHeight, contacts: r.world.wheelContacts(r.id) })
    expect(r.world.wheelContacts(r.id)).toBe(4)
    expect(Math.abs(r.pose[1]! - defaultSemiSpec.centreHeight)).toBeLessThan(0.06)
    r.world.dispose()
  })

  it('after 150 s of full throttle (its top speed) it has the speed the semi-simulation has (within 5%: the drag, the rolling resistance, the gears and the engine agree)', async () => {
    const semi = createSemiSimDriver()
    for (let i = 0; i < 120 * 150; i++) semi.step({ ...idle, throttle: 1 }, STEP)
    const r = await rig(defaultSemiSpec)
    for (let i = 0; i < 120 * 150; i++) r.step({ ...idle, throttle: 1 })
    const top = speedOf(r)
    report('t6.2-top-speed', { jolt: top, semi: semi.state.u })
    expect(Math.abs(top - semi.state.u) / semi.state.u).toBeLessThan(0.05)
    r.world.dispose()
  })

  it('launch: 0 to 60 km/h on dry asphalt takes 5.9 s against the semi-simulation\'s 3.8 s: the engine spins the rear wheels (recorded, not an equivalence)', async () => {
    const semi = createSemiSimDriver()
    let semiTime = -1
    for (let i = 0; i < 120 * 20 && semiTime < 0; i++) {
      semi.step({ ...idle, throttle: 1 }, STEP)
      if (semi.state.u > 60 / 3.6) semiTime = i * STEP
    }
    const r = await rig(defaultSemiSpec)
    for (let i = 0; i < 120; i++) r.step(idle)
    let time = -1
    for (let i = 0; i < 120 * 20 && time < 0; i++) {
      r.step({ ...idle, throttle: 1 })
      if (speedOf(r) > 60 / 3.6) time = i * STEP
    }
    report('t6.2-launch', { jolt: time, semi: semiTime })
    expect(time).toBeGreaterThan(semiTime)
    expect(time).toBeLessThan(9)
    r.world.dispose()
  })

  it('brakes from 100 km/h in a distance within 30% of the semi-simulation\'s', async () => {
    const semi = createSemiSimDriver()
    semi.state.u = 100 / 3.6
    let semiDistance = 0
    for (let i = 0; i < 120 * 15 && semi.state.u > 0.3; i++) {
      semi.step({ ...idle, brake: 1 }, STEP)
      semiDistance += semi.state.u * STEP
    }
    const r = await rig(defaultSemiSpec, { speed: 100 / 3.6 })
    for (let i = 0; i < 60; i++) r.step({ ...idle, throttle: 0.4 })
    r.world.readPose(r.body, r.pose, 0)
    const start = r.pose[2]!
    for (let i = 0; i < 120 * 15 && speedOf(r) > 0.3; i++) r.step({ ...idle, brake: 1 })
    r.world.readPose(r.body, r.pose, 0)
    const distance = r.pose[2]! - start
    report('t6.2-braking', { jolt: distance, semi: semiDistance })
    expect(distance / semiDistance).toBeGreaterThan(0.9)
    expect(distance / semiDistance).toBeLessThan(1.3)
    r.world.dispose()
  })

  it('steering left at 15 m/s turns by what the semi-simulation turns in 2 s (within 10%), and a steer to the right turns the other way', async () => {
    const semi = createSemiSimDriver()
    semi.state.u = 15
    for (let i = 0; i < 60; i++) semi.step({ ...idle, throttle: 0.3 }, STEP)
    const from = semi.state.yaw
    for (let i = 0; i < 240; i++) semi.step({ ...idle, throttle: 0.3, steer: 0.4 }, STEP)
    const semiTurn = semi.state.yaw - from
    const turnFor = async (steer: number): Promise<number> => {
      const r = await rig(defaultSemiSpec, { speed: 15 })
      for (let i = 0; i < 60; i++) r.step({ ...idle, throttle: 0.3 })
      r.turned()
      let total = 0
      for (let i = 0; i < 240; i++) {
        r.step({ ...idle, throttle: 0.3, steer })
        total += r.turned()
      }
      r.world.dispose()
      return total
    }
    const left = await turnFor(0.4)
    const right = await turnFor(-0.4)
    report('t6.2-steering', { jolt: left, semi: semiTurn, right })
    expect(Math.abs(left - semiTurn) / semiTurn).toBeLessThan(0.1)
    expect(right).toBeLessThan(0)
    expect(Math.abs(right + left)).toBeLessThan(0.1)
  })

  it('a vehicle that cannot drive (status canDrive false) does not move under full throttle', async () => {
    const r = await rig(defaultSemiSpec)
    for (let i = 0; i < 120 * 4; i++) r.step({ ...idle, throttle: 1 }, { canDrive: false })
    report('t6.2-cannot-drive', { speed: speedOf(r) })
    expect(speedOf(r)).toBeLessThan(0.5)
    r.world.dispose()
  })

  it('a flat front-left tyre sinks that corner onto its rim: the car stands tilted toward it, the other corners as before', async () => {
    const settle = async (condition: VehicleCondition): Promise<{ pitch: number; roll: number }> => {
      const r = await rig(defaultSemiSpec, { condition })
      for (let i = 0; i < 360; i++) r.step(idle)
      r.world.readPose(r.body, r.pose, 0)
      const q = [r.pose[3]!, r.pose[4]!, r.pose[5]!, r.pose[6]!]
      r.world.dispose()
      // pitch about x (nose down is positive), roll about z (left side down is positive)
      return { pitch: Math.asin(2 * (q[3]! * q[0]! - q[1]! * q[2]!)), roll: -Math.asin(2 * (q[3]! * q[2]! + q[0]! * q[1]!)) }
    }
    const whole = await settle({})
    const flat = await settle({ tyres: [0.1, 1, 1, 1] })
    report('t6.2-flat-tyre', { whole, flat })
    expect(Math.abs(whole.pitch)).toBeLessThan(0.01)
    expect(Math.abs(whole.roll)).toBeLessThan(0.01)
    expect(Math.abs(flat.pitch - whole.pitch)).toBeGreaterThan(0.01)
    expect(Math.abs(flat.roll - whole.roll)).toBeGreaterThan(0.005)
  })

  it('made at 60 km/h turned 37 degrees it keeps its heading and its speed for 2 s (under 1 km/h with the throttle that holds the speed)', async () => {
    const heading = 37 * (Math.PI / 180)
    const r = await rig(defaultSemiSpec, { speed: 60 / 3.6, heading })
    for (let i = 0; i < 30; i++) r.step({ ...idle, throttle: 0.4 })
    r.turned()
    const v0 = speedOf(r)
    let sideways = 0
    let drift = 0
    for (let i = 0; i < 240; i++) {
      r.step({ ...idle, throttle: 0.4 })
      drift += r.turned()
      r.world.readVelocity(r.body, r.vel, 0)
      sideways = Math.max(sideways, Math.abs(r.vel[0]! * Math.cos(heading) - r.vel[2]! * Math.sin(heading)))
    }
    report('t6.2-created-moving', { lostKmh: (v0 - speedOf(r)) * 3.6, sidewaysMs: sideways, drift })
    expect(Math.abs(drift)).toBeLessThan(0.05)
    expect(sideways).toBeLessThan(0.5)
    expect((v0 - speedOf(r)) * 3.6).toBeLessThan(1)
    r.world.dispose()
  })

  it('a bicycle: the cyclist is the engine; it rides at 7 m/s and more with 250 W and stays upright for 40 s', async () => {
    const bicycle: SemiSimSpec = {
      ...defaultSemiSpec, mass: 90, centreHeight: 0.9, wheelRadius: 0.34, fourWheelDrive: false, efficiency: 0.95,
      wheels: [{ x: 0.55, z: 0, steer: true }, { x: -0.55, z: 0, drive: true }],
      suspension: { restLength: 0.1, spring: 20000, damper: 1500 }, drag: 0.25, rolling: 0.005, brakeForce: 900, maxSteer: 0.4,
    }
    const r = await rig(bicycle, { pedal: { watts: 250, cadenceRpm: 80, gears: [1.5, 2.5, 3.5] } })
    let maxRoll = 0
    for (let i = 0; i < 120 * 40; i++) {
      r.step({ ...idle, throttle: 1 })
      r.world.readPose(r.body, r.pose, 0)
      const q = [r.pose[3]!, r.pose[4]!, r.pose[5]!, r.pose[6]!]
      maxRoll = Math.max(maxRoll, Math.abs(Math.atan2(2 * (q[3]! * q[2]! + q[0]! * q[1]!), 1 - 2 * (q[2]! * q[2]! + q[0]! * q[0]!))))
    }
    report('t6.2-bicycle', { speed: speedOf(r), maxRoll })
    expect(speedOf(r)).toBeGreaterThan(7)
    expect(maxRoll).toBeLessThan(0.1)
    r.world.dispose()
  })
})

describe('T6.3: the car sleeps when it is at rest and stays awake while a wheel turns (design 7.7)', () => {
  const STEP = KIT_WORLD.fixedStep ?? 1 / 120
  const none = { forward: 0, right: 0, brake: 0, handBrake: 0 }
  const car = (world: PhysicsWorld, position: [number, number, number], speed = 0): VehicleId =>
    world.createVehicle({
      chassis: { shape: { kind: 'box', half: [0.8, 0.3, 2] }, motion: 'dynamic', position, mass: 1200, user: 2, allowSleep: true, ...(speed ? { linearVelocity: [0, 0, speed] as const } : {}) },
      wheels: [[0.7, 1.4], [-0.7, 1.4], [0.7, -1.4], [-0.7, -1.4]].map(([x, z], i) => ({
        position: [x!, -0.3, z!] as [number, number, number], radius: 0.3, width: 0.2, suspensionMin: 0.05, suspensionMax: 0.25, frequency: 1.5, damping: 0.5,
        maxSteer: i < 2 ? 0.6 : 0, driven: i < 2, maxBrakeTorque: 1500, maxHandBrakeTorque: i < 2 ? 0 : 4000,
      })),
      maxTorque: 160, minRpm: 1000, maxRpm: 6000, gears: [3.5, 2.0, 1.4], reverseGears: [-3.3], differentialRatio: 4.2, antiRoll: 1000,
    })
  const spins = (world: PhysicsWorld, id: VehicleId): number => {
    const out = new Float64Array(WHEEL_READ_STRIDE * 4)
    world.vehicleWheels(id, out)
    return Math.max(...[0, 1, 2, 3].map((i) => Math.abs(out[i * WHEEL_READ_STRIDE + WHEEL_READ.SPIN]!)))
  }

  it('a car brought to a stop with no input is asleep within 3 s of being still (chassis under 0.08 m/s)', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    ground(world, 400)
    const id = car(world, [0, 0.6, 0], 8)
    const body = world.vehicleBody(id)
    const vel = new Float64Array(6)
    for (let i = 0; i < 120 * 12; i++) {
      world.driveVehicle(id, { ...none, brake: speedOfBody(world, body, vel) > 0.1 ? 1 : 0 })
      world.step(STEP)
      if (speedOfBody(world, body, vel) < 0.08) break
    }
    let still = 0
    while (!world.isSleeping(body) && still < 120 * 10) {
      world.driveVehicle(id, none)
      world.step(STEP)
      still++

    }
    report('t6.3-park', { asleepAfterS: still * STEP, wheelSpin: spins(world, id) })
    expect(still * STEP).toBeLessThanOrEqual(3)
    world.dispose()
  })

  it('the compact hatch of the curb scene (60 km/h into 30 cm) is asleep within 7 s of the hit, throttle let go', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    ground(world, 200)
    world.createBody({ shape: { kind: 'box', half: [4, 0.15, 0.15] }, motion: 'static', position: [0, 0.15, 25], user: -1 })
    const id = hatch(world, 0, 0, KMH60, 1)
    const body = world.vehicleBody(id)
    const vel = new Float64Array(6)
    const pose = new Float64Array(7)
    let hit = -1
    let asleep = -1
    for (let i = 0; i < 120 * 20 && asleep < 0; i++) {
      world.readPose(body, pose, 0)
      // the throttle holds the speed for the first 1.2 s, as in the curb scene above
      world.driveVehicle(id, { ...none, forward: i < 120 * 1.2 && speedOfBody(world, body, vel) < KMH60 ? 1 : 0 })
      world.step(STEP)
      if (hit < 0 && pose[2]! > 22.5) hit = i
      if (hit >= 0 && world.isSleeping(body)) asleep = i
    }
    report('t6.3-curb', { hitAtS: hit * STEP, asleepAfterHitS: (asleep - hit) * STEP, wheelsOnGround: world.wheelContacts(id) })
    expect(hit).toBeGreaterThan(0)
    expect(asleep).toBeGreaterThan(0)
    expect((asleep - hit) * STEP).toBeLessThanOrEqual(7)
    world.dispose()
  })

  it('a wheel in the air still turning keeps the car awake; with the wheels stopped it goes to sleep', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    // the chassis rests on two beams under its belly and the wheels hang over a pit: nothing under them
    world.createBody({ shape: { kind: 'box', half: [3, 0.1, 3] }, motion: 'static', position: [0, -3, 0], user: -1 })
    for (const z of [-1, 1]) world.createBody({ shape: { kind: 'box', half: [1.2, 0.2, 0.15] }, motion: 'static', position: [0, 0.4, z], user: -1 })
    const id = car(world, [0, 0.9, 0])
    const body = world.vehicleBody(id)
    for (let i = 0; i < 120 * 2; i++) {
      world.driveVehicle(id, { ...none, forward: 1 })
      world.step(STEP)
    }
    const spinning = spins(world, id)
    // the throttle off: the engine no longer pushes; the wheels coast down by their own damping and the brakes are not touched
    let awakeWhileSpinning = true
    let steps = 0
    for (; steps < 120 * 3; steps++) {
      world.driveVehicle(id, none)
      world.step(STEP)
      if (spins(world, id) >= 0.5 && world.isSleeping(body)) awakeWhileSpinning = false
    }
    const spinAfter = spins(world, id)
    report('t6.3-air', { spinning, spinAfter, awakeWhileSpinning, asleep: world.isSleeping(body) })
    expect(spinning).toBeGreaterThan(5)
    expect(spinAfter).toBeGreaterThanOrEqual(0.5)
    expect(awakeWhileSpinning).toBe(true)
    expect(world.isSleeping(body)).toBe(false)
    // the handbrake and the brakes stop them, and then it sleeps
    let stopped = 0
    while (spins(world, id) >= 0.5 && stopped < 120 * 20) {
      world.driveVehicle(id, { ...none, brake: 1, handBrake: 1 })
      world.step(STEP)
      stopped++
    }
    let toSleep = 0
    while (!world.isSleeping(body) && toSleep < 120 * 5) {
      world.driveVehicle(id, none)
      world.step(STEP)
      toSleep++
    }
    report('t6.3-air-stopped', { stoppedAfterS: stopped * STEP, asleepAfterS: toSleep * STEP })
    expect(world.isSleeping(body)).toBe(true)
    world.dispose()
  })
})

const speedOfBody = (world: PhysicsWorld, body: ReturnType<PhysicsWorld['vehicleBody']>, vel: Float64Array): number => {
  world.readVelocity(body, vel, 0)
  return Math.hypot(vel[0]!, vel[1]!, vel[2]!)
}
