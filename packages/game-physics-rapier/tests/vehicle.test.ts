import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@adatechnology/game-physics'
import type { RapierWorld } from '../src/index'
import { fmt, loadEngine, stats } from './engines'

/** game-vehicles-fleet `midsize_sedan`: 1380 kg, 4.63 x 1.78 x 1.455 m, wheelbase 2.70 (wheels at +1.3 / -1.4), track 1.531, wheel r 0.323, clearance 0.148; centre of mass 0.5 m up (game-vehicles-driving semi spec). */
const SEDAN = { mass: 1380, length: 4.63, width: 1.78, height: 1.455, front: 1.3, rear: -1.4, track: 1.531, wheelRadius: 0.323, clearance: 0.148, comHeight: 0.5 }
const REST = 0.25


interface Car {
  readonly body: number
  readonly controller: ReturnType<RapierWorld['world']['createVehicleController']>
}

const makeCar = (w: RapierWorld, at: Vec3, speed: number): Car => {
  const s = SEDAN
  const low = s.clearance - s.comHeight
  const body = w.createBody({
    kind: 'dynamic',
    position: [at[0], at[1] + s.comHeight, at[2]],
    velocity: [speed, 0, 0],
    mass: s.mass,
    // box inertia of the whole car: roll about x (forward), yaw about y, pitch about z
    inertia: [(s.mass * (s.height ** 2 + s.width ** 2)) / 12, (s.mass * (s.length ** 2 + s.width ** 2)) / 12, (s.mass * (s.length ** 2 + s.height ** 2)) / 12],
    ccd: true,
    colliders: [
      { shape: { kind: 'box', half: [s.length / 2, 0.32, s.width / 2] }, offset: [0, low + 0.32, 0], tag: 10, surface: { friction: { static: 0.5, dynamic: 0.4 }, restitution: 0.1 } },
      { shape: { kind: 'box', half: [1.2, 0.27, s.width / 2 - 0.12] }, offset: [-0.2, low + 0.64 + 0.27, 0], tag: 11, surface: { friction: { static: 0.5, dynamic: 0.4 }, restitution: 0.1 } },
    ],
  })
  const rb = w.world.getRigidBody(body)
  const controller = w.world.createVehicleController(rb)
  for (const x of [s.front, s.rear]) {
    for (const z of [s.track / 2, -s.track / 2]) {
      controller.addWheel({ x, y: s.wheelRadius - s.comHeight + REST, z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 }, REST, s.wheelRadius)
      const i = controller.numWheels() - 1
      controller.setWheelSuspensionStiffness(i, 30)
      controller.setWheelSuspensionCompression(i, 4.4)
      controller.setWheelSuspensionRelaxation(i, 2.3)
      controller.setWheelFrictionSlip(i, 1.2)
      controller.setWheelMaxSuspensionTravel(i, 0.2)
      controller.setWheelMaxSuspensionForce(i, 60000)
    }
  }
  return { body, controller }
}

const roll = (p: Float64Array): number => {
  // the car's up (local y) against the world's
  const x = p[3], z = p[5]
  const upY = 1 - 2 * (x * x + z * z)
  return Math.acos(Math.max(-1, Math.min(1, upY)))
}

const drive = (w: RapierWorld, cars: readonly Car[], seconds: number, onFrame?: (f: number) => void): { ms: number[] } => {
  const ms: number[] = []
  const dt = 1 / 60
  for (let f = 0; f < seconds * 60; f++) {
    const t0 = performance.now()
    for (const c of cars) {
      for (let i = 0; i < 4; i++) c.controller.setWheelEngineForce(i, i >= 2 && f < 120 ? 1200 : 0)
      c.controller.updateVehicle(dt)
    }
    w.step(dt)
    ms.push(performance.now() - t0)
    onFrame?.(f)
  }
  return { ms }
}

describe('case 3: a car of the fleet on Rapier raycast wheels', () => {
  for (const scene of ['curb 0.30 m', 'ramp under the left wheels', 'steep ramp under the left wheels']) {
    it(`60 km/h into a ${scene}`, async () => {
      const { engine } = await loadEngine()
      const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 }) as RapierWorld
      w.createBody({ kind: 'fixed', position: [100, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [200, 0.5, 50] }, tag: 1, surface: { friction: { static: 0.9, dynamic: 0.8 }, restitution: 0 } }] })
      if (scene.startsWith('curb')) w.createBody({ kind: 'fixed', position: [30.15, 0.15, 0], colliders: [{ shape: { kind: 'box', half: [0.15, 0.15, 10] }, tag: 2 }] })
      else {
        // a wedge 0.9 m high over 3 m under the left track only
        const rise = scene.startsWith('steep') ? 1.6 : 0.9
        const a = Math.atan2(rise, 3)
        w.createBody({ kind: 'fixed', position: [30, rise / 2, 0.75], rotation: [0, 0, Math.sin(a / 2), Math.cos(a / 2)], colliders: [{ shape: { kind: 'box', half: [Math.hypot(3, rise) / 2, 0.01, 0.6] }, offset: [0, 0, 0], tag: 2 }] })
      }
      const car = makeCar(w, [0, 0, 0], 60 / 3.6)
      const p = new Float64Array(7)
      const v = new Float64Array(6)
      let maxRoll = 0
      let maxSpin = 0
      let asleepAt = -1
      let sag = 0
      const { ms } = drive(w, [car], 14, (f) => {
        w.readPose(car.body, p)
        w.readVelocity(car.body, v)
        if (f === 60) sag = p[1] - SEDAN.comHeight
        maxRoll = Math.max(maxRoll, roll(p))
        maxSpin = Math.max(maxSpin, Math.hypot(v[3], v[4], v[5]))
        if (w.isSleeping(car.body) && asleepAt < 0) asleepAt = f / 60
        if (!Number.isFinite(p[1])) throw new Error('NaN pose')
      })
      w.readPose(car.body, p)
      const s = stats(ms)
      console.log(
        `vehicle ${scene}: sag at 1 s ${fmt(sag * 100, 1)} cm; max roll ${fmt((maxRoll * 180) / Math.PI, 0)} deg; final roll ${fmt((roll(p) * 180) / Math.PI, 0)} deg at x ${fmt(p[0], 1)}; max spin ${fmt(maxSpin, 2)} rad/s; asleep at ${asleepAt} s; step median ${fmt(s.median)} ms p90 ${fmt(s.p90)}`,
      )
      expect(Number.isFinite(p[0])).toBe(true)
    }, 60000)
  }

  it('costs: 10 cars driving, then parked', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 }) as RapierWorld
    w.createBody({ kind: 'fixed', position: [100, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [200, 0.5, 50] }, tag: 1 }] })
    const cars = Array.from({ length: 10 }, (_, i) => makeCar(w, [0, 0, i * 3 - 15], 8))
    const { ms } = drive(w, cars, 6)
    const moving = stats(ms.slice(30, 180))
    const parked = stats(ms.slice(300))
    console.log(`vehicle x10: driving median ${fmt(moving.median)} ms p90 ${fmt(moving.p90)}; after stopping median ${fmt(parked.median)} ms`)
  }, 60000)
})
