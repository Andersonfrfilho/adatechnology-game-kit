import { describe, expect, it } from 'vitest'

import type { Material, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine, type JoltWorld } from '../src/index'

const G = 9.81
const SLOPE = (25 * Math.PI) / 180
/** Down the slope (the ramp falls toward +x). */
const DOWN: Vec3 = [Math.cos(SLOPE), -Math.sin(SLOPE), 0]

/**
 * A 25 degree ramp and a 20 cm box resting on it, both of `material`; the box's offset along the slope each step for `seconds`. The box may not sleep: at the
 * room's sleep speed (0.08 m/s over 0.5 s) Jolt puts a slide that starts from rest to sleep before it averages 0.16 m/s, and the friction is what is measured.
 */
const onRamp = async (material: Material, seconds: number, upSlope = 0, call = 1 / 120): Promise<{ along: number[]; world: PhysicsWorld; box: number; sliding: boolean[] }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
  const q: [number, number, number, number] = [0, 0, -Math.sin(SLOPE / 2), Math.cos(SLOPE / 2)]
  world.createBody({ shape: { kind: 'box', half: [3, 0.25, 1] }, motion: 'static', position: [0, 0, 0], rotation: q, material, user: 0 })
  // the box's centre 0.25 + 0.1 above the ramp's mid-plane, along the ramp's normal
  const normal: Vec3 = [Math.sin(SLOPE), Math.cos(SLOPE), 0]
  const at: Vec3 = [normal[0] * 0.351, normal[1] * 0.351, 0]
  const box = world.createBody({
    shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: at, rotation: q, material, user: 1, allowSleep: false,
    linearVelocity: [-DOWN[0] * upSlope, -DOWN[1] * upSlope, 0],
  })
  const pose = new Float64Array(7)
  const along: number[] = []
  const sliding: boolean[] = []
  const entry = (world as JoltWorld).bodies.get(box)!
  for (let i = 0; i < Math.round(seconds / call); i++) {
    world.step(call)
    world.readPose(box, pose, 0)
    along.push((pose[0] - at[0]) * DOWN[0] + (pose[1] - at[1]) * DOWN[1])
    sliding.push(entry.sliding)
  }
  return { along, world, box, sliding }
}

