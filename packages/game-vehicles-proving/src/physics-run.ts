import type { BodyId, PhysicsWorld, VehicleId } from '@adatechnology/game-physics'
import { createPhysicsInputMapper, createSurfaces, resistanceImpulse, surfaceGrip, vehicleDescFromSemi } from '@adatechnology/game-vehicles-driving'
import type { SemiInput, SemiSimSpec, SemiState, Surface, SurfaceRegistry } from '@adatechnology/game-vehicles-driving'

import { resultOf, subjectSpec } from './run'
import type { ProvingMemo, ProvingResult, ProvingSubject, ProvingTest } from './types'

/** The ground is a slab this big (half the side, m): the longest run (top speed, 150 s) covers about 8 km. */
const GROUND_HALF = 20000
/** Chassis box around the spec's wheels: this much beyond the outermost wheels in x, and half the height of the box above and below the centre of mass. */
const CHASSIS_MARGIN_SIDE = 0.1
const CHASSIS_MARGIN_END = 0.6
const CHASSIS_HALF_HEIGHT = 0.35

export interface PhysicsRunOptions {
  /** A world made for this run (an empty `PhysicsWorld` of the engine under test, 120 Hz): the run puts the ground and the vehicle in it and disposes it at the end. */
  readonly createWorld: () => PhysicsWorld
  readonly surfaces?: SurfaceRegistry
  /** Seconds between two trace samples (default 0.1). */
  readonly sampleEvery?: number
  /** Fixed step of the simulation (default 1/120 s): the world's own. */
  readonly fixedStep?: number
}

/** A measured test in progress on the physics engine: the same procedures as `ProvingRun`, driven through the vehicle the engine simulates. */
export interface PhysicsProvingRun {
  readonly test: ProvingTest
  readonly subject: ProvingSubject
  readonly surface: string
  readonly time: number
  readonly done: boolean
  readonly trace: ReadonlyArray<[number, number]>
  readonly memo: ProvingMemo
  readonly input: SemiInput
  readonly fixedStep: number
  /**
   * What the procedures read, from the body: x and z are the metres along the run and across it, `u` the speed along the front, `yawRate` positive to the left, `yaw`
   * the heading, `height`, `pitch` and `roll` from the pose. The engine and gearbox have no reading in the contract: `rpm` and `gear` stay 0.
   */
  readonly state: SemiState
  stepFixed(steps: number): void
  result(): ProvingResult
  /** Lets go of the world; `runTestOnPhysics` calls it. */
  dispose(): void
}

const chassisOf = (spec: SemiSimSpec): { half: readonly [number, number, number] } => {
  const xs = spec.wheels.map((wheel) => wheel.x)
  const zs = spec.wheels.map((wheel) => Math.abs(wheel.z))
  return { half: [Math.max(...zs) + CHASSIS_MARGIN_SIDE, CHASSIS_HALF_HEIGHT, (Math.max(...xs) - Math.min(...xs)) / 2 + CHASSIS_MARGIN_END] }
}

const emptyState = (spec: SemiSimSpec): SemiState => ({
  x: 0, z: 0, yaw: 0, u: 0, w: 0, yawRate: 0, height: spec.centreHeight, heightRate: 0, pitch: 0, pitchRate: 0, roll: 0, rollRate: 0, rpm: 0, gear: 0,
  engineOn: true, bogged: false, fuel: spec.tank.capacity, loads: spec.wheels.map(() => 0), slip: spec.wheels.map(() => 0), steerAngle: 0,
})

/** Puts the ground of the run's surface in the world: a slab whose friction is the surface's grip (the wheels' own grip curves multiply it). */
const makeGround = (world: PhysicsWorld, grip: number): BodyId =>
  world.createBody({
    shape: { kind: 'box', half: [GROUND_HALF, 0.5, GROUND_HALF] }, motion: 'static', position: [0, -0.5, 0], user: -1,
    material: { frictionStatic: grip, frictionDynamic: grip, restitution: 0 },
  })

