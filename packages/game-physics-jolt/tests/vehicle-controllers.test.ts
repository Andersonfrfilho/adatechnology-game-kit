import { describe, expect, it } from 'vitest'

import { WHEEL_READ, WHEEL_READ_STRIDE } from '@adatechnology/game-physics'
import type { PhysicsWorld, Quat, Vec3, VehicleDesc, WheelDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { eulerXYZ, ground, report } from './scenes'

const STEP = 1 / 120

const carWheels = (patch: Partial<WheelDesc> = {}): WheelDesc[] =>
  [[0.7, 1.4], [-0.7, 1.4], [0.7, -1.4], [-0.7, -1.4]].map(([x, z], i) => ({
    position: [x!, -0.3, z!] as Vec3, radius: 0.3, width: 0.2, suspensionMin: 0.05, suspensionMax: 0.25, frequency: 1.5, damping: 0.5,
    maxSteer: i < 2 ? 0.6 : 0, driven: i < 2, maxBrakeTorque: 1500, maxHandBrakeTorque: i < 2 ? 0 : 4000, ...patch,
  }))

const car = (patch: Partial<VehicleDesc> = {}, wheelPatch: Partial<WheelDesc> = {}, chassis: Partial<VehicleDesc['chassis']> = {}): VehicleDesc => ({
  chassis: { shape: { kind: 'box', half: [0.8, 0.3, 2] }, motion: 'dynamic', position: [0, 0.75, 0], mass: 1200, user: 2, ...chassis },
  wheels: carWheels(wheelPatch),
  maxTorque: 300, minRpm: 1000, maxRpm: 6000, gears: [3.5, 2.0, 1.4], reverseGears: [-3.3], differentialRatio: 4.2, antiRoll: 1000,
  ...patch,
})

/** The yaw turned so far, unwrapped: call it once a step (a turn of more than half a circle between two readings is the wrap of `atan2`, not a turn). */
const turnTracker = (world: PhysicsWorld, body: ReturnType<PhysicsWorld['vehicleBody']>): (() => number) => {
  let previous = yawOf(poseOf(world, body).q)
  let total = 0
  return () => {
    const now = yawOf(poseOf(world, body).q)
    let delta = now - previous
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    total += delta
    previous = now
    return total
  }
}

const yawOf = (q: Quat): number => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0]))

type Pose = { x: number; y: number; z: number; q: Quat }
const poseOf = (world: PhysicsWorld, id: ReturnType<PhysicsWorld['vehicleBody']>): Pose => {
  const out = new Float64Array(7)
  world.readPose(id, out, 0)
  return { x: out[0]!, y: out[1]!, z: out[2]!, q: [out[3]!, out[4]!, out[5]!, out[6]!] }
}
const speedOf = (world: PhysicsWorld, id: ReturnType<PhysicsWorld['vehicleBody']>): number => {
  const v = new Float64Array(6)
  world.readVelocity(id, v, 0)
  return Math.hypot(v[0]!, v[1]!, v[2]!)
}

const fresh = async (): Promise<PhysicsWorld> => {
  const world = (await createJoltEngine()).createWorld({ fixedStep: STEP })
  ground(world, 300)
  return world
}

const run = (world: PhysicsWorld, steps: number, each?: (i: number) => void): void => {
  for (let i = 0; i < steps; i++) {
    each?.(i)
    world.step(STEP)
  }
}

/** Distance covered in `seconds` at full throttle from rest. */
const launch = async (desc: VehicleDesc, seconds: number): Promise<{ distance: number; speed: number }> => {
  const world = await fresh()
  const id = world.createVehicle(desc)
  const body = world.vehicleBody(id)
  run(world, 60)
  const start = poseOf(world, body)
  run(world, seconds * 120, () => world.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 }))
  const end = poseOf(world, body)
  const out = { distance: Math.hypot(end.x - start.x, end.z - start.z), speed: speedOf(world, body) }
  world.dispose()
  return out
}

const ALL_FOUR = [{ left: 0, right: 1 }, { left: 2, right: 3 }] as const

const flat = (value: number): ReadonlyArray<readonly [number, number]> => [[0, value], [0.5, value], [1, value]]

