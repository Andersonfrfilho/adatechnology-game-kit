import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, CharacterDesc, CharacterId, Layer, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { WALKER, ground } from './scenes'

const H = 1 / 120

const makeWorld = async (): Promise<PhysicsWorld> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD)
  ground(world)
  return world
}

const spawn = (world: PhysicsWorld, at: Vec3, rest: Partial<CharacterDesc> = {}): CharacterId => world.createCharacter({ ...WALKER, position: at, ...rest })

const run = (world: PhysicsWorld, seconds: number, walker?: CharacterId, vz = 0): void => {
  for (let i = 0; i < Math.round(seconds / H); i++) {
    if (walker !== undefined) world.moveCharacter(walker, 0, vz, H)
    world.stepFixed(H)
  }
}

const topOf = (world: PhysicsWorld, id: BodyId): number => {
  const pose = new Float64Array(7)
  world.readPose(id, pose, 0)
  return pose[1] as number
}

const drop = (world: PhysicsWorld, layer: Layer): BodyId =>
  world.createBody({ shape: { kind: 'box', half: [0.4, 0.05, 0.4] }, motion: 'dynamic', mass: 5, position: [0, 3, 0], layer, user: 9 })

describe('the walker shadow (spec 008 TS.9c)', () => {
  it('a plank that falls on the walker lands on its head, and a walker without a shadow has no body', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0], { shadow: 'agent' })
    const plank = drop(world, 'debris')
    run(world, 2, walker)
    expect(topOf(world, plank)).toBeGreaterThan(1.8)
    expect(topOf(world, plank)).toBeLessThan(1.95)
    expect(world.characterBody(spawn(world, [5, 0, 0]))).toBeUndefined()
    world.dispose()
  })

  it('on the agent layer a vehicle does not stop on it, on the character layer it does', async () => {
    const world = await makeWorld()
    const agent = spawn(world, [0, 0, 0], { shadow: 'agent' })
    const car = drop(world, 'vehicle')
    run(world, 2, agent)
    expect(topOf(world, car)).toBeLessThan(0.1)
    world.removeCharacter(agent)
    run(world, 0.1)
    const solid = spawn(world, [8, 0, 0], { shadow: 'character' })
    const second = world.createBody({ shape: { kind: 'box', half: [0.4, 0.05, 0.4] }, motion: 'dynamic', mass: 5, position: [8, 3, 0], layer: 'vehicle', user: 9 })
    run(world, 2, solid)
    expect(topOf(world, second)).toBeGreaterThan(1.8)
    world.dispose()
  })

  it('walks as before with its shadow on (its own sweeps ignore it), and the shadow follows, found by overlapShape', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0], { shadow: 'agent', user: 77 })
    const shadow = world.characterBody(walker)
    expect(shadow).toBeDefined()
    run(world, 2, walker, -1.5)
    const feet = new Float64Array(3)
    world.readCharacter(walker, feet, 0)
    expect(feet[2]).toBeLessThan(-2.8)
    expect(world.characterSupported(walker)).toBe(true)
    const found: BodyId[] = []
    const around = (at: Vec3): number => world.overlapShape({ kind: 'sphere', radius: 0.2 }, at, [0, 0, 0, 1], found, { layers: ['agent'] })
    expect(around([feet[0] as number, 0.9, feet[2] as number])).toBe(1)
    expect(found[0]).toBe(shadow)
    expect(around([0, 0.9, 0])).toBe(0)
    world.teleportCharacter(walker, [10, 0, 10])
    expect(around([10, 0.9, 10])).toBe(1)
    expect(around([feet[0] as number, 0.9, feet[2] as number])).toBe(0)
    world.dispose()
  })

  it('takes the stance of its walker: a crouched shadow is not at head height', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0], { shadow: 'agent' })
    const found: BodyId[] = []
    const head = (): number => world.overlapShape({ kind: 'sphere', radius: 0.1 }, [0, 1.6, 0], [0, 0, 0, 1], found, { layers: ['agent'] })
    const waist = (): number => world.overlapShape({ kind: 'sphere', radius: 0.1 }, [0, 0.5, 0], [0, 0, 0, 1], found, { layers: ['agent'] })
    run(world, 0.5, walker)
    expect([head(), waist()]).toEqual([1, 1])
    expect(world.setCharacterShape(walker, { radius: 0.3, halfHeight: 0.3 })).toBe(true)
    run(world, 0.2, walker)
    expect([head(), waist()]).toEqual([0, 1])
    expect(world.setCharacterShape(walker, { radius: 0.3, halfHeight: 0.6 })).toBe(true)
    run(world, 0.2, walker)
    expect([head(), waist()]).toEqual([1, 1])
    world.dispose()
  })

  it('leaves with its walker: no body, no overlap, and removeBody refuses it', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0], { shadow: 'agent' })
    const shadow = world.characterBody(walker) as BodyId
    expect(() => world.removeBody(shadow)).toThrow(/removeCharacter/)
    const before = world.bodyCount
    world.removeCharacter(walker)
    expect(world.bodyCount).toBe(before - 1)
    expect(world.characterBody(walker)).toBeUndefined()
    const found: BodyId[] = []
    expect(world.overlapShape({ kind: 'sphere', radius: 0.5 }, [0, 0.9, 0], [0, 0, 0, 1], found, { layers: ['agent'] })).toBe(0)
    world.dispose()
  })
})

describe('a walker on the character layer', () => {
  it('walks as before: its own shadow is never in its way', async () => {
    const world = await makeWorld()
    const walker = spawn(world, [0, 0, 0], { shadow: 'character' })
    run(world, 2, walker, -1.5)
    const feet = new Float64Array(3)
    world.readCharacter(walker, feet, 0)
    expect(feet[2]).toBeLessThan(-2.8)
    expect(world.characterSupported(walker)).toBe(true)
    world.dispose()
  })
})
