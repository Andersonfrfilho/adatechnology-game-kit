import { describe, expect, it } from 'vitest'

import { KIT_WORLD, grabBody } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { ground } from './scenes'

const H = 1 / 120
const HALF = 0.1
const WALL_X = 3
const WALL_HALF = 0.05
const NO_ROTATION = [0, 0, 0, 1] as const

const makeWorld = async (): Promise<PhysicsWorld> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD)
  ground(world)
  return world
}

const wall = (world: PhysicsWorld): void => {
  world.createBody({ shape: { kind: 'box', half: [WALL_HALF, 2, 5] }, motion: 'static', position: [WALL_X, 2, 0], user: -1 })
}

const crate = (world: PhysicsWorld, at: Vec3): BodyId =>
  world.createBody({ shape: { kind: 'box', half: [HALF, HALF, HALF] }, motion: 'dynamic', mass: 2, position: at, layer: 'prop', user: 1 })

const poseOf = (world: PhysicsWorld, id: BodyId): Float64Array => {
  const pose = new Float64Array(7)
  world.readPose(id, pose, 0)
  return pose
}

describe('hold, drop and throw: dynamic <-> kinematic (spec 008 T4.2)', () => {
  it('picks a crate up off the floor, carries it to the hand and holds it there without letting it fall', async () => {
    const world = await makeWorld()
    const id = crate(world, [0, HALF, 0])
    const hold = grabBody(world, id, { radius: HALF })
    for (let i = 0; i < 120; i++) {
      hold.moveTo([0.5, 1.2, 0], NO_ROTATION, H)
      world.stepFixed(H)
    }
    // held for another second with nothing moving it: a dynamic body would have fallen 4.9 m
    for (let i = 0; i < 120; i++) {
      expect(hold.moveTo([0.5, 1.2, 0], NO_ROTATION, H)).toBe(true)
      world.stepFixed(H)
    }
    const pose = poseOf(world, id)
    expect([pose[0], pose[1], pose[2]].map((v) => Math.round((v ?? 0) * 100) / 100)).toEqual([0.5, 1.2, 0])
    world.dispose()
  })

  it('carried into a wall by a hand that is inside the wall, it stops at the wall and never crosses', async () => {
    const world = await makeWorld()
    wall(world)
    const id = crate(world, [0, 1, 0])
    const hold = grabBody(world, id, { radius: HALF })
    let furthest = -Infinity
    let blocked = false
    for (let i = 0; i < 360; i++) {
      // the hand walks to x = 4, past a wall at x = 3
      const handX = Math.min(4, i * 0.02)
      if (!hold.moveTo([handX, 1, 0], NO_ROTATION, H)) blocked = true
      world.stepFixed(H)
      furthest = Math.max(furthest, poseOf(world, id)[0] ?? 0)
    }
    expect(blocked).toBe(true)
    expect(furthest).toBeLessThan(WALL_X - WALL_HALF - HALF + 0.001)
    expect(furthest).toBeGreaterThan(WALL_X - WALL_HALF - HALF - 0.05)
    world.dispose()
  })

  it('without the sweep a kinematic body goes through the wall (the case the hold is for)', async () => {
    const world = await makeWorld()
    wall(world)
    const id = crate(world, [0, 1, 0])
    world.setMotion(id, 'kinematic')
    for (let i = 0; i < 360; i++) {
      world.moveKinematic(id, [Math.min(4, i * 0.02), 1, 0], NO_ROTATION, H)
      world.stepFixed(H)
    }
    expect(poseOf(world, id)[0]).toBeGreaterThan(WALL_X + WALL_HALF)
    world.dispose()
  })

  it('throws a crate at 15 m/s at a 10 cm wall 1.5 m off: it hits the wall and stays on this side', async () => {
    const world = await makeWorld()
    wall(world)
    const id = crate(world, [0, 1.2, 0])
    const hold = grabBody(world, id, { radius: HALF })
    for (let i = 0; i < 60; i++) {
      hold.moveTo([1.4, 1.2, 0], NO_ROTATION, H)
      world.stepFixed(H)
    }
    hold.release([15, 2, 0], [0, 0, 6])
    let furthest = -Infinity
    for (let i = 0; i < 360; i++) {
      world.stepFixed(H)
      furthest = Math.max(furthest, poseOf(world, id)[0] ?? 0)
    }
    expect(hold.held).toBe(false)
    expect(furthest).toBeLessThan(WALL_X - WALL_HALF)
    expect(furthest).toBeGreaterThan(WALL_X - WALL_HALF - 0.3)
    world.dispose()
  })

  it('a small piece (6 cm) thrown at 25 m/s moves 21 cm a step, more than the wall is thick, and still does not tunnel', async () => {
    const world = await makeWorld()
    wall(world)
    const small = world.createBody({ shape: { kind: 'box', half: [0.03, 0.03, 0.03] }, motion: 'dynamic', mass: 0.3, position: [1, 1.2, 0], layer: 'prop', user: 2 })
    const hold = grabBody(world, small, { radius: 0.03 })
    for (let i = 0; i < 30; i++) {
      hold.moveTo([1, 1.2, 0], NO_ROTATION, H)
      world.stepFixed(H)
    }
    hold.release([25, 0, 0])
    let furthest = -Infinity
    for (let i = 0; i < 240; i++) {
      world.stepFixed(H)
      furthest = Math.max(furthest, poseOf(world, small)[0] ?? 0)
    }
    expect(furthest).toBeLessThan(WALL_X - WALL_HALF)
    world.dispose()
  })

  it('the same piece let go with the plain engine calls (no sweep) tunnels through the wall', async () => {
    const world = await makeWorld()
    wall(world)
    const small = world.createBody({ shape: { kind: 'box', half: [0.03, 0.03, 0.03] }, motion: 'dynamic', mass: 0.3, position: [1, 1.2, 0], layer: 'prop', user: 2 })
    world.setMotion(small, 'kinematic')
    world.setMotion(small, 'dynamic')
    world.setVelocity(small, [25, 0, 0], [0, 0, 0])
    let furthest = -Infinity
    for (let i = 0; i < 240; i++) {
      world.stepFixed(H)
      furthest = Math.max(furthest, poseOf(world, small)[0] ?? 0)
    }
    expect(furthest).toBeGreaterThan(WALL_X + WALL_HALF)
    world.dispose()
  })

  it('a drop falls with its own mass and comes to rest on the floor, and letting go twice does nothing', async () => {
    const world = await makeWorld()
    const id = crate(world, [0, HALF, 0])
    const hold = grabBody(world, id, { radius: HALF })
    for (let i = 0; i < 60; i++) {
      hold.moveTo([0, 1.5, 0], NO_ROTATION, H)
      world.stepFixed(H)
    }
    hold.release([0, 0, 0])
    hold.release([50, 0, 0])
    for (let i = 0; i < 480; i++) world.stepFixed(H)
    const pose = poseOf(world, id)
    expect(pose[1]).toBeCloseTo(HALF, 1)
    expect(Math.abs(pose[0] ?? 0)).toBeLessThan(0.3)
    expect(world.isSleeping(id)).toBe(true)
    world.dispose()
  })

  it('a hand sliding along the floor is not stopped by the floor under the crate', async () => {
    const world = await makeWorld()
    const id = crate(world, [0, HALF, 0])
    const hold = grabBody(world, id, { radius: HALF })
    let blocked = false
    for (let i = 0; i < 120; i++) {
      if (!hold.moveTo([i * 0.01, HALF, 0], NO_ROTATION, H)) blocked = true
      world.stepFixed(H)
    }
    expect(blocked).toBe(false)
    expect(poseOf(world, id)[0]).toBeCloseTo(1.19, 1)
    world.dispose()
  })
})