describe('T6.1b part 2: the curves of the engine and of the tyre', () => {
  it('the torque curve scales the push: a curve at half gives clearly less than the full one', async () => {
    const full = await launch(car({ maxTorque: 100, torqueCurve: flat(1) }), 3)
    const half = await launch(car({ maxTorque: 100, torqueCurve: flat(0.5) }), 3)
    report('t6.1b-torque-curve', { full, half })
    expect(full.distance).toBeGreaterThan(3)
    expect(half.distance / full.distance).toBeGreaterThan(0.4)
    expect(half.distance / full.distance).toBeLessThan(0.8)
  })

  it('what the curve adds above the idle creep (the engine held at its minimum rpm pulls the car at about 2 m/s) is in proportion to it', async () => {
    const full = await launch(car({ maxTorque: 100, torqueCurve: flat(1) }), 3)
    const half = await launch(car({ maxTorque: 100, torqueCurve: flat(0.5) }), 3)
    const none = await launch(car({ maxTorque: 100, torqueCurve: flat(0) }), 3)
    const share = (half.speed - none.speed) / (full.speed - none.speed)
    report('t6.1b-torque-curve-share', { full: full.speed, half: half.speed, none: none.speed, share })
    expect(none.speed).toBeLessThan(2.6)
    expect(share).toBeGreaterThan(0.3)
    expect(share).toBeLessThan(0.7)
  })

  it('a longitudinal grip curve that gives little lets the wheels spin: slower, and the slip is read', async () => {
    const grippy = await launch(car({}, { longitudinalFriction: [[0, 0], [0.06, 1.2], [1, 1.0]] }), 3)
    const icy = await launch(car({}, { longitudinalFriction: [[0, 0], [0.06, 0.1], [1, 0.08]] }), 3)
    report('t6.1b-longitudinal-grip', { grippy, icy })
    expect(icy.distance).toBeLessThan(grippy.distance * 0.5)
  })

  it('a lateral grip curve that gives little lets the car slide in a turn: it keeps going straighter', async () => {
    const turn = async (lateral: ReadonlyArray<readonly [number, number]>): Promise<number> => {
      const world = await fresh()
      const id = world.createVehicle(car({}, { lateralFriction: lateral }, { linearVelocity: [0, 0, 15] }))
      const body = world.vehicleBody(id)
      const turned = turnTracker(world, body)
      run(world, 360, () => {
        world.driveVehicle(id, { forward: 0, right: 0.5, brake: 0, handBrake: 0 })
        turned()
      })
      const yaw = Math.abs(turned())
      world.dispose()
      return yaw
    }
    const gripped = await turn([[0, 0], [3, 1.2], [20, 1.0], [90, 0.9]])
    const slippery = await turn([[0, 0], [3, 0.15], [20, 0.1], [90, 0.1]])
    report('t6.1b-lateral-grip', { grippedYaw: gripped, slipperyYaw: slippery })
    expect(gripped).toBeGreaterThan(slippery * 1.5)
  })

  it('the gearbox timing: shifting up early (1 400 rpm) gives a slower launch than shifting at the top of the range (a launch that does not spin the wheels: Jolt does not shift up while they slip)', async () => {
    const late = await launch(car({ maxTorque: 100, differentials: ALL_FOUR, transmission: { shiftUpRpm: 5500, shiftDownRpm: 2500 } }), 2.5)
    const early = await launch(car({ maxTorque: 100, differentials: ALL_FOUR, transmission: { shiftUpRpm: 1400, shiftDownRpm: 1100 } }), 2.5)
    report('t6.1b-transmission', { late, early })
    expect(early.distance).toBeLessThan(late.distance)
  })
})

