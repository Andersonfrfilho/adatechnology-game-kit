import { describe, expect, it } from 'vitest'

import { createTerrain, heightPatchGrid, samePatch } from '../src'
import type { HeightPatch, Terrain } from '../src'

/**
 * `heightPatch` + `heightPatchGrid`: the terrain's vertices under a rectangle, read anywhere (a worker has no terrain), answer what `heightGrid` answers there, to the bit.
 */
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

const lattice = (min: number, step: number, count: number): Float64Array => {
  const out = new Float64Array(count)
  for (let i = 0; i < count; i++) out[i] = min + (i / 2) * step
  return out
}

const fought = (cellSize = 0.1, baseHeight?: (x: number, z: number) => number): Terrain => {
  const terrain = createTerrain({ bounds: [-6, -6, 6.03, 6], cellSize, layout: { surface: 'dirt' }, ...(baseHeight ? { baseHeight } : {}) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  terrain.strike('explosive', { x: -3.1, z: 2.6, energy: 1.5e6 })
  terrain.strike('ballistic', { x: 1.13, z: 3.31, energy: 2000 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: 2.43, z: 1.2, depth: 0.2 })
  terrain.dig({ x: -1.1, z: -2.7, dump: { x: -1.4, z: -2.2 } })
  terrain.press({ x: 1.5, z: -1.5, radius: 0.3 })
  for (let k = 0; k < 120; k++) terrain.update(1 / 60)
  return terrain
}

/** How many heights read from the patch of the lattice's rectangle are not, to the bit, `heightGrid`'s. */
const mismatches = (terrain: Terrain, xs: Float64Array, zs: Float64Array): number => {
  const patch = terrain.heightPatch(xs[0]!, xs[xs.length - 1]!, zs[0]!, zs[zs.length - 1]!)
  if (!patch) throw new Error('rectangle not inside the terrain')
  const expected = new Float64Array(xs.length * zs.length)
  terrain.heightGrid(xs, zs, expected)
  const out = new Float64Array(xs.length * zs.length)
  // across a thread: a structured clone of plain numbers
  heightPatchGrid(structuredClone(patch), xs, zs, out)
  let wrong = 0
  for (let k = 0; k < out.length; k++) if (!Object.is(out[k], expected[k])) wrong++
  return wrong
}

describe('heightPatch: the ground under a rectangle as plain numbers', () => {
  it('reads what heightGrid reads, to the bit, on random lattices of a cratered, dug, pressed terrain (two cell sizes, a base height)', () => {
    for (const terrain of [fought(), fought(0.07, (x, z) => 0.3 * Math.sin(x) * Math.cos(z))]) {
      const random = randomOf(11)
      for (let k = 0; k < 60; k++) {
        const step = 0.025 * (1 + Math.floor(random() * 3))
        const nx = 1 + Math.floor(random() * 90)
        const nz = 1 + Math.floor(random() * 90)
        const minX = -6 + random() * (12 - nx * step / 2)
        const minZ = -6 + random() * (12 - nz * step / 2)
        expect(mismatches(terrain, lattice(minX, step, nx), lattice(minZ, step, nz))).toBe(0)
      }
    }
  })

  it('an engine tile and its ring (2.4 m at half 2.5 cm cells), on and between the vertices, up to the bounds and the clamped last cell', () => {
    const terrain = fought()
    for (const [x0, z0] of [[0, 0], [-2, -2], [-5.8, -5.8], [3.6, 3.6], [3.63, -1]] as const) expect(mismatches(terrain, lattice(x0 - 0.2, 0.025, 193), lattice(z0 - 0.2, 0.025, 193))).toBe(0)
    // exactly on the bounds: the last cell, clamped
    expect(mismatches(terrain, Float64Array.of(-6, 5.9999999, 6.03), Float64Array.of(-6, -5.9999999, 6))).toBe(0)
  })

  it('is null for a rectangle that crosses the bounds (the host baseHeight answers there)', () => {
    const terrain = fought()
    expect(terrain.heightPatch(-6.01, 0, 0, 1)).toBeNull()
    expect(terrain.heightPatch(0, 6.04, 0, 1)).toBeNull()
    expect(terrain.heightPatch(0, 1, 5, 6.2)).toBeNull()
    expect(terrain.heightPatch(-6, 6.03, -6, 6)).not.toBeNull()
  })

  it('writes into the array it is handed when it is long enough; a point past the patch throws', () => {
    const terrain = fought()
    const into = new Float64Array(30 * 30)
    const patch = terrain.heightPatch(0, 2.4, 0, 2.4, into)!
    expect(patch.heights).toBe(into)
    expect([patch.width, patch.depth]).toEqual([26, 26])
    expect(terrain.heightPatch(0, 2.4, 0, 2.4, new Float64Array(3))!.heights.length).toBe(676)
    expect(() => heightPatchGrid(patch, [2.6], [1], new Float64Array(1))).toThrow(RangeError)
    expect(() => heightPatchGrid(patch, [1], [-0.1], new Float64Array(1))).toThrow(RangeError)
  })

  it('samePatch: the same vertices at the same heights; a dig under it or another place is not', () => {
    const terrain = fought()
    const read = (): HeightPatch => terrain.heightPatch(-1, 1.4, -1, 1.4)!
    const before = read()
    expect(samePatch(before, read())).toBe(true)
    expect(samePatch(before, terrain.heightPatch(-0.9, 1.5, -1, 1.4)!)).toBe(false)
    terrain.dig({ x: 4, z: 4, depth: 0.1 })
    expect(samePatch(before, read())).toBe(true)
    terrain.dig({ x: 0.2, z: 0.3, depth: 0.1 })
    expect(samePatch(before, read())).toBe(false)
  })
})
