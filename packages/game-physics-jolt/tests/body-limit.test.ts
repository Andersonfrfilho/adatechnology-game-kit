import { describe, expect, it } from 'vitest'

import { BodyLimitError, KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyDesc, BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const CAPACITY = 64
const crate = (index: number): BodyDesc => ({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', position: [index * 0.5, 5, 0], mass: 1, user: index })

describe('body limit', () => {
  it('reads the occupancy of the world', async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD, maxBodies: CAPACITY })
    expect(world.bodyCapacity).toBe(CAPACITY)
    const total = world.memoryTotal()
    expect(total).toBeGreaterThan(0)
    const freeBefore = total - world.memoryInUse()
    const ids = [0, 1, 2].map((index) => world.createBody(crate(index)))
    expect(world.bodyCount).toBe(3)
    expect(world.memoryTotal()).toBe(total)
    expect(total - world.memoryInUse()).toBeLessThanOrEqual(freeBefore)
    world.removeBody(ids[0]!)
    expect(world.bodyCount).toBe(2)
    world.dispose()
  })

  it('throws a typed error at the limit and leaves the world intact', async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD, maxBodies: CAPACITY })
    const ids: BodyId[] = []
    for (let index = 0; index < CAPACITY; index++) ids.push(world.createBody(crate(index)))
    expect(world.bodyCount).toBe(CAPACITY)
    let caught: unknown
    try {
      world.createBody(crate(CAPACITY))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(BodyLimitError)
    expect((caught as BodyLimitError).code).toBe('BODY_LIMIT_REACHED')
    expect((caught as BodyLimitError).capacity).toBe(CAPACITY)
    expect(world.bodyCount).toBe(CAPACITY)
    expect(() => world.createBodies([crate(CAPACITY + 1)])).toThrow(BodyLimitError)
    expect(world.bodyCount).toBe(CAPACITY)
    for (let i = 0; i < 30; i++) world.step(1 / 120)
    const pose = new Float64Array(7)
    world.readPose(ids[0]!, pose, 0)
    expect(pose[1]).toBeLessThan(5)
    world.removeBody(ids[0]!)
    expect(() => world.createBody(crate(CAPACITY + 2))).not.toThrow()
    world.dispose()
  })
})
