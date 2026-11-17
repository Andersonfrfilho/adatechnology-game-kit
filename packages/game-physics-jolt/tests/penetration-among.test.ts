import { describe, expect, it } from 'vitest'

import type { BodyId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

/**
 * `penetration(id, out, among)` leaves the bodies outside `among` out before the narrow phase (spec 008: a thin plate in a crater met thousands of triangles of the ground
 * and paid 5 ms for hits it then threw away). It must answer what it answered before: the deepest overlap with the bodies of `among`, the same depth and the same way out.
 */
const SIZE = 81
const CELL = 0.05
const crater = (x: number, z: number): number => -0.3 * Math.exp(-((x - 40) ** 2 + (z - 40) ** 2) / 300) + 0.02 * Math.sin(x) * Math.cos(z)
const heights = (): Float32Array => {
  const out = new Float32Array(SIZE * SIZE)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) out[z * SIZE + x] = crater(x, z)
  return out
}
const BOXES: Array<{ center: Vec3; half: Vec3; among: boolean }> = [
  { center: [2, 0.2, 2], half: [0.5, 0.2, 0.3], among: true },
  { center: [2.6, 0.1, 2], half: [0.2, 0.3, 0.4], among: true },
  { center: [1.7, 0.1, 1.6], half: [0.3, 0.1, 0.3], among: false },
  { center: [2.2, -0.1, 2.4], half: [1, 0.05, 1], among: false },
]

/** A world with the ground (a crater as a height field) and the boxes, the ones outside `among` only when `withOthers`; then a thin plate. */
const build = async (withOthers: boolean): Promise<{ world: PhysicsWorld; plate: BodyId; among: Set<BodyId> }> => {
  const world = (await createJoltEngine()).createWorld()
  if (withOthers) world.createBody({ shape: { kind: 'heightfield', origin: [0, 0, 0], cell: CELL, size: SIZE, heights: heights() }, motion: 'static', position: [0, 0, 0], user: 0 })
  const among = new Set<BodyId>()
  for (const box of BOXES) {
    if (!box.among && !withOthers) continue
    const id = world.createBody({ shape: { kind: 'box', half: box.half }, motion: 'static', position: box.center, user: 0 })
    if (box.among) among.add(id)
  }
  const plate = world.createBody({ shape: { kind: 'box', half: [0.57, 0.02, 0.3] }, motion: 'dynamic', mass: 3, position: [2, 0, 2], user: 1, sleeping: true })
  return { world, plate, among }
}

describe('penetration among a set of fixed bodies', () => {
  it('answers the same depth and way out as a world that holds only those bodies, at every pose, with the ground and other boxes around', async () => {
    const full = await build(true)
    const only = await build(false)
    const a = new Float64Array(3)
    const b = new Float64Array(3)
    let overlapping = 0
    for (let i = 0; i < 60; i++) {
      const position: Vec3 = [1.4 + (i % 6) * 0.25, -0.15 + Math.floor(i / 6) * 0.05, 1.6 + (i % 4) * 0.2]
      const turn = Math.sin(i) * 0.4
      const rotation: [number, number, number, number] = [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)]
      full.world.setPose(full.plate, position, rotation, false)
      only.world.setPose(only.plate, position, rotation, false)
      a.fill(0)
      b.fill(0)
      const depth = full.world.penetration!(full.plate, a, full.among)
      expect(depth).toBe(only.world.penetration!(only.plate, b))
      expect([...a]).toEqual([...b])
      if (depth > 0) overlapping++
    }
    expect(overlapping).toBeGreaterThan(10)
    full.world.dispose()
    only.world.dispose()
  })

  it('without a set, still meets every fixed body but itself', async () => {
    const full = await build(true)
    full.world.setPose(full.plate, [2, 0.05, 2], [0, 0, 0, 1], false)
    const out = new Float64Array(3)
    // the large box under the plate is not in the set: only the query without one sees it
    expect(full.world.penetration!(full.plate, out)).toBeGreaterThan(full.world.penetration!(full.plate, new Float64Array(3), new Set()))
    full.world.dispose()
  })
})
