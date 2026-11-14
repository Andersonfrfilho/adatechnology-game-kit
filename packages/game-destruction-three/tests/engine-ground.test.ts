import { describe, expect, it } from 'vitest'

import { GROUND_CELL, buildGroundTile } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'

/** The step boxes as min x, max x, min z, max z, top. */
const boxesOf = (t: GroundTile): Array<[number, number, number, number, number]> => {
  const out: Array<[number, number, number, number, number]> = []
  for (let i = 0; i < t.boxes.length; i += 6) out.push([t.boxes[i] - t.boxes[i + 3], t.boxes[i] + t.boxes[i + 3], t.boxes[i + 2] - t.boxes[i + 5], t.boxes[i + 2] + t.boxes[i + 5], t.boxes[i + 1] + t.boxes[i + 4]])
  return out
}

/** The height field's surface at (x, z) of a tile from (x0, z0): bilinear over its cell, as the engine's two triangles are within a few mm on these grounds. */
const fieldAt = (t: GroundTile, x0: number, z0: number, size: number, x: number, z: number): number => {
  const c = size / t.cells
  const m = t.cells + 1
  const i = Math.min(t.cells - 1, Math.floor((x - x0) / c))
  const j = Math.min(t.cells - 1, Math.floor((z - z0) / c))
  const u = (x - x0) / c - i
  const v = (z - z0) / c - j
  const h = (a: number, b: number): number => t.heights[(j + b) * m + i + a]
  return h(0, 0) * (1 - u) * (1 - v) + h(1, 0) * u * (1 - v) + h(0, 1) * (1 - u) * v + h(1, 1) * u * v
}

// the tests of the triangle ground this replaced (vertical faces, one-sided walls toward the low side) are rewritten for a height field plus solid step boxes:
// the same promises — a step stays a step where it is, never a ramp; a smooth bowl stays smooth; a step on a tile's border is made once — on the new shapes
describe('engine ground', () => {
  it('keeps a slab edge a solid box within half a cell of where it is, and no ramp of the height field sticks out of the ground', () => {
    const groundAt = (x: number): number => (x >= 0.53 ? 0.2 : 0)
    const t = buildGroundTile(groundAt, 0, 0, 1)
    const high = boxesOf(t).filter((b) => Math.abs(b[4] - 0.2) < 1e-9)
    expect(high.length).toBeGreaterThan(0)
    expect(Math.abs(Math.min(...high.map((b) => b[0])) - 0.53)).toBeLessThanOrEqual(GROUND_CELL / 2)
    for (let x = 0.0005; x < 1; x += 0.0025) {
      const z = 0.5
      const above = fieldAt(t, 0, 0, 1, x, z) - groundAt(x)
      if (above <= 1e-3) continue
      // a height field ramp above the true ground is only ever inside a box that reaches as high
      expect(boxesOf(t).some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] >= groundAt(x) + above - 1e-3)).toBe(true)
    }
  })

  it('a smooth bowl has no step boxes and its height field is the ground at every corner', () => {
    const groundAt = (x: number, z: number): number => {
      const d = Math.hypot(x, z)
      return d < 1.2 ? -0.45 * (1 - (d / 1.2) ** 2) : 0
    }
    const t = buildGroundTile(groundAt, -1, -1, 2)
    expect(t.boxes).toHaveLength(0)
    expect(t.level).toBeNull()
    const m = t.cells + 1
    for (let j = 0; j < m; j += 7) for (let i = 0; i < m; i += 7) expect(t.heights[j * m + i]).toBeCloseTo(groundAt(-1 + (i * 2) / t.cells, -1 + (j * 2) / t.cells), 5)
  })

  it('level ground is a level tile (a slab)', () => {
    expect(buildGroundTile(() => 0.3, 0, 0, 2).level).toBe(0.3)
  })
})

describe('engine ground at a tile border', () => {
  it('a table side on the line between two tiles is a box of the high tile up to the line, and the low tile has none', () => {
    const groundAt = (x: number): number => (x < 0 ? 0.78 : 0)
    const highTile = boxesOf(buildGroundTile(groundAt, -1, 0, 1)).filter((b) => Math.abs(b[4] - 0.78) < 1e-9)
    expect(highTile.length).toBeGreaterThan(0)
    expect(Math.max(...highTile.map((b) => b[1]))).toBeCloseTo(0, 9)
    expect(buildGroundTile(groundAt, 0, 0, 1).boxes).toHaveLength(0)
  })
})
