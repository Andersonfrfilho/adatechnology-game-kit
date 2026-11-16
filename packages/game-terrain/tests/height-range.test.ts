import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'

const ground = () => createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface: 'dirt' } })

/** Every `heightAt` over the rectangle on a fine lattice, one sample every 7 mm (finer than a cell, and off its grid). */
const sampled = (terrain: ReturnType<typeof ground>, minX: number, maxX: number, minZ: number, maxZ: number): { low: number; high: number } => {
  let low = Infinity
  let high = -Infinity
  for (let x = minX; x <= maxX; x += 0.007) {
    for (let z = minZ; z <= maxZ; z += 0.007) {
      const h = terrain.heightAt(x, z)
      low = Math.min(low, h)
      high = Math.max(high, h)
    }
  }
  return { low, high }
}

describe('heightRange: the exact bounds of the ground over a rectangle', () => {
  it('level ground is level to the last bit, so a level tile can be proved from the terrain alone', () => {
    const range = ground().heightRange(-2, 0, 1, 3)!
    expect(range.high - range.low).toBe(0)
  })

  it('holds every height the rectangle can read, after digs, and is no looser than the vertices around it', () => {
    const terrain = ground()
    for (let k = 0; k < 4; k++) terrain.dig({ x: 0.43, z: 0.2, depth: 0.2 })
    terrain.dig({ x: 1.1, z: 1.7, dump: { x: 1.4, z: 1.7 } })
    for (const [minX, maxX, minZ, maxZ] of [[-1, 1, -1, 1], [0.3, 0.6, 0.1, 0.4], [1, 3, 1, 3], [-5, -3, -5, -3]] as const) {
      const range = terrain.heightRange(minX, maxX, minZ, maxZ)!
      const seen = sampled(terrain, minX, maxX, minZ, maxZ)
      expect(seen.low).toBeGreaterThanOrEqual(range.low)
      expect(seen.high).toBeLessThanOrEqual(range.high)
      // the vertices a rectangle covers lie in the cells it touches: a cell more on each side at most
      expect(range.low).toBeLessThanOrEqual(seen.low)
      expect(seen.low - range.low).toBeLessThan(0.2)
    }
  })

  it('a crater far smaller than a cell still shows: a rectangle that reaches one dug vertex is not level', () => {
    const terrain = ground()
    terrain.dig({ x: 0, z: 0, depth: 0.05 })
    expect(terrain.heightRange(-0.5, 0.5, -0.5, 0.5)!.low).toBeLessThan(-0.01)
    const farAway = terrain.heightRange(2, 4, 2, 4)!
    expect(farAway.high - farAway.low).toBe(0)
  })

  it('is unknown where the terrain does not hold the whole rectangle (the host owns the ground past its edge)', () => {
    const terrain = ground()
    expect(terrain.heightRange(4, 6, 0, 1)).toBeNull()
    expect(terrain.heightRange(-6, 0, 0, 1)).toBeNull()
  })
})