describe('Coulomb friction by body: static while it holds, dynamic while it slides (spec 008 D1.1)', () => {
  it('mu static 0.5 holds a box on 25 degrees (tan 25 = 0.47), though its dynamic 0.4 would not', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }, 1)
    expect(Math.abs(along.at(-1)!)).toBeLessThan(0.005)
    world.dispose()
  })

  it('mu 0.4 lets it slide g (sin 25 - 0.4 cos 25) t^2 / 2 = 0.295 m in 1 s', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.4, frictionDynamic: 0.4, restitution: 0 }, 1)
    const expected = 0.5 * G * (Math.sin(SLOPE) - 0.4 * Math.cos(SLOPE))
    expect(along.at(-1)!).toBeGreaterThan(expected - 0.05)
    expect(along.at(-1)!).toBeLessThan(expected + 0.05)
    world.dispose()
  })

  it('a box sent up the slope slides by its dynamic 0.4, stops, and then holds by its static 0.5', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }, 2, 1)
    // up the slope it slows by g (sin 25 + 0.4 cos 25): it stops 1 / (2 a) up
    const stop = -1 / (2 * G * (Math.sin(SLOPE) + 0.4 * Math.cos(SLOPE)))
    const highest = Math.min(...along)
    expect(highest).toBeGreaterThan(stop - 0.02)
    expect(highest).toBeLessThan(stop + 0.02)
    // back to sticking where it stopped: in the last second it does not come down (by its dynamic 0.4 it would, 0.3 m)
    expect(along.at(-1)! - along[120]!).toBeLessThan(0.01)
    world.dispose()
  })

  it('a box sliding up a fixed ramp of its own material at 3 m/s brakes by its dynamic 0.4 exactly: on one fixed material it holds mu_d1 mu_d2 / mu_s2', async () => {
    // against the same box with 0.4 for both coefficients (Jolt's own small bias cancels out), and apart from sqrt(0.4 x 0.5) = 0.447 (3 cm lower)
    const highest = async (material: Material): Promise<number> => {
      const { along, world } = await onRamp(material, 1.5, 3)
      world.dispose()
      return Math.min(...along)
    }
    const rule = await highest({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 })
    const dynamicOnly = await highest({ frictionStatic: 0.4, frictionDynamic: 0.4, restitution: 0 })
    const mixed = await highest({ frictionStatic: Math.sqrt(0.2), frictionDynamic: Math.sqrt(0.2), restitution: 0 })
    expect(Math.abs(rule - dynamicOnly)).toBeLessThan(0.003)
    expect(mixed - rule).toBeGreaterThan(0.02)
  })

  it('a solid cylinder rolls down 25 degrees without slipping: (2/3 g sin 25) t^2 / 2 = 0.35 m in 0.5 s', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepSpeed: 0.08 })
    const material: Material = { frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }
    const s = Math.sin(SLOPE / 2), c = Math.cos(SLOPE / 2), h = Math.SQRT1_2
    world.createBody({ shape: { kind: 'box', half: [3, 0.25, 1] }, motion: 'static', position: [0, 0, 0], rotation: [0, 0, -s, c], material, user: 0 })
    // the ramp's turn times a quarter turn about x: the cylinder's axis (y) across the slope (z)
    const q: [number, number, number, number] = [c * h, -s * h, -s * h, c * h]
    const normal: Vec3 = [Math.sin(SLOPE), Math.cos(SLOPE), 0]
    const at: Vec3 = [normal[0] * 0.286 - 1.5 * DOWN[0], normal[1] * 0.286 - 1.5 * DOWN[1], 0]
    const can = world.createBody({ shape: { kind: 'cylinder', radius: 0.035, halfHeight: 0.05 }, motion: 'dynamic', mass: 0.4, position: at, rotation: q, material, user: 1, allowSleep: false })
    const pose = new Float64Array(7)
    // half a second: 1.38 m/s at the end, under the 1.65 m/s where Jolt's spin cap (47 rad/s) stops a 3.5 cm can turning as fast as it moves
    for (let i = 0; i < 60; i++) world.step(1 / 120)
    world.readPose(can, pose, 0)
    const along = (pose[0] - at[0]) * DOWN[0] + (pose[1] - at[1]) * DOWN[1]
    const rolling = (G * Math.sin(SLOPE)) / 12
    expect(along).toBeGreaterThan(rolling * 0.95)
    expect(along).toBeLessThan(rolling * 1.05)
    world.dispose()
  })

  it('a sliding body goes back to sticking once it stops', async () => {
    const { sliding, world } = await onRamp({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }, 2, 1)
    expect(sliding[10]).toBe(true)
    expect(sliding.at(-1)).toBe(false)
    world.dispose()
  })

  it('a plank on a fixed block and on a block moving under it slides: one coefficient per body, dynamic once it slips on either', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepSpeed: 0.08 }) as JoltWorld
    const material: Material = { frictionStatic: 0.6, frictionDynamic: 0.4, restitution: 0 }
    world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.2] }, motion: 'static', position: [-0.5, 0.1, 0], material, user: 0 })
    const mover = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.2] }, motion: 'kinematic', layer: 'prop', position: [0.5, 0.1, 0], material, user: 1 })
    const plank = world.createBody({ shape: { kind: 'box', half: [0.7, 0.02, 0.1] }, motion: 'dynamic', mass: 2, position: [0, 0.221, 0], material, user: 2, allowSleep: false })
    for (let i = 0; i < 60; i++) world.step(1 / 120)
    expect(world.bodies.get(plank)!.sliding).toBe(false)
    for (let i = 0; i < 60; i++) {
      world.moveKinematic(mover, [0.5, 0.1, 0.5 * (i + 1) / 120], [0, 0, 0, 1], 1 / 120)
      world.step(1 / 120)
    }
    expect(world.bodies.get(plank)!.sliding).toBe(true)
    world.dispose()
  })

  it('a sensor is not touched: a spinning round body falling through one keeps its spin, and one inside a moving sensor neither touches nor slides', async () => {
    const engine = await createJoltEngine()
    const fall = (withSensor: boolean): number => {
      const world = engine.createWorld({ fixedStep: 1 / 120 })
      if (withSensor) world.createBody({ shape: { kind: 'sphere', radius: 2 }, motion: 'static', layer: 'sensor', position: [0, 10, 0], user: 9 })
      const ball = world.createBody({
        shape: { kind: 'sphere', radius: 0.03 }, motion: 'dynamic', mass: 0.4, position: [0, 11.5, 0], user: 1, allowSleep: false,
        angularVelocity: [0, 0, 20], rolling: { coefficient: 0.015, radius: 0.03 },
      })
      for (let i = 0; i < 36; i++) world.step(1 / 120)
      expect(world.touching(ball)).toBe(false)
      const v = new Float64Array(6)
      world.readVelocity(ball, v, 0)
      world.dispose()
      return v[5]!
    }
    expect(fall(true)).toBe(fall(false))

    const world = engine.createWorld({ fixedStep: 1 / 120, sleepSpeed: 0.08 }) as JoltWorld
    const material: Material = { frictionStatic: 0.6, frictionDynamic: 0.4, restitution: 0 }
    world.createBody({ shape: { kind: 'box', half: [5, 0.5, 5] }, motion: 'static', position: [0, -0.5, 0], material, user: 0 })
    const smoke = world.createBody({ shape: { kind: 'sphere', radius: 2 }, motion: 'kinematic', layer: 'sensor', position: [0, 1, 0], user: 9 })
    const box = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: [0, 0.1, 0], material, user: 1, allowSleep: false })
    for (let i = 0; i < 120; i++) {
      world.moveKinematic(smoke, [(i + 1) / 120, 1, 0], [0, 0, 0, 1], 1 / 120)
      world.step(1 / 120)
    }
    expect(world.partners.get(box)?.has(smoke) ?? false).toBe(false)
    expect(world.bodies.get(box)!.sliding).toBe(false)
    world.dispose()
  })

  it('friction follows the fixed step, not the call: one step(1/60) and two step(1/120) give the same pose to the bit', async () => {
    const material: Material = { frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }
    const a = await onRamp(material, 2, 1, 1 / 60)
    const b = await onRamp(material, 2, 1, 1 / 120)
    expect(a.along.at(-1)).toBe(b.along.at(-1))
    a.world.dispose()
    b.world.dispose()
  })

  it('a removed sensor leaves a body inside it touching the floor, and a removed partner leaves the partners', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, sleepSpeed: 0.08 }) as JoltWorld
    const material: Material = { frictionStatic: 0.6, frictionDynamic: 0.4, restitution: 0 }
    world.createBody({ shape: { kind: 'box', half: [5, 0.5, 5] }, motion: 'static', position: [0, -0.5, 0], material, user: 0 })
    const smoke = world.createBody({ shape: { kind: 'sphere', radius: 2 }, motion: 'static', layer: 'sensor', position: [0, 1, 0], user: 9 })
    const box = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: [0, 0.1, 0], material, user: 1, allowSleep: false })
    const lid = world.createBody({ shape: { kind: 'box', half: [0.1, 0.02, 0.1] }, motion: 'dynamic', mass: 0.2, position: [0, 0.221, 0], material, user: 2, allowSleep: false })
    for (let i = 0; i < 30; i++) world.step(1 / 120)
    expect(world.partners.get(box)?.has(lid)).toBe(true)
    world.removeBody(smoke)
    for (let i = 0; i < 2; i++) world.step(1 / 120)
    expect(world.touching(box)).toBe(true)
    world.removeBody(lid)
    for (let i = 0; i < 2; i++) world.step(1 / 120)
    expect(world.partners.get(box)?.has(lid) ?? false).toBe(false)
    expect(world.touching(box)).toBe(true)
    world.dispose()
  })
})
