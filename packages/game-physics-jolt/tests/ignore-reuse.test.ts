import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const newWorld = async (): Promise<PhysicsWorld> => (await createJoltEngine()).createWorld(KIT_WORLD)
const heightOf = (world: PhysicsWorld, id: BodyId): number => {
  const out = new Float64Array(7)
  world.readPose(id, out, 0)
  return out[1]!
}

describe('ignored pairs when Jolt reuses a removed body index', () => {
  it('a shard dropped on the pole stops on it, not inside it', async () => {
    const world = await newWorld()
    const pole = world.createBody({ shape: { kind: 'box', half: [0.5, 1, 0.5] }, motion: 'static', position: [0, 1, 0], user: 0 })
    const wire = world.createBody({ shape: { kind: 'box', half: [0.05, 0.05, 0.05] }, motion: 'dynamic', position: [3, 3, 0], mass: 1, user: 1 })
    world.ignorePair(pole, wire, true)
    world.removeBody(wire)
    // the next body takes the freed index; before the fix it inherited "does not collide with the pole"
    const shard = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', position: [0, 3, 0], mass: 1, user: 2 })
    for (let i = 0; i < 240; i++) world.step(1 / 120)
    // the pole's top is at y = 2; the shard's centre rests 0.1 above it
    expect(heightOf(world, shard)).toBeGreaterThan(2.05)
    world.dispose()
  })

  it('a pair ignored by two live bodies stays ignored', async () => {
    const world = await newWorld()
    const a = world.createBody({ shape: { kind: 'box', half: [0.5, 1, 0.5] }, motion: 'static', position: [0, 1, 0], user: 0 })
    const b = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', position: [0, 3, 0], mass: 1, user: 1 })
    world.ignorePair(a, b, true)
    for (let i = 0; i < 240; i++) world.step(1 / 120)
    expect(heightOf(world, b)).toBeLessThan(1.5)
    world.dispose()
  })
})
