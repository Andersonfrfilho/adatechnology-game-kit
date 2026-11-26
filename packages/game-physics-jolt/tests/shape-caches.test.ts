import { describe, expect, it, vi } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, ShapeDesc } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground } from './scenes'

const IDENTITY = [0, 0, 0, 1] as const
const sphereOf = (radius: number): ShapeDesc => ({ kind: 'sphere', radius })

const newWorld = async (): Promise<JoltWorld> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD) as JoltWorld
  ground(world)
  return world
}

const ask = (world: JoltWorld, shape: ShapeDesc): number => world.overlapShape(shape, [0, 0.2, 0], [...IDENTITY], [] as BodyId[])

describe('overlapShape keeps its shapes by value (review of PR 521, item 4)', () => {
  it('asking again with a new object of the same type and dimensions does not make the shape again', { timeout: 30000 }, async () => {
    const world = await newWorld()
    const made = vi.spyOn(world, 'makeShape')
    const sizes = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]
    for (let round = 0; round < 50; round++) for (const radius of sizes) ask(world, sphereOf(radius))
    expect(made).toHaveBeenCalledTimes(sizes.length)
    world.dispose()
  })

  it('past 32 the one asked for longest ago goes, and what was asked for lately stays', { timeout: 30000 }, async () => {
    const world = await newWorld()
    const made = vi.spyOn(world, 'makeShape')
    const radius = (index: number): number => 0.1 + index * 0.01
    for (let index = 0; index < 32; index++) ask(world, sphereOf(radius(index)))
    expect(made).toHaveBeenCalledTimes(32)
    // the oldest is asked for again, so it is the newest; the next new one pushes out the second
    ask(world, sphereOf(radius(0)))
    ask(world, sphereOf(radius(100)))
    expect(made).toHaveBeenCalledTimes(33)
    ask(world, sphereOf(radius(0)))
    expect(made).toHaveBeenCalledTimes(33)
    ask(world, sphereOf(radius(1)))
    expect(made).toHaveBeenCalledTimes(34)
    world.dispose()
  })

  it('what it let go of does not leak: the heap after many different shapes is the heap after 32', { timeout: 30000 }, async () => {
    const world = await newWorld()
    for (let index = 0; index < 40; index++) ask(world, sphereOf(0.1 + index * 0.01))
    const held = world.memoryInUse()
    for (let index = 40; index < 400; index++) ask(world, sphereOf(0.1 + index * 0.01))
    expect(world.memoryInUse()).toBe(held)
    world.dispose()
  })
})

describe('the ragdoll cache keeps taking new entries past 64 (review of PR 521, item 8)', () => {
  const dollOf = (radius: number, parts = 1): Parameters<JoltWorld['createRagdoll']>[0] => ({
    stabilize: true,
    parts: Array.from({ length: parts }, (_, index) => ({
      body: { shape: sphereOf(radius), mass: 1, position: [index * 0.5, 2, 0] as [number, number, number], layer: 'character' as const, user: 1 },
      parent: index - 1,
      ...(index === 0 ? {} : { joint: { kind: 'swingTwist' as const, point: [index * 0.5 - 0.25, 2, 0] as [number, number, number], twistAxis: [1, 0, 0] as [number, number, number], planeAxis: [0, 1, 0] as [number, number, number], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 } }),
    })),
  })
  const make = (world: JoltWorld, radius: number, parts = 1): void => world.removeRagdoll(world.createRagdoll(dollOf(radius, parts)).id)

  it('the shapes made lately are held and the least recently used goes, so a 65th size is cached too', { timeout: 30000 }, async () => {
    const world = await newWorld()
    const made = vi.spyOn(world, 'makeShape')
    const radius = (index: number): number => 0.05 + index * 0.001
    for (let index = 0; index < 64; index++) make(world, radius(index))
    expect(made).toHaveBeenCalledTimes(64)
    make(world, radius(64))
    expect(made).toHaveBeenCalledTimes(65)
    // the 65th is held (before: it was made and dropped each time), and so are the 63 after the first
    make(world, radius(64))
    make(world, radius(5))
    expect(made).toHaveBeenCalledTimes(65)
    // the first was the one let go of
    make(world, radius(0))
    expect(made).toHaveBeenCalledTimes(66)
    world.dispose()
  })

  it('past 64 skeletons the newest is held and the oldest goes (it stopped taking entries at 64)', { timeout: 60000 }, async () => {
    const world = await newWorld()
    for (let index = 0; index < 70; index++) make(world, 0.1, 2 + index)
    expect(world.ragdollCache.skeletons.size).toBe(64)
    const keys = [...world.ragdollCache.skeletons.keys()]
    const parentsOf = (parts: number): string => Array.from({ length: parts }, (_, index) => index - 1).join(',')
    expect(keys).toContain(parentsOf(71))
    expect(keys).not.toContain(parentsOf(2))
    expect(keys).toContain(parentsOf(8))
    world.dispose()
  })
})
