import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PhysicsWorld, ShapeDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'

const alive: JoltWorld[] = []
// the wasm heap holds about six worlds: each test lets its worlds go
afterEach(() => {
  for (const world of alive.splice(0)) world.dispose()
})
const makeWorld = async (): Promise<JoltWorld> => {
  const world = (await createJoltEngine()).createWorld() as JoltWorld
  alive.push(world)
  return world
}

/** A wedge: a top that rises by `rise` over a 0.5 m block, the way the solid under a tile of ground makes them. */
const wedge = (rise: number): number[] => [-0.25, rise, -0.25, 0.25, rise, -0.25, -0.25, 0, 0.25, 0.25, 0, 0.25, -0.25, -0.5, -0.25, 0.25, -0.5, -0.25, -0.25, -0.5, 0.25, 0.25, -0.5, 0.25]

const solid = (rises: readonly number[], reuseHulls: boolean): ShapeDesc => ({
  kind: 'compound',
  ...(reuseHulls ? { reuseHulls: true } : {}),
  children: rises.map((rise, i) => ({ shape: { kind: 'convex' as const, points: wedge(rise) }, position: [i * 0.5, 0, 0] as [number, number, number] })),
})

/** What a ray from above meets along the compound: top of the hull at each wedge, sampled across them. */
const surface = (world: PhysicsWorld, count: number): number[] => {
  const out: number[] = []
  for (let x = 0.01; x < count * 0.5; x += 0.037) for (const z of [-0.2, 0, 0.2]) out.push(5 - (world.rayFirst([x - 0.25, 5, z], [0, -1, 0], 10)?.distance ?? NaN))
  return out
}

const heldBy = (world: JoltWorld, id: unknown): number => world.hulls.get(id as number)?.size ?? 0

describe('reuseHulls: a compound made again from mostly the same hulls (T3.8ad)', () => {
  it('is the same shape as one made without reuse: the same surface to every ray', async () => {
    const rises = [0.1, 0.2, 0.1, 0.3, 0.2, 0.05, 0.1, 0.4]
    const reused = await makeWorld()
    const plain = await makeWorld()
    const a = reused.createBody({ shape: solid(rises, true), motion: 'static', position: [0, 0, 0], user: 0 })
    plain.createBody({ shape: solid(rises, false), motion: 'static', position: [0, 0, 0], user: 0 })
    expect(surface(reused, rises.length)).toEqual(surface(plain, rises.length))
    // 8 children, 5 distinct hulls: reuse made 5, and the body holds them for its next shape
    expect(heldBy(reused, a)).toBe(new Set(rises).size)
  })

  it('a shape made again with one hull changed holds the rest from before, and answers as a shape made from nothing', async () => {
    const world = await makeWorld()
    const rises = Array.from({ length: 40 }, (_, i) => 0.05 + 0.01 * (i % 7))
    const id = world.createBody({ shape: solid(rises, true), motion: 'static', position: [0, 0, 0], user: 0 })
    const made = vi.spyOn(world.J.ConvexHullShapeSettings.prototype, 'Create')
    const changed = [...rises]
    changed[17] = 0.9
    world.setShape(id, solid(changed, true))
    // one hull made anew (the one changed); the 7 distinct before are the ones held, and the one nobody uses any more is let go
    expect(made.mock.calls.length).toBe(1)
    expect(heldBy(world, id)).toBe(8)
    const fresh = await makeWorld()
    fresh.createBody({ shape: solid(changed, false), motion: 'static', position: [0, 0, 0], user: 0 })
    expect(surface(world, changed.length)).toEqual(surface(fresh, changed.length))
    made.mockRestore()
  })

  it('holds only what the current shape uses, so 200 shapes made over and over grow neither the hulls, the bodies nor the heap', async () => {
    const world = await makeWorld()
    const id = world.createBody({ shape: solid([0.1], true), motion: 'static', position: [0, 0, 0], user: 0 })
    const round = (k: number): void => world.setShape(id, solid(Array.from({ length: 30 }, (_, i) => 0.001 * (k * 30 + i)), true))
    for (let k = 0; k < 6; k++) round(k)
    const bytes = world.memoryInUse()
    const bodies = world.bodyCount
    for (let k = 6; k < 206; k++) round(k)
    expect(heldBy(world, id)).toBe(30)
    expect(world.bodyCount).toBe(bodies)
    expect(Math.abs(world.memoryInUse() - bytes)).toBeLessThan(4096)
  })

  it('a body removed, or given a shape that does not reuse, lets its hulls go; a world disposed lets them all go', async () => {
    const world = await makeWorld()
    const a = world.createBody({ shape: solid([0.1, 0.2], true), motion: 'static', position: [0, 0, 0], user: 0 })
    const b = world.createBody({ shape: solid([0.3, 0.4, 0.5], true), motion: 'static', position: [0, 0, 0], user: 0 })
    expect(heldBy(world, a)).toBe(2)
    world.setShape(a, solid([0.1, 0.2], false))
    expect(heldBy(world, a)).toBe(0)
    world.removeBody(b)
    expect(world.hulls.size).toBe(0)
  })

  it('without the flag no hull is held', async () => {
    const world = await makeWorld()
    const id = world.createBody({ shape: solid([0.1, 0.2, 0.3], false), motion: 'static', position: [0, 0, 0], user: 0 })
    expect(heldBy(world, id)).toBe(0)
  })
})
