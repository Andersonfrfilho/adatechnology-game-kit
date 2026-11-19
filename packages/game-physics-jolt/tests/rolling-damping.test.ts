import { describe, expect, it } from 'vitest'

import type { BodyId, Material, PhysicsWorld, Rolling, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { rollingImpulse } from '../src/friction'
import { eulerXYZ } from './scenes'

/** A can lying across +x: 6.6 cm across, 12 cm long, 0.35 kg, its axis along z (Jolt's cylinder stands on y). */
const RADIUS = 0.033
const HALF = 0.06
const MASS = 0.35
const LYING = eulerXYZ(Math.PI / 2, 0, 0)

const FLOOR: Material = { frictionStatic: 0.7, frictionDynamic: 0.6, restitution: 0, rolling: 0.015, rollingDamping: 0.06 }
const GRASS: Material = { ...FLOOR, rolling: 0.15, rollingDamping: 1.5 }
const STEEL: Material = { frictionStatic: 0.6, frictionDynamic: 0.4, restitution: 0, rolling: 0.002 }

interface Run {
  readonly world: PhysicsWorld
  readonly can: BodyId
  readonly at: () => Vec3
  readonly speed: () => number
}

const scene = async (o: { readonly surface: Material; readonly damping: number; readonly slopeDegrees?: number; readonly speed?: number }): Promise<Run> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 60 })
  const slope = ((o.slopeDegrees ?? 0) * Math.PI) / 180
  // a slab 40 m long, its +x end down by the slope
  world.createBody({ shape: { kind: 'box', half: [20, 0.5, 2] }, motion: 'static', position: [0, -0.5, 0], rotation: eulerXYZ(0, 0, -slope), material: o.surface, user: -1 })
  const rolling: Rolling = { coefficient: STEEL.rolling ?? 0, radius: RADIUS, damping: o.damping }
  const v = o.speed ?? 0
  const lift = RADIUS + 0.001
  const can = world.createBody({
    shape: { kind: 'cylinder', halfHeight: HALF, radius: RADIUS },
    motion: 'dynamic',
    mass: MASS,
    position: [Math.sin(slope) * lift, Math.cos(slope) * lift, 0],
    rotation: LYING,
    material: STEEL,
    rolling,
    linearVelocity: [v, 0, 0],
    angularVelocity: [0, 0, -v / RADIUS],
    user: 1,
  })
  const pose = new Float64Array(7)
  const vel = new Float64Array(6)
  return {
    world,
    can,
    at: () => {
      world.readPose(can, pose, 0)
      return [pose[0] as number, pose[1] as number, pose[2] as number]
    },
    speed: () => {
      world.readVelocity(can, vel, 0)
      return Math.hypot(vel[0] as number, vel[1] as number, vel[2] as number)
    },
  }
}

/** Steps until the can is almost still (or `seconds`): when and how far from where it started. */
const rollOut = (run: Run, seconds: number): { seconds: number; distance: number } => {
  const start = run.at()
  for (let i = 0; i < seconds * 60; i++) {
    run.world.step(1 / 60)
    if (i > 10 && run.speed() < 0.02) {
      const end = run.at()
      return { seconds: (i + 1) / 60, distance: Math.hypot(end[0] - start[0], end[2] - start[2]) }
    }
  }
  const end = run.at()
  return { seconds, distance: Math.hypot(end[0] - start[0], end[2] - start[2]) }
}

describe('rollingImpulse', () => {
  it('is the Coulomb impulse without damping, adds the spin exp(-d dt) takes, and never more than stops the spin', () => {
    const base = { spin: 30, per: 100, mass: 0.35, gravity: 9.81, coefficient: 0.015, radius: 0.033, dt: 1 / 60 }
    const coulomb = rollingImpulse({ ...base, damping: 0 })
    expect(coulomb).toBeCloseTo(0.015 * 9.81 * 0.033 * 0.35 / 60, 10)
    const damped = rollingImpulse({ ...base, damping: 1.5 })
    expect(damped - coulomb).toBeCloseTo((30 * (1 - Math.exp(-1.5 / 60))) / 100, 10)
    expect(rollingImpulse({ ...base, spin: 1e-4, damping: 50 })).toBeCloseTo(1e-4 / 100, 12)
  })
})

describe('a rolling body slows by its own and its surface rolling damping (Rolling.damping + Material.rollingDamping)', () => {
  it('a steel can at 1.5 m/s rolls a few metres on a hard floor, under a metre on grass, and the damping shortens both', async () => {
    const floor = rollOut(await scene({ surface: FLOOR, damping: 0.02, speed: 1.5 }), 30)
    const floorNoDamping = rollOut(await scene({ surface: { ...FLOOR, rollingDamping: 0 }, damping: 0, speed: 1.5 }), 30)
    const grass = rollOut(await scene({ surface: GRASS, damping: 0.02, speed: 1.5 }), 30)
    expect(floor.distance).toBeGreaterThan(1.5)
    expect(floor.distance).toBeLessThan(floorNoDamping.distance)
    expect(floor.seconds).toBeLessThan(floorNoDamping.seconds)
    expect(grass.distance).toBeLessThan(1)
    expect(grass.seconds).toBeLessThan(2)
  })

  it('down a 10 degree ramp of the same floor it keeps rolling faster: the damping does not beat gravity', async () => {
    const run = await scene({ surface: FLOOR, damping: 0.15, slopeDegrees: 10 })
    for (let i = 0; i < 60; i++) run.world.step(1 / 60)
    const at1 = run.speed()
    for (let i = 0; i < 60; i++) run.world.step(1 / 60)
    expect(at1).toBeGreaterThan(0.5)
    expect(run.speed()).toBeGreaterThan(at1 + 0.5)
  })

  it('stopped and asleep on grass, a kick wakes it and it rolls again', async () => {
    const run = await scene({ surface: GRASS, damping: 0.15, speed: 1 })
    for (let i = 0; i < 300; i++) run.world.step(1 / 60)
    expect(run.speed()).toBeLessThan(0.02)
    const rest = run.at()
    run.world.addImpulse(run.can, [MASS * 1.5, 0, 0], rest)
    run.world.step(1 / 60)
    expect(run.speed()).toBeGreaterThan(0.5)
    for (let i = 0; i < 30; i++) run.world.step(1 / 60)
    expect(run.at()[0] - rest[0]).toBeGreaterThan(0.1)
  })
})
