import { describe, expect, it } from 'vitest'

import { buildGroundMesh } from '../src/engine-ground'

const normals = (m: ReturnType<typeof buildGroundMesh>): Array<[number, number, number, number, number, number]> => {
  const out: Array<[number, number, number, number, number, number]> = []
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]].map((k) => [m.vertices[k * 3], m.vertices[k * 3 + 1], m.vertices[k * 3 + 2]])
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (Math.hypot(n[0], n[1], n[2]) > 1e-12) out.push([n[0], n[1], n[2], (a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1])])
  }
  return out
}

describe('engine ground', () => {
  it('keeps a slab edge a vertical face toward the low side, within a small cell of where it is', () => {
    // a 20 cm slab from x = 0.53 (not on a cell line) onward
    const m = buildGroundMesh((x) => (x >= 0.53 ? 0.2 : 0), 0, 0, 1)
    // the step is a wall (or, where it crosses a smallest cell, a face steeper than 85 degrees no wider than that cell), never a ramp
    const steep = normals(m).filter((n) => Math.abs(n[1]) < Math.hypot(n[0], n[2]) * Math.tan((5 * Math.PI) / 180))
    expect(steep.length).toBeGreaterThan(0)
    for (const w of steep) {
      expect(w[0]).toBeLessThan(0)
      expect(Math.abs(w[3] - 0.53)).toBeLessThan(0.0125)
    }
    for (const n of normals(m)) {
      const slope = Math.atan2(Math.hypot(n[0], n[2]), Math.abs(n[1]))
      expect(slope < 1e-6 || slope > (85 * Math.PI) / 180).toBe(true)
    }
  })

  it('a smooth bowl has no walls (only the faces under 1 cm that close a cut cell against an uncut one) and every face looks up', () => {
    const m = buildGroundMesh((x, z) => { const d = Math.hypot(x, z); return d < 1.2 ? -0.45 * (1 - (d / 1.2) ** 2) : 0 }, -1, -1, 2)
    for (const n of normals(m)) {
      expect(n[1]).toBeGreaterThanOrEqual(0)
      if (n[1] === 0) expect(n[5]).toBeLessThan(0.01)
    }
  })
})

describe('engine ground at a tile border', () => {
  it('a table side on the line between two tiles is a wall of the low tile, facing it', () => {
    const m = buildGroundMesh((x) => (x < 0 ? 0.78 : 0), 0, 0, 1)
    const walls = normals(m).filter((n) => Math.abs(n[1]) < 1e-9)
    expect(walls.length).toBeGreaterThan(0)
    for (const w of walls) expect(w[0]).toBeGreaterThan(0)
    // the high tile makes none
    expect(normals(buildGroundMesh((x) => (x < 0 ? 0.78 : 0), -1, 0, 1)).filter((n) => Math.abs(n[1]) < 1e-9)).toHaveLength(0)
  })
})