describe('T6.1b part 2: the differentials', () => {
  it('one listed on the rear axle drives the rear wheels (the drive impulse is theirs), whatever `driven` says', async () => {
    const world = await fresh()
    const id = world.createVehicle(car({ differentials: [{ left: 2, right: 3, limitedSlip: 1.4 }] }))
    run(world, 60)
    const out = new Float64Array(WHEEL_READ_STRIDE * 4)
    let rear = 0
    let front = 0
    run(world, 120, () => {
      world.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      world.vehicleWheels(id, out)
      front += Math.abs(out[WHEEL_READ.LONGITUDINAL_IMPULSE]!) + Math.abs(out[WHEEL_READ_STRIDE + WHEEL_READ.LONGITUDINAL_IMPULSE]!)
      rear += Math.abs(out[2 * WHEEL_READ_STRIDE + WHEEL_READ.LONGITUDINAL_IMPULSE]!) + Math.abs(out[3 * WHEEL_READ_STRIDE + WHEEL_READ.LONGITUDINAL_IMPULSE]!)
    })
    report('t6.1b-differential', { rear, front })
    expect(rear).toBeGreaterThan(front * 2)
    world.dispose()
  })

  it('two differentials with their torque shares drive all four wheels', async () => {
    const world = await fresh()
    const id = world.createVehicle(car({ differentials: [{ left: 0, right: 1, torqueShare: 0.5 }, { left: 2, right: 3, torqueShare: 0.5 }] }))
    run(world, 60)
    const out = new Float64Array(WHEEL_READ_STRIDE * 4)
    const spent = [0, 0, 0, 0]
    run(world, 120, () => {
      world.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      world.vehicleWheels(id, out)
      for (let i = 0; i < 4; i++) spent[i] = spent[i]! + Math.abs(out[i * WHEEL_READ_STRIDE + WHEEL_READ.LONGITUDINAL_IMPULSE]!)
    })
    report('t6.1b-four-wheel-drive', { spent })
    for (const impulse of spent) expect(impulse).toBeGreaterThan(0)
    world.dispose()
  })
})

describe('T6.1b part 2: a car made already moving (the correction of 3.4)', () => {
  it('made at 60 km/h turned 37 degrees it rolls straight along its own front for 2 s without losing 1 km/h', async () => {
    const world = await fresh()
    const kmh60 = 60 / 3.6
    const heading = 37 * (Math.PI / 180)
    const rotation: Quat = eulerXYZ(0, heading, 0)
    const forward: Vec3 = [Math.sin(heading), 0, Math.cos(heading)]
    const id = world.createVehicle(car({ gears: [3.5, 2.0, 1.4, 1.0] }, {}, { rotation, linearVelocity: [forward[0] * kmh60, 0, forward[2] * kmh60] }))
    const body = world.vehicleBody(id)
    run(world, 30)
    const start = poseOf(world, body)
    const v0 = speedOf(world, body)
    let sideways = 0
    const v = new Float64Array(6)
    // 0.4 of the throttle holds 60 km/h in the top gear (at zero the engine's own braking takes about 7 km/h in 2 s, rotated or not)
    run(world, 240, () => {
      world.driveVehicle(id, { forward: 0.4, right: 0, brake: 0, handBrake: 0 })
      world.readVelocity(body, v, 0)
      const across = v[0]! * forward[2] - v[2]! * forward[0]
      sideways = Math.max(sideways, Math.abs(across))
    })
    const end = poseOf(world, body)
    const lostKmh = (v0 - speedOf(world, body)) * 3.6
    const drift = Math.abs(yawOf(end.q) - yawOf(start.q))
    report('t6.1b-created-moving', { lostKmh, sidewaysMs: sideways, yawDrift: drift })
    expect(lostKmh).toBeLessThan(1)
    expect(sideways).toBeLessThan(0.5)
    expect(drift).toBeLessThan(0.05)
    world.dispose()
  })
})

/** The engine's own lean spring (5 000 and 1 000) is for a bike with a real bike's inertia: this box's roll inertia is 7.5 kg m^2, and it throws the bike over. */
const LEAN = { leanSpring: 3000, leanDamping: 300 } as const

const bike = (patch: Partial<VehicleDesc> = {}): VehicleDesc => ({
  chassis: { shape: { kind: 'box', half: [0.15, 0.3, 0.8] }, motion: 'dynamic', position: [0, 0.75, 0], mass: 200, user: 3 },
  wheels: [0.7, -0.7].map((z) => ({
    position: [0, 0.1, z] as Vec3, radius: 0.3, width: 0.12, suspensionMin: 0.1, suspensionMax: 0.3, frequency: 2, damping: 0.5,
    maxSteer: z > 0 ? 0.5 : 0, driven: z < 0, maxBrakeTorque: 500, maxHandBrakeTorque: 0,
  })),
  maxTorque: 200, minRpm: 1000, maxRpm: 6000, gears: [3, 2, 1.4], reverseGears: [-3], differentialRatio: 3,
  ...patch,
})

/** The roll of the chassis about its own front (rad, positive to the left of the rider), from its rotation. */
const rollOf = (q: Quat): number => Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[2] * q[2] + q[0] * q[0]))

