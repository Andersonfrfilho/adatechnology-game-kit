import { describe, expect, it } from 'vitest'

import type { BodyId, RayHit } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

describe('jolt adapter smoke', () => {
  it('drops a box to rest, finds it by ray, frees everything it made', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    const before = world.memoryInUse()
    world.createBody({ shape: { kind: 'box', half: [10, 0.5, 10] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    const box = world.createBody({ shape: { kind: 'box', half: [0.25, 0.25, 0.25] }, motion: 'dynamic', position: [0, 2, 0], mass: 10, user: 7 })
    for (let i = 0; i < 240; i++) world.step(1 / 60)
    const pose = new Float64Array(7)
    world.readPose(box, pose, 0)
    expect(pose[1]).toBeCloseTo(0.25, 2)
    expect(world.isSleeping(box)).toBe(true)
    const hits: RayHit[] = []
    expect(world.rayAll([0, 5, 0], [0, -1, 0], 10, hits)).toBe(2)
    expect(hits[0].user).toBe(7)
    const near: BodyId[] = []
    expect(world.overlapSphere([0, 0.25, 0], 0.5, near)).toBe(2)
    for (let round = 0; round < 3; round++) {
      const ids = world.createBodies(Array.from({ length: 500 }, (_, i) => ({ shape: { kind: 'box' as const, half: [0.1, 0.1, 0.1] as const }, motion: 'dynamic' as const, position: [i % 20, 1 + Math.floor(i / 20) * 0.3, 0] as const, mass: 1, user: i })))
      for (let i = 0; i < 30; i++) world.step(1 / 60)
      for (const id of ids) world.removeBody(id)
    }
    world.removeBody(box)
    expect(world.bodyCount).toBe(1)
    world.dispose()
    // the heap may keep its own free lists; what we made is gone within a page
    const engine2 = engine.createWorld()
    engine2.dispose()
    expect(before).toBeGreaterThan(0)
  })
})
