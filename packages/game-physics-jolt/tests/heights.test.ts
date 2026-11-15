import { describe, expect, it } from 'vitest'

import type { BodyId, PhysicsWorld } from '@adatechnology/game-physics'
import { HEIGHT_BLOCK } from '../src/constants'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'

const SIZE = 81
const CELL = 0.025
const bumpy = (x: number, z: number): number => 0.03 * Math.sin(0.2 * x) * Math.cos(0.17 * z)
const field = (heights: (x: number, z: number) => number): Float32Array => {
  const out = new Float32Array(SIZE * SIZE)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) out[z * SIZE + x] = heights(x, z)
  return out
}
/** A ray's hit distance is a float32: the surface read from it is good to about this (m). */
const RAY_NOISE = 5e-6
/** The same surface to a ray's precision; a ray that misses (a sample on the field's edge) misses both times. */
const sameSurface = (a: number, b: number): boolean => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < RAY_NOISE
const makeWorld = async (): Promise<JoltWorld> => (await createJoltEngine()).createWorld() as JoltWorld
const fieldBody = (world: PhysicsWorld, heights: Float32Array, y = 0): BodyId => world.createBody({ shape: { kind: 'heightfield', origin: [0, y, 0], cell: CELL, size: SIZE, heights }, motion: 'static', position: [0, 0, 0], user: 0 })
/** The surface a ray from above meets at sample (x, z). */
const surface = (world: PhysicsWorld, x: number, z: number): number => 5 - (world.rayFirst([x * CELL, 5, z * CELL], [0, -1, 0], 10)?.distance ?? NaN)

describe('updateHeights (T3.8q)', () => {
  it('writes the samples of a region into the same shape: the same surface as a field made from the new heights, within the quantisation, and the rest untouched', async () => {
    const world = await makeWorld()
    const before = field(bumpy)
    const id = fieldBody(world, before)
    const after = field((x, z) => (x >= 20 && x < 41 && z >= 30 && z < 47 ? 0.5 * bumpy(x, z) - 0.004 : bumpy(x, z)))
    const kept: number[] = []
    for (let z = 0; z < SIZE; z += 3) for (let x = 0; x < SIZE; x += 3) kept.push(surface(world, x, z))
    const region = { x: 20, z: 30, sizeX: 21, sizeZ: 17 }
    // widened to Jolt's blocks of 4
    const widened = { x: 20, z: 28, sizeX: 24, sizeZ: 20 }
    expect(world.updateHeights(id, region, after)).toBe(true)
    const reference = await makeWorld()
    fieldBody(reference, after)
    // both are 8 bit samples over their own range: each is within half a step of the truth, so within a step of each other (the old range is the wider here)
    const step = (0.03 + 0.03) / 255
    let at = 0
    for (let z = 0; z < SIZE; z += 3) {
      for (let x = 0; x < SIZE; x += 3) {
        const inside = x >= region.x && x < region.x + region.sizeX && z >= region.z && z < region.z + region.sizeZ
        const got = surface(world, x, z)
        if (inside) expect(Math.abs(got - surface(reference, x, z))).toBeLessThanOrEqual(2 * step)
        // Jolt requantizes the blocks left of and above the written ones (a write moves them by less than 5e-5); the rest is exactly as it was
        else if (x >= widened.x - HEIGHT_BLOCK && z >= widened.z - HEIGHT_BLOCK && x < widened.x + widened.sizeX && z < widened.z + widened.sizeZ) expect(Math.abs(got - kept[at]!)).toBeLessThan(5e-5)
        else expect(sameSurface(got, kept[at]!)).toBe(true)
        at++
      }
    }
    world.dispose()
    reference.dispose()
  })

  it('returns false and leaves the field alone for a height outside its range, a box, a region off the field or on the padding', async () => {
    const world = await makeWorld()
    const heights = field(bumpy)
    const id = fieldBody(world, heights)
    const box = world.createBody({ shape: { kind: 'box', half: [1, 1, 1] }, motion: 'static', position: [10, 0, 0], user: 1 })
    const sample = (): number => surface(world, 10, 10)
    const was = sample()
    const region = { x: 8, z: 8, sizeX: 4, sizeZ: 4 }
    expect(world.updateHeights(id, region, field(() => 1))).toBe(false)
    expect(world.updateHeights(id, region, field(() => -1))).toBe(false)
    expect(world.updateHeights(box, region, heights)).toBe(false)
    expect(world.updateHeights(id, { x: 78, z: 78, sizeX: 4, sizeZ: 4 }, heights)).toBe(false)
    expect(world.updateHeights(id, { x: -1, z: 0, sizeX: 4, sizeZ: 4 }, heights)).toBe(false)
    expect(world.updateHeights(id, region, new Float32Array(3))).toBe(false)
    expect(sample()).toBe(was)
    world.dispose()
  })

  it('works on a field with an origin height, and a sample on the field edge', async () => {
    const world = await makeWorld()
    const id = fieldBody(world, field(bumpy), 2)
    const edge = { x: 78, z: 78, sizeX: 3, sizeZ: 3 }
    expect(world.updateHeights(id, edge, field((x, z) => (x >= 78 && z >= 78 ? 2.01 : bumpy(x, z) + 2)))).toBe(true)
    expect(surface(world, 80, 80)).toBeCloseTo(2.01, 2)
    world.dispose()
  })

  it('writing again and again leaks nothing and moves nothing: the heap, the body count and every surface away from the region are the same after 200 writes', async () => {
    const world = await makeWorld()
    const base = field(bumpy)
    const id = fieldBody(world, base)
    const write = (k: number): void => {
      const next = field((x, z) => (x >= 10 && x < 34 && z >= 12 && z < 36 ? 0.01 * Math.sin(k) : bumpy(x, z)))
      expect(world.updateHeights(id, { x: 10, z: 12, sizeX: 24, sizeZ: 24 }, next)).toBe(true)
    }
    for (let k = 0; k < 10; k++) write(k)
    const bytes = world.memoryInUse()
    const bodies = world.bodyCount
    // the blocks left of and above the written ones are requantized by Jolt (see `updateHeights`); everything else must stay put
    const far = (x: number, z: number): boolean => x < 4 || x >= 36 || z < 8 || z >= 36
    const outside: number[] = []
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (far(x, z)) outside.push(surface(world, x, z))
    for (let k = 0; k < 200; k++) write(k)
    expect(world.bodyCount).toBe(bodies)
    expect(world.memoryInUse()).toBe(bytes)
    let at = 0
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (far(x, z)) expect(sameSurface(surface(world, x, z), outside[at++]!)).toBe(true)
    world.dispose()
  })
})
