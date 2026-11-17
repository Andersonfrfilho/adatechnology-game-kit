import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'
import type { Terrain } from '../src'

/** A small deterministic random (mulberry32), so a failing tile can be read again. */
const randomOf = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The lattice an engine tile reads: `count` points from `min`, `step` apart, each as the tile computes it. */
const lattice = (min: number, step: number, count: number): Float64Array => {
  const out = new Float64Array(count)
  for (let i = 0; i < count; i++) out[i] = min + (i / 2) * step
  return out
}

/** How many heights of the grid are not, to the bit, what `heightAt` answers at the same point. */
const mismatches = (terrain: Terrain, xs: Float64Array, zs: Float64Array): number => {
  const out = new Float64Array(xs.length * zs.length)
  terrain.heightGrid(xs, zs, out)
  let wrong = 0
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) if (!Object.is(out[j * xs.length + i], terrain.heightAt(xs[i]!, zs[j]!))) wrong++
  return wrong
}

/** A terrain that has been through what a fight does to it: craters, dug holes and the soil they threw, prints and marks. */
const fought = (baseHeight?: (x: number, z: number) => number): Terrain => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, ...(baseHeight ? { baseHeight } : {}) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  terrain.strike('explosive', { x: -3.1, z: 2.6, energy: 1.5e6 })
  terrain.strike('ballistic', { x: 1.13, z: 3.31, energy: 2000 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: 2.43, z: 1.2, depth: 0.2 })
  terrain.dig({ x: -1.1, z: -2.7, dump: { x: -1.4, z: -2.2 } })
  terrain.press({ x: 1.5, z: -1.5, radius: 0.3 })
  for (let k = 0; k < 120; k++) terrain.update(1 / 60)
  return terrain
}

describe('heightGrid: heightAt over a lattice in one pass', () => {
  it('answers what heightAt answers, to the bit, on random tiles of a cratered, dug and pressed terrain', () => {
    const terrain = fought()
    const random = randomOf(7)
    for (let k = 0; k < 40; k++) {
      const step = 0.025 * (1 + Math.floor(random() * 3))
      const count = 1 + Math.floor(random() * 90)
      const minX = -7 + random() * 12
      const minZ = -7 + random() * 12
      expect(mismatches(terrain, lattice(minX, step, count), lattice(minZ, step, 1 + Math.floor(random() * 90)))).toBe(0)
    }
  })

  it('reads a whole engine tile over the crater exactly, on and between the vertices', () => {
    const terrain = fought()
    // the ground is not level there: a crater a good way deep, and the soil heaped round it
    const range = terrain.heightRange(-1.5, 2, -1.5, 2)!
    expect(range.low).toBeLessThan(-0.2)
    expect(range.high).toBeGreaterThan(0)
    // 2 m tiles at 2.5 cm, read at half a cell: 161 x 161, the lattice the engine reads
    for (const [x0, z0] of [[0, 0], [-2, -2], [-4, 2], [2, 0]] as const) expect(mismatches(terrain, lattice(x0, 0.025, 161), lattice(z0, 0.025, 161))).toBe(0)
  })

  it('past the terrain answers the host baseHeight, and on the terrain edge the clamped last cell, as heightAt does', () => {
    const terrain = fought((x, z) => 0.3 * Math.sin(x) * Math.cos(z))
    // a tile across each edge and one corner, and one wholly outside
    for (const [x0, z0] of [[5, -1], [-7, 0], [0, 5], [5, 5], [8, 8]] as const) expect(mismatches(terrain, lattice(x0, 0.025, 161), lattice(z0, 0.025, 161))).toBe(0)
    // exactly on the bounds
    expect(mismatches(terrain, Float64Array.of(-6, 6, 5.9999999), Float64Array.of(-6, 6, -5.9999999))).toBe(0)
  })

  it('past the terrain with no baseHeight is 0, as heightAt', () => {
    const terrain = fought()
    const out = new Float64Array(4)
    terrain.heightGrid([7, 8], [0, 9], out)
    expect([...out]).toEqual([0, 0, 0, 0])
  })

  it('refuses an out too small for the grid', () => {
    expect(() => fought().heightGrid([0, 1], [0, 1], new Float64Array(3))).toThrow(RangeError)
  })
})
