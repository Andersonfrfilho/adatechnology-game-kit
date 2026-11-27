import { describe, expect, it } from 'vitest'

import type { BodyId, RayHit } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { report } from './scenes'

/**
 * A ground height field is thousands of triangles. A query that met it kept one result per triangle in the wasm heap (3.5 to 4.7 MB a call) and a launcher fired on the
 * terrain area aborted with `Aborted(OOM)`. The queries now hand back one hit per body and keep nothing per triangle.
 */
const SIZE = 257
const CELL = 0.25
const GROUND_HEIGHT = (x: number, z: number): number => 0.15 * Math.sin(x * 0.7) * Math.cos(z * 0.5)

const build = async (): Promise<{ world: JoltWorld; ground: BodyId; crate: BodyId }> => {
  const world = (await createJoltEngine()).createWorld({ maxBodies: 256 }) as JoltWorld
  const heights = new Float32Array(SIZE * SIZE)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) heights[z * SIZE + x] = GROUND_HEIGHT(x * CELL, z * CELL)
  const centre = (SIZE * CELL) / 2
  const ground = world.createBody({ shape: { kind: 'heightfield', origin: [0, 0, 0], cell: CELL, size: SIZE, heights }, motion: 'static', position: [0, 0, 0], user: 0 })
  const crate = world.createBody({ shape: { kind: 'box', half: [0.4, 0.4, 0.4] }, motion: 'static', position: [centre + 3, 1, centre], user: 1 })
  return { world, ground, crate }
}

describe('queries over a big ground answer one hit per body', () => {
  it('overlapSphere of 12 m returns the ground once and the crate once', async () => {
    const { world, ground, crate } = await build()
    const centre = (SIZE * CELL) / 2
    const out: BodyId[] = []
    expect(world.overlapSphere!([centre, 0.5, centre], 12, out)).toBe(2)
    expect([...out].sort()).toEqual([ground, crate].sort())
    world.dispose()
  })

  it('sphereCastAll returns the ground once, nearest first, with the crate in front of it', async () => {
    const { world, ground, crate } = await build()
    const centre = (SIZE * CELL) / 2
    const out: RayHit[] = []
    const count = world.sphereCastAll!([centre - 10, 0.55, centre], [1, 0, 0], 20, 0.5, out)
    expect(count).toBe(2)
    expect(out.map((hit) => hit.body)).toContain(ground)
    expect(out.map((hit) => hit.body)).toContain(crate)
    expect(out[0]!.distance).toBeLessThanOrEqual(out[1]!.distance)
    world.dispose()
  })

  it('the heap does not grow over 220 blasts (a result kept per triangle held megabytes after the first) of overlaps and casts on the ground', async () => {
    const { world } = await build()
    const centre = (SIZE * CELL) / 2
    const bodies: BodyId[] = []
    const hits: RayHit[] = []
    const fire = (i: number): void => {
      world.overlapSphere!([centre + (i % 7), 0.5, centre], 12, bodies)
      world.sphereCastAll!([centre - 12, 1.5, centre + (i % 5)], [1, 0, 0], 38, 0.5, hits)
      world.sphereCastAll!([centre, 20, centre], [0, -1, 0], 22, 0.3, hits)
    }
    const before = world.memoryInUse()
    for (let i = 0; i < 20; i++) fire(i)
    for (let i = 0; i < 200; i++) fire(i + 20)
    const after = world.memoryInUse()
    report('query-per-body-heap', { before, after, growth: after - before, total: world.memoryTotal() })
    expect(after - before).toBeLessThan(64 * 1024)
    world.dispose()
  })
})