export function startPhysicsRun(test: ProvingTest, subject: ProvingSubject, options: PhysicsRunOptions): PhysicsProvingRun {
  const procedure = test.procedure
  if (test.kind !== 'measured' || !procedure) throw new Error(`startPhysicsRun: ${test.id} is not a measured test`)
  const spec = subjectSpec(subject)
  const surfaces = options.surfaces ?? createSurfaces()
  const surfaceId = procedure.surface ?? 'dry_asphalt'
  const surface: Surface = surfaces.get(surfaceId)
  const world = options.createWorld()
  const ground = makeGround(world, surface.grip)
  const half = chassisOf(spec).half
  const desc = vehicleDescFromSemi(spec, { chassis: { shape: { kind: 'box', half }, position: [0, spec.centreHeight + 0.05, 0], user: 1 } })
  const vehicle: VehicleId = world.createVehicle(desc)
  const body = world.vehicleBody(vehicle)
  const mapper = createPhysicsInputMapper()
  const memo: ProvingMemo = { target: procedure.target?.(subject) ?? 0, subject }
  const trace: Array<[number, number]> = []
  const state = emptyState(spec)
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  const fixed = options.fixedStep ?? 1 / 120
  const sampleEvery = options.sampleEvery ?? 0.1
  let time = 0
  let nextSample = 0
  let done = false
  let last: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
  let groundGrip = surface.grip

  const readState = (): void => {
    world.readPose(body, pose, 0)
    world.readVelocity(body, velocity, 0)
    const [qx, qy, qz, qw] = [pose[3]!, pose[4]!, pose[5]!, pose[6]!]
    // the chassis' front is its local z: the speed along it, and the heading of that axis
    const forward: readonly [number, number, number] = [2 * (qx * qz + qw * qy), 2 * (qy * qz - qw * qx), 1 - 2 * (qx * qx + qy * qy)]
    state.u = velocity[0]! * forward[0] + velocity[1]! * forward[1] + velocity[2]! * forward[2]
    state.w = 0
    state.x = pose[2]!
    state.z = pose[0]!
    state.yaw = Math.atan2(forward[0], forward[2])
    state.yawRate = velocity[4]!
    state.height = pose[1]!
    state.pitch = Math.asin(Math.max(-1, Math.min(1, forward[1])))
    // the chassis' left (local x) pointing up is the right side down
    state.roll = Math.asin(Math.max(-1, Math.min(1, 2 * (qx * qy + qw * qz))))
  }

  const tick = (h: number): void => {
    const input = procedure.input(state, time, memo)
    last = input
    // aquaplaning: the surface's grip falls with the speed
    const grip = surfaceGrip(surface, state.u)
    if (grip !== groundGrip) {
      groundGrip = grip
      world.setMaterial(ground, { frictionStatic: grip, frictionDynamic: grip, restitution: 0 })
    }
    world.driveVehicle(vehicle, mapper.map({ input, speed: state.u, dt: h }))
    const v: readonly [number, number, number] = [velocity[0]!, velocity[1]!, velocity[2]!]
    world.addImpulse(body, resistanceImpulse(spec, v, h))
    // a vehicle without four-wheel drive sinks in a surface that bogs it while it tries to move: the spec's bog resistance in place of the tyres' rolling resistance
    if (surface.bogs && !spec.fourWheelDrive && input.throttle > 0) {
      const extra = resistanceImpulse({ drag: 0, rolling: spec.bogResistance - spec.rolling, mass: spec.mass }, v, h)
      world.addImpulse(body, extra)
    }
    world.step(h)
    readState()
    time += h
    if (time >= nextSample) {
      trace.push([Math.round(time * 1000) / 1000, procedure.sample(state, time, memo)])
      nextSample += sampleEvery
    }
    if (procedure.finished(state, time, memo) || time >= procedure.maxSeconds) done = true
  }
  readState()
  return {
    test, subject, surface: surfaceId, memo, state, fixedStep: fixed,
    get time() { return time },
    get done() { return done },
    get trace() { return trace },
    get input() { return last },
    stepFixed(steps) {
      for (let i = 0; i < steps && !done; i++) tick(fixed)
    },
    result: () => resultOf({ test, subject, memo, trace, done, state, time }),
    dispose: () => world.dispose(),
  }
}

/** Runs a measured test on the physics engine to its end and returns the result; the world is let go. */
export function runTestOnPhysics(test: ProvingTest, subject: ProvingSubject, options: PhysicsRunOptions): ProvingResult {
  const run = startPhysicsRun(test, subject, options)
  try {
    while (!run.done) run.stepFixed(1)
    return run.result()
  } finally {
    run.dispose()
  }
}
