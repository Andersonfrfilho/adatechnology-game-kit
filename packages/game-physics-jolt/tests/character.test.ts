import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { CharacterDesc, CharacterId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { WALKER, eulerXYZ, ground, report, stats } from './scenes'

const H = 1 / 120

const makeWorld = async (): Promise<PhysicsWorld> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld(KIT_WORLD)
  ground(world)
  return world
}

const spawn = (world: PhysicsWorld, at: Vec3, rest: Partial<CharacterDesc> = {}): CharacterId => world.createCharacter({ ...WALKER, position: at, ...rest })

/** `seconds` of fixed steps walking at (vx, vz), then the feet. */
const walk = (world: PhysicsWorld, id: CharacterId, velocity: { x: number; z: number }, seconds: number): Float64Array => {
  const feet = new Float64Array(3)
  for (let i = 0; i < Math.round(seconds / H); i++) {
    world.moveCharacter(id, velocity.x, velocity.z, H)
    world.stepFixed(H)
  }
  world.readCharacter(id, feet, 0)
  return feet
}

describe('character controller behind the contract (spec 008 T4.1)', () => {
  it('steps up an 18 cm step and stops at a 50 cm wall', async () => {
    const world = await makeWorld()
    world.createBody({ shape: { kind: 'box', half: [1, 0.09, 1] }, motion: 'static', position: [0, 0.09, -2], user: -1 })
    world.createBody({ shape: { kind: 'box', half: [1, 0.25, 0.1] }, motion: 'static', position: [6, 0.25, -2], user: -1 })
    const walker = spawn(world, [0, 0, 0])
    const onStep = walk(world, walker, { x: 0, z: -1.5 }, 2)
    expect(onStep[2]).toBeLessThan(-1.7)
    expect(onStep[1]).toBeCloseTo(0.18, 2)
    expect(world.characterSupported(walker)).toBe(true)
    const blocked = walk(world, spawn(world, [6, 0, 0]), { x: 0, z: -1.5 }, 2)
    expect(blocked[1]).toBeLessThan(0.05)
    expect(blocked[2]).toBeGreaterThan(-1.6)
    world.dispose()
  })

  it('climbs a 30 degree ramp and does not climb a 60 degree one', async () => {
    const world = await makeWorld()
    // the low end of the ramp meets the ground at z = 0
    const slope = (x: number, degrees: number): void => {
      const angle = (degrees * Math.PI) / 180
      world.createBody({ shape: { kind: 'box', half: [1, 0.05, 4] }, motion: 'static', position: [x, 4 * Math.sin(angle), -4 * Math.cos(angle)], rotation: eulerXYZ(angle, 0, 0), user: -1 })
    }
    slope(0, 30)
    slope(6, 60)
    const up = walk(world, spawn(world, [0, 0, 0]), { x: 0, z: -1.5 }, 3)
    expect(up[1]).toBeGreaterThan(1.0)
    expect(Math.abs(up[1] + up[2] * Math.tan(Math.PI / 6))).toBeLessThan(0.15)
    const steep = walk(world, spawn(world, [6, 0, 0]), { x: 0, z: -1.5 }, 3)
    expect(steep[1]).toBeLessThan(0.6)
    world.dispose()
  })

  it('pushes a 30 kg crate, and the crate does not stop it', async () => {
    const world = await makeWorld()
    const crate = world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 30, position: [0, 0.3, -2], layer: 'prop', user: 5 })
    const feet = walk(world, spawn(world, [0, 0, 0]), { x: 0, z: -1.2 }, 3)
    const pose = new Float64Array(7)
    world.readPose(crate, pose, 0)
    expect(pose[2]).toBeLessThan(-3.2)
    expect(feet[2]).toBeLessThan(-2.6)
    expect(Math.abs(pose[0])).toBeLessThan(0.5)
    world.dispose()
  })

  it('does not move a crate heavier than its strength allows (400 N against 500 kg)', async () => {
    const world = await makeWorld()
    const heavy = world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 500, position: [0, 0.3, -2], layer: 'prop', user: 6 })
    walk(world, spawn(world, [0, 0, 0]), { x: 0, z: -1.2 }, 3)
    const pose = new Float64Array(7)
    world.readPose(heavy, pose, 0)
    expect(pose[2]).toBeGreaterThan(-2.1)
    world.dispose()
  })

  it('is pushed: a shove moves it by impulse / mass x a quarter second, and a wall stops it', async () => {
    const world = await makeWorld()
    world.createBody({ shape: { kind: 'box', half: [2, 1, 0.1] }, motion: 'static', position: [10, 1, -0.6], user: -1 })
    const still = walk(world, spawn(world, [0, 0, 0]), { x: 0, z: 0 }, 1)
    expect(Math.hypot(still[0], still[2])).toBeLessThan(0.01)
    const shoved = spawn(world, [-5, 0, 0])
    world.pushCharacter(shoved, [0, 0, -225])
    const moved = walk(world, shoved, { x: 0, z: 0 }, 2)
    expect(moved[2]).toBeLessThan(-0.6)
    expect(moved[2]).toBeGreaterThan(-0.9)
    expect(Math.abs(moved[0] + 5)).toBeLessThan(0.01)
    const against = spawn(world, [10, 0, 0])
    world.pushCharacter(against, [0, 0, -2250])
    const stopped = walk(world, against, { x: 0, z: 0 }, 2)
    expect(stopped[2]).toBeGreaterThan(-0.35)
    world.dispose()
  })

  it('teleports: the feet are there at once, and the speed it had is gone', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0])
    walk(world, walker, { x: 0, z: -2 }, 1)
    world.teleportCharacter(walker, [5, 0, 5])
    const feet = new Float64Array(3)
    world.readCharacter(walker, feet, 0)
    expect([feet[0], feet[1], feet[2]]).toEqual([5, 0, 5])
    const after = walk(world, walker, { x: 0, z: 0 }, 1)
    expect(Math.hypot(after[0] - 5, after[2] - 5)).toBeLessThan(0.01)
    world.dispose()
  })

  it('falls off a ledge and lands, and a removed controller no longer answers', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 2, 0])
    expect(walk(world, walker, { x: 0, z: 0 }, 1)[1]).toBeCloseTo(0, 2)
    world.removeCharacter(walker)
    world.moveCharacter(walker, 1, 0, H)
    expect(world.characterSupported(walker)).toBe(false)
    world.dispose()
  })

  it('50 controllers cost at most 0.5 ms a fixed step (median)', { timeout: 120000 }, async () => {
    const world = await makeWorld()
    world.createBody({ shape: { kind: 'box', half: [1, 0.09, 1] }, motion: 'static', position: [0, 0.09, 4], user: -1 })
    const crowd = Array.from({ length: 50 }, (_, i) => spawn(world, [(i % 10) * 1.5 - 7, 0, 3 + Math.floor(i / 10) * 1.5]))
    const samples: number[] = []
    for (let i = 0; i < 360; i++) {
      const start = performance.now()
      for (const [k, id] of crowd.entries()) world.moveCharacter(id, Math.sin(i / 40 + k), Math.cos(i / 40 + k), H)
      if (i >= 60) samples.push(performance.now() - start)
      world.stepFixed(H)
    }
    const cost = stats(samples)
    report('character50', { fixedStepMs: cost })
    expect(cost.median).toBeLessThanOrEqual(0.5)
    for (const id of crowd) world.removeCharacter(id)
    world.dispose()
  })
})