describe('T6.1b part 2: the motorcycle controller', () => {
  it('rides in a line upright at 15 m/s, and a steer to the right turns it right and leans it into the turn', async () => {
    const world = await fresh()
    const id = world.createVehicle(bike({ controller: 'motorcycle', motorcycle: LEAN }))
    const body = world.vehicleBody(id)
    run(world, 60)
    run(world, 480, () => world.driveVehicle(id, { forward: speedOf(world, body) < 15 ? 1 : 0.1, right: 0, brake: 0, handBrake: 0 }))
    const uprightRoll = Math.abs(rollOf(poseOf(world, body).q))
    const turned = turnTracker(world, body)
    let maxLean = 0
    run(world, 360, () => {
      world.driveVehicle(id, { forward: speedOf(world, body) < 15 ? 1 : 0.1, right: 0.5, brake: 0, handBrake: 0 })
      maxLean = Math.max(maxLean, Math.abs(rollOf(poseOf(world, body).q)))
      turned()
    })
    // forward is +z and up is +y: a right turn is a negative yaw
    const yawChange = turned()
    report('t6.1b-motorcycle', { uprightRoll, maxLean, yawChange, speed: speedOf(world, body), y: poseOf(world, body).y })
    expect(uprightRoll).toBeLessThan(0.1)
    expect(yawChange).toBeLessThan(-0.3)
    expect(maxLean).toBeGreaterThan(0.08)
    expect(maxLean).toBeLessThan(1.2)
    expect(poseOf(world, body).y).toBeGreaterThan(0.3)
    world.dispose()
  })

  it('its lean limit is the description\'s: a smaller `maxLeanAngle` leans less in the same turn', async () => {
    const lean = async (maxLeanAngle: number): Promise<number> => {
      const world = await fresh()
      const id = world.createVehicle(bike({ controller: 'motorcycle', motorcycle: { ...LEAN, maxLeanAngle } }))
      const body = world.vehicleBody(id)
      run(world, 60)
      run(world, 480, () => world.driveVehicle(id, { forward: speedOf(world, body) < 15 ? 1 : 0.1, right: 0, brake: 0, handBrake: 0 }))
      let max = 0
      run(world, 240, () => {
        world.driveVehicle(id, { forward: speedOf(world, body) < 15 ? 1 : 0.1, right: 0.5, brake: 0, handBrake: 0 })
        max = Math.max(max, Math.abs(rollOf(poseOf(world, body).q)))
      })
      world.dispose()
      return max
    }
    const wide = await lean(0.9)
    const narrow = await lean(0.2)
    report('t6.1b-lean-limit', { wide, narrow })
    expect(narrow).toBeLessThan(wide)
  })
})

const tank = (patch: Partial<VehicleDesc> = {}): VehicleDesc => {
  const wheels: WheelDesc[] = [1, -1].flatMap((side) =>
    [1.2, 0.4, -0.4, -1.2].map((z) => ({
      position: [side * 1.2, -0.3, z] as Vec3, radius: 0.35, width: 0.5, suspensionMin: 0.05, suspensionMax: 0.3, frequency: 1.2, damping: 0.6,
      maxSteer: 0, driven: false, maxBrakeTorque: 3000, maxHandBrakeTorque: 0,
    })),
  )
  return {
    chassis: { shape: { kind: 'box', half: [1.1, 0.4, 2] }, motion: 'dynamic', position: [0, 0.9, 0], mass: 8000, user: 4 },
    wheels, controller: 'tracked',
    // wheels 0-3 are the left track (x > 0: the vehicle's left, with forward +z and up +y), 4-7 the right
    tracks: [{ wheels: [0, 1, 2, 3], drivenWheel: 3, longitudinalFriction: 1.2, lateralFriction: 1.2, maxBrakeTorque: 3000 }, { wheels: [4, 5, 6, 7], drivenWheel: 7, longitudinalFriction: 1.2, lateralFriction: 1.2, maxBrakeTorque: 3000 }],
    // the adapter shares the engine's torque between the two tracks: 2500 N m each
    maxTorque: 5000, minRpm: 1000, maxRpm: 4000, gears: [4, 2.5, 1.5], reverseGears: [-4], differentialRatio: 6,
    ...patch,
  }
}

