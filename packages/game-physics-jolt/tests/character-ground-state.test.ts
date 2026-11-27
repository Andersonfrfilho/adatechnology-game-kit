import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { CharacterId, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { WALKER, ground } from './scenes'

const H = 1 / 120

const makeWorld = async (): Promise<PhysicsWorld> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD)
  ground(world)
  return world
}

describe('what the walker stands on (spec 008 TS.9d)', () => {
  it('reads the ground it stands on, a flat ground at rest in the air, and the velocity of a moving platform', async () => {
    const world = await makeWorld()
    const platform = world.createBody({ shape: { kind: 'box', half: [2, 0.2, 2] }, motion: 'kinematic', position: [10, 0.2, 0], layer: 'prop', user: 42 })
    const walker = world.createCharacter({ ...WALKER, position: [10, 0.4, 0] })
    const standing = world.createCharacter({ ...WALKER, position: [0, 0, 0] })
    const out = new Float64Array(7)
    expect(world.readCharacterGround(walker, out)).toBe(false)
    expect(Array.from(out)).toEqual([0, 1, 0, 0, 0, 0, -1])
    for (let i = 0; i < 240; i++) {
      world.moveKinematic(platform, [10 + (i + 1) * H, 0.2, 0], [0, 0, 0, 1], H)
      world.moveCharacter(walker, 0, 0, H)
      world.moveCharacter(standing, 0, 0, H)
      world.stepFixed(H)
    }
    expect(world.readCharacterGround(walker, out)).toBe(true)
    expect(out[1]).toBeCloseTo(1, 2)
    expect(out[3]).toBeCloseTo(1, 1)
    expect(out[4]).toBeCloseTo(0, 1)
    expect(out[6]).toBe(42)
    const feet = new Float64Array(3)
    world.readCharacter(walker, feet, 0)
    expect(feet[0]).toBeGreaterThan(11.5)
    expect(world.readCharacterGround(standing, out)).toBe(true)
    expect([out[3], out[4], out[5], out[6]]).toEqual([0, 0, 0, -1])
    world.dispose()
  })
})

const script = (world: PhysicsWorld, walker: CharacterId, from: number, steps: number): void => {
  for (let i = from; i < from + steps; i++) {
    world.moveCharacter(walker, Math.sin(i / 60) * 1.5, -1 - Math.cos(i / 90), H)
    if (i % 150 === 0) world.pushCharacter(walker, [30, 75 * 3.99, -20])
    if (i % 300 === 100) world.setCharacterShape(walker, { radius: 0.3, halfHeight: 0.3 })
    if (i % 300 === 200) world.setCharacterShape(walker, { radius: 0.3, halfHeight: 0.6 })
    world.stepFixed(H)
  }
}

describe('walkers in the saved state (spec 008 TS.9e)', () => {
  it('save, walk two seconds, restore, walk the same two seconds: the same bytes', async () => {
    const world = await makeWorld()
    world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 30, position: [0, 0.3, -3], layer: 'prop', user: 5 })
    const walker = world.createCharacter({ ...WALKER, position: [0, 0, 0], shadow: 'agent' })
    script(world, walker, 0, 120)
    const saved = world.saveState()
    script(world, walker, 120, 240)
    const first = world.saveState()
    const feet = new Float64Array(3)
    world.readCharacter(walker, feet, 0)
    const firstFeet = Array.from(feet)
    expect(world.restoreState(saved)).toBe(true)
    script(world, walker, 120, 240)
    const second = world.saveState()
    world.readCharacter(walker, feet, 0)
    expect(Array.from(feet)).toEqual(firstFeet)
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true)
    expect(Math.hypot(firstFeet[0] as number, firstFeet[2] as number)).toBeGreaterThan(1)
    world.dispose()
  })
})