describe('T6.1b part 2: the tracked controller', () => {
  it('drives straight ahead on forward, and the steer turns it: right turns the yaw down (to -x), left up', async () => {
    const world = await fresh()
    const id = world.createVehicle(tank())
    const body = world.vehicleBody(id)
    run(world, 120)
    const turned = turnTracker(world, body)
    const start = poseOf(world, body)
    run(world, 480, () => {
      world.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      turned()
    })
    const straight = turned()
    const ahead = poseOf(world, body)
    run(world, 360, () => {
      world.driveVehicle(id, { forward: 1, right: 0.6, brake: 0, handBrake: 0 })
      turned()
    })
    const right = turned() - straight
    run(world, 360, () => {
      world.driveVehicle(id, { forward: 1, right: -0.6, brake: 0, handBrake: 0 })
      turned()
    })
    const left = turned() - straight - right
    report('t6.1b-tracked', { travelled: ahead.z - start.z, straightTurn: straight, rightTurn: right, leftTurn: left })
    expect(ahead.z - start.z).toBeGreaterThan(2)
    expect(Math.abs(straight)).toBeLessThan(0.05)
    expect(right).toBeLessThan(-0.5)
    expect(left).toBeGreaterThan(0.5)
    expect(world.wheelContacts(id)).toBe(8)
    world.dispose()
  })

  it('pivots on the spot with no forward input: right turns it right, and it stays within 2 m of where it was', async () => {
    const world = await fresh()
    const id = world.createVehicle(tank())
    const body = world.vehicleBody(id)
    run(world, 120)
    const turned = turnTracker(world, body)
    const start = poseOf(world, body)
    run(world, 480, () => {
      world.driveVehicle(id, { forward: 0, right: 1, brake: 0, handBrake: 0 })
      turned()
    })
    const end = poseOf(world, body)
    const moved = Math.hypot(end.x - start.x, end.z - start.z)
    report('t6.1b-tracked-pivot', { turned: turned(), moved })
    expect(turned()).toBeLessThan(-1)
    expect(moved).toBeLessThan(2)
    world.dispose()
  })

  it('refuses a tracked vehicle with no tracks', async () => {
    const world = await fresh()
    expect(() => world.createVehicle(tank({ tracks: undefined }))).toThrow(/tracks/)
    world.dispose()
  })
})

describe('T6.1b part 2: applyBuoyancy', () => {
  const water = { surface: [0, 0, 0] as Vec3, normal: [0, 1, 0] as Vec3, buoyancy: 1.1, linearDrag: 0.5, angularDrag: 0.5 }
  const barge = { shape: { kind: 'box', half: [1, 0.25, 2] } as const, motion: 'dynamic' as const, mass: 500, user: 5 }

  it('a body denser than the water\'s share sinks to a rest at the surface: it floats with part of it out, and returns false in the air', async () => {
    const world = (await createJoltEngine()).createWorld({ fixedStep: STEP })
    // 2 x 0.5 x 4 m: 4 m3, so 500 kg is a eighth of the water's density: it rides high
    const id = world.createBody({ ...barge, position: [0, -2, 0] })
    let wasInAir = false
    for (let i = 0; i < 600; i++) {
      world.applyBuoyancy(id, water)
      world.step(STEP)
    }
    const out = new Float64Array(7)
    world.readPose(id, out, 0)
    const floatY = out[1]!
    const sunk = speedOf(world, id)
    const high = world.createBody({ ...barge, position: [20, 10, 0] })
    wasInAir = world.applyBuoyancy(high, water)
    report('t6.1b-buoyancy', { floatY, restSpeed: sunk, inAir: wasInAir })
    expect(floatY).toBeGreaterThan(-0.25)
    expect(floatY).toBeLessThan(0.3)
    expect(sunk).toBeLessThan(0.3)
    expect(wasInAir).toBe(false)
    world.dispose()
  })

  it('a flow pushes a floating body along it', async () => {
    const world = (await createJoltEngine()).createWorld({ fixedStep: STEP })
    const id = world.createBody({ ...barge, position: [0, 0, 0] })
    for (let i = 0; i < 480; i++) {
      world.applyBuoyancy(id, { ...water, flow: [2, 0, 0] })
      world.step(STEP)
    }
    const out = new Float64Array(7)
    world.readPose(id, out, 0)
    report('t6.1b-flow', { x: out[0] })
    expect(out[0]).toBeGreaterThan(1)
    world.dispose()
  })
})
