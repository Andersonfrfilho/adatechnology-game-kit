import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { GROUND_CELL, buildGroundTile } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'
import { SOLID_RING } from '../src/engine-ground-ring'
import { collisionFieldOf } from '../src/engine-ground-collision'
import { NO_SOLID, SOLID_DEPTH, SOLID_MARGIN, SOLID_STRIDE } from '../src/engine-ground-solid'
import { PieceSystem } from '../src/pieces'
import type { PieceBody } from '../src/internal'
import { IS_JOLT, physicsOption } from './setup-physics'

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

/** `v` turned by the quaternion `q` (x, y, z, w). */
const turned = (q: readonly number[], v: readonly number[]): [number, number, number] => {
  const [x, y, z, w] = q as [number, number, number, number]
  const [vx, vy, vz] = v as [number, number, number]
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
}

interface Top {
  readonly t: readonly number[]
  readonly n: readonly number[]
  readonly ax: readonly number[]
  readonly az: readonly number[]
  readonly hx: number
  readonly hz: number
}

/** The top face of every block: its centre, normal, in-plane axes and half sizes (made once per tile: the lattices ask thousands of times). */
const topsOf = (() => {
  const made = new WeakMap<GroundTile, Top[]>()
  return (t: GroundTile): Top[] => {
    const kept = made.get(t)
    if (kept) return kept
    const b = Array.from(t.solid.boxes)
    const tops: Top[] = []
    for (let i = 0; i < b.length; i += SOLID_STRIDE) {
      const q = b.slice(i + 6, i + 10)
      const n = turned(q, [0, 1, 0])
      const hy = b[i + 4]!
      tops.push({ t: [b[i]! + n[0] * hy, b[i + 1]! + n[1] * hy, b[i + 2]! + n[2] * hy], n, ax: turned(q, [1, 0, 0]), az: turned(q, [0, 0, 1]), hx: b[i + 3]!, hz: b[i + 5]! })
    }
    made.set(t, tops)
    return tops
  }
})()

/** The highest solid top under (x, z), or -Infinity: where the vertical through it crosses the top face of a block (a box turned to its top's normal). */
const solidTopAt = (t: GroundTile, x: number, z: number): number => {
  let top = -Infinity
  for (const { t: c, n, ax, az, hx, hz } of topsOf(t)) {
    const y = c[1]! - (n[0]! * (x - c[0]!) + n[2]! * (z - c[2]!)) / n[1]!
    const dx = x - c[0]!, dy = y - c[1]!, dz = z - c[2]!
    if (Math.abs(dx * ax[0]! + dy * ax[1]! + dz * ax[2]!) <= hx + 1e-9 && Math.abs(dx * az[0]! + dy * az[1]! + dz * az[2]!) <= hz + 1e-9 && y > top) top = y
  }
  return top
}

/** Every block's centre, axes and half sizes (made once per tile). */
const blocksOf = (() => {
  const made = new WeakMap<GroundTile, Array<{ readonly c: readonly number[]; readonly axes: ReadonlyArray<readonly number[]>; readonly h: readonly number[]; readonly rx: number; readonly rz: number }>>()
  return (t: GroundTile) => {
    const kept = made.get(t)
    if (kept) return kept
    const b = Array.from(t.solid.boxes)
    const out: Array<{ c: number[]; axes: number[][]; h: number[]; rx: number; rz: number }> = []
    for (let i = 0; i < b.length; i += SOLID_STRIDE) {
      const q = b.slice(i + 6, i + 10)
      const axes = [turned(q, [1, 0, 0]), turned(q, [0, 1, 0]), turned(q, [0, 0, 1])]
      const h = b.slice(i + 3, i + 6)
      // how far the box reaches from its centre along x and z (its shadow's extent)
      const rx = axes.reduce((r, a, k) => r + h[k]! * Math.abs(a[0]!), 0), rz = axes.reduce((r, a, k) => r + h[k]! * Math.abs(a[2]!), 0)
      out.push({ c: b.slice(i, i + 3), axes, h, rx, rz })
    }
    made.set(t, out)
    return out
  }
})()

/** The highest point of any block on the vertical through (x, z) (a side or an edge as much as a top), or -Infinity where none is crossed. */
const highestAt = (t: GroundTile, x: number, z: number): number => {
  let best = -Infinity
  for (const { c, axes, h, rx, rz } of blocksOf(t)) {
    if (Math.abs(x - c[0]!) > rx + 1e-9 || Math.abs(z - c[2]!) > rz + 1e-9) continue
    let low = -Infinity
    let high = Infinity
    for (let k = 0; k < 3 && low <= high; k++) {
      const a = axes[k]!
      const offset = (x - c[0]!) * a[0]! - c[1]! * a[1]! + (z - c[2]!) * a[2]!
      if (Math.abs(a[1]!) < 1e-12) {
        if (Math.abs(offset) > h[k]! + 1e-9) low = Infinity
        continue
      }
      const t0 = (-h[k]! - offset) / a[1]!, t1 = (h[k]! - offset) / a[1]!
      low = Math.max(low, Math.min(t0, t1))
      high = Math.min(high, Math.max(t0, t1))
    }
    if (low <= high && high > best) best = high
  }
  return best
}

/** The lowest corner of any block. */
const lowestSolid = (t: GroundTile): number => {
  let low = Infinity
  const b = Array.from(t.solid.boxes)
  for (let i = 0; i < b.length; i += SOLID_STRIDE) {
    const q = b.slice(i + 6, i + 10)
    for (let k = 0; k < 8; k++) {
      const c = turned(q, [(k & 1 ? 1 : -1) * b[i + 3]!, (k & 2 ? 1 : -1) * b[i + 4]!, (k & 4 ? 1 : -1) * b[i + 5]!])
      low = Math.min(low, b[i + 1]! + c[1])
    }
  }
  return low
}

/** The largest gap from the ground down to the top of the solid over a lattice of the tile, and the smallest (negative: the solid above the ground); NaN where nothing covers. */
const gapsOf = (t: GroundTile, ground: (x: number, z: number) => number, x0: number, z0: number): { most: number; least: number; holes: number } => {
  let most = -Infinity, least = Infinity, holes = 0
  for (let x = x0 + 0.004; x < x0 + 2; x += 0.013) {
    for (let z = z0 + 0.004; z < z0 + 2; z += 0.017) {
      const top = solidTopAt(t, x, z)
      if (top === -Infinity) holes++
      const gap = ground(x, z) - top
      most = Math.max(most, gap)
      least = Math.min(least, gap)
    }
  }
  return { most, least, holes }
}

/**
 * The engine's collision surface at (x, z) of a tile at (x0, z0): its coarser field (`GroundTile.collision`), flat on each of a cell's two triangles; `pick` the lower or the
 * higher of the two ways the cell may be cut (the engine uses one of them).
 */
const collisionSurface = (t: GroundTile, x0: number, z0: number, x: number, z: number, pick: (a: number, b: number) => number): number => {
  const n = t.collisionCells
  const cell = 2 / n
  const fx = Math.min(n - 1e-9, Math.max(0, (x - x0) / cell)), fz = Math.min(n - 1e-9, Math.max(0, (z - z0) / cell))
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
  const h = (a: number, b: number): number => t.collision[(j + b) * (n + 1) + i + a]!
  const main = u >= v ? h(0, 0) + u * (h(1, 0) - h(0, 0)) + v * (h(1, 1) - h(1, 0)) : h(0, 0) + v * (h(0, 1) - h(0, 0)) + u * (h(1, 1) - h(0, 1))
  const cross = u + v <= 1 ? h(0, 0) + u * (h(1, 0) - h(0, 0)) + v * (h(0, 1) - h(0, 0)) : h(1, 1) + (1 - u) * (h(0, 1) - h(1, 1)) + (1 - v) * (h(1, 0) - h(1, 1))
  return pick(main, cross)
}

describe('solid under the height field', { timeout: 30000 }, () => {
  const rolling = (x: number, z: number): number => 0.02 * Math.sin(1.7 * x) * Math.cos(1.3 * z) + 0.03 * x
  const bowl = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    return d < 1.2 ? -0.45 * (1 - (d / 1.2) ** 2) : 0
  }

  const crater = (x: number, z: number): number => {
    const d = Math.hypot(x - 1, z - 1)
    return d >= 0.6 ? 0 : -0.3 * Math.cos((Math.PI / 2) * (d / 0.6)) ** 2
  }
  const planar = (x: number, z: number): number => 0.2 * x + 0.05 * z

  /**
   * Under the surface by at least `SOLID_MARGIN` everywhere (to the ground's own rounding: its samples are floats and the ground between them is flat), every point of every
   * block too, the whole tile covered, the top within `most` of the surface (within `inner` of it more than 0.4 m from the tile's edges), and as deep as `SOLID_DEPTH` under the
   * lowest sample.
   */
  const expectNet = (t: GroundTile, ground: (x: number, z: number) => number, x0: number, z0: number, gap: { readonly most: number; readonly inner?: number }): void => {
    const gaps = gapsOf(t, ground, x0, z0)
    expect(gaps.holes).toBe(0)
    expect(gaps.least).toBeGreaterThan(SOLID_MARGIN - 0.0006)
    expect(gaps.most).toBeLessThan(gap.most)
    for (let x = x0 + 0.004; x < x0 + 2; x += 0.019) {
      for (let z = z0 + 0.004; z < z0 + 2; z += 0.023) {
        // a slab's edge or lean is no higher over the ground than its top, and no higher than SOLID_MARGIN under the engine's coarser collision surface either
        expect(ground(x, z) - highestAt(t, x, z)).toBeGreaterThan(SOLID_MARGIN - 0.0006)
        expect(collisionSurface(t, x0, z0, x, z, Math.min) - highestAt(t, x, z)).toBeGreaterThan(SOLID_MARGIN - 1e-5)
        if (gap.inner !== undefined && Math.min(x - x0, z - z0, x0 + 2 - x, z0 + 2 - z) > 0.4) expect(ground(x, z) - solidTopAt(t, x, z)).toBeLessThan(gap.inner)
      }
    }
    expect(lowestSolid(t)).toBeLessThanOrEqual(Math.min(...t.heights) - SOLID_DEPTH + 1e-9)
  }

  /**
   * The most the collision surface (either diagonal) is off the drawn ground, the read grid (`heights`), over the tile: at its corners, since both are flat on each read
   * triangle (a read cell's triangles lie inside the collision cell's).
   */
  const offOf = (t: GroundTile, x0: number, z0: number): number => {
    let most = 0
    const m = t.cells + 1, cell = 2 / t.cells
    for (let j = 0; j <= t.cells; j++) {
      for (let i = 0; i <= t.cells; i++) {
        const x = x0 + i * cell, z = z0 + j * cell, drawn = t.heights[j * m + i]!
        most = Math.max(most, Math.abs(collisionSurface(t, x0, z0, x, z, Math.min) - drawn), Math.abs(collisionSurface(t, x0, z0, x, z, Math.max) - drawn))
      }
    }
    return most
  }

  // owner decision 2026-11-17: the engine collides with a 5 cm field of the 2.5 cm read grid where that is within 5 mm of the drawn ground over the whole tile (with the
  // engine's 8 bit steps) and the tile has no step; else with the read grid itself
  it('a smooth tile collides at a 5 cm field of its read corners, within 5 mm of the drawn ground; one whose coarse field would be further keeps the read grid', () => {
    for (const [ground, x0, z0] of [[crater, 0, 0], [rolling, 0, 0]] as const) {
      const t = buildGroundTile(ground, x0, z0, 2)
      expect(t.collisionCells).toBe(t.cells / 2)
      expect(2 / t.collisionCells).toBeCloseTo(0.05, 12)
      for (let j = 0; j <= t.collisionCells; j++) for (let i = 0; i <= t.collisionCells; i++) expect(t.collision[j * (t.collisionCells + 1) + i]).toBe(t.heights[2 * j * (t.cells + 1) + 2 * i])
      expect(offOf(t, x0, z0)).toBeLessThan(0.005)
    }
    // the bowl's rim is a crease (its slope drops from 0.75 to 0 at 1.2 m): a 5 cm field would be 12.4 mm off across it, so the tile keeps the 2.5 cm one
    const t = buildGroundTile(bowl, -1, -1, 2)
    expect(t.collisionCells).toBe(t.cells)
    expect(t.collision).toBe(t.heights)
  })

  // mountains: a slope is planar however steep, and a mountain's ridge or valley bends over tens of metres, so a 5 cm field is the drawn ground to well under 5 mm; a ridge
  // or a ravine sharp as a crease bends inside one cell, and its tile keeps the 2.5 cm field
  it('mountains: steep planes, smooth ridges and valleys keep the 5 cm field within 5 mm; a sharp ridge or ravine keeps the read grid', () => {
    const cases: ReadonlyArray<readonly [string, (x: number, z: number) => number, boolean]> = [
      ['plane 0.8 along both axes', (x, z) => 0.8 * x + 0.8 * z, true],
      ['plane 0.8 along x only', (x) => 0.8 * x, true],
      ['ridge, 7 m radius', (x, z) => 1.5 + 0.5 * x - (z - 1) ** 2 / 14, true],
      ['valley, 7 m radius, steep sides', (x, z) => 0.6 * z + (x - 1.01) ** 2 / 14, true],
      ['sharp ridge', (x) => 1 - 0.8 * Math.abs(x - 1.0137), false],
      ['sharp ravine', (x, z) => 0.3 * x + 0.9 * Math.abs(z - 0.9871), false],
      // a 0.5 slope meeting a level floor in a crease is within 4.5 mm at 5 cm (a fresh tile's bar, `COLLISION_ENTER`); a 0.75 one is not even within 5 mm, and is no step
      // either: the bound alone keeps the read grid
      ['0.5 slope onto a level floor', (x) => 0.5 * Math.max(0, 1.0137 - x), true],
      ['0.75 slope onto a level floor', (x) => 0.75 * Math.max(0, 1.0137 - x), false],
    ]
    const kept: string[] = []
    for (const [name, ground, smooth] of cases) {
      const t = buildGroundTile(ground, 0, 0, 2)
      // a crease sharp enough is read as a step too (its boxes), which alone keeps the read grid
      if (smooth) expect(t.boxes, name).toHaveLength(0)
      if (t.collisionCells === t.cells / 2) {
        kept.push(name)
        expect(offOf(t, 0, 0), name).toBeLessThan(0.005)
      } else expect(t.collision, name).toBe(t.heights)
      expect(t.collisionCells === t.cells / 2, name).toBe(smooth)
    }
    if (process.env.MOUNTAINS) console.log('MOUNTAINS kept 5 cm:', kept.join(', '))
  })

  // between the bars a tile keeps the field it had: one near the bound does not change field (a new shape on its body) at every change of its ground
  it('a tile between 4.5 and 5 mm off at 5 cm keeps the field it had: a fresh one takes the read grid, one that was on 5 cm stays; past 5 mm none keeps 5 cm', () => {
    const fieldOf = (slope: number, wasCoarse: boolean): number => {
      const t = buildGroundTile((x) => slope * Math.max(0, 1.0137 - x), 0, 0, 2)
      return collisionFieldOf(t.heights, t.cells, 2 / t.cells, false, wasCoarse).step
    }
    // 4.71 and 4.93 mm off at 5 cm (the bars: COLLISION_ENTER 4.5, COLLISION_TOLERANCE 5)
    for (const slope of [0.65, 0.68]) {
      expect(fieldOf(slope, false), `${slope}`).toBe(1)
      expect(fieldOf(slope, true), `${slope}`).toBe(2)
    }
    // 5.07 mm: past the hard bound; 4.35 mm: under the bar a fresh tile takes
    expect(fieldOf(0.7, true)).toBe(1)
    expect(fieldOf(0.6, false)).toBe(2)
  })

  // a terrace's wall between two read corners, at each place in a cell along x and along z: a coarser field would ramp up the wall (14 cm over the floor and the box) or
  // groove beside it (15 cm); a tile with a step keeps the read grid, whose surface is never above the floor or the box's top, nor under the floor where there is no box
  it('a terrace step anywhere in a cell: the tile keeps the read grid, and its collision surface is neither above the floor and the box nor a groove beside them', () => {
    for (const along of ['x', 'z'] as const) {
      for (const offset of [0.006, 0.0113, 0.0187, 0.0013]) {
        const wall = 1 + offset
        const ground = (x: number, z: number): number => ((along === 'x' ? x : z) < wall ? 0.3 : 0)
        const t = buildGroundTile(ground, 0, 0, 2)
        expect(t.boxes.length).toBeGreaterThan(0)
        expect(t.collisionCells).toBe(t.cells)
        const boxTop = (x: number, z: number): number => {
          let top = -Infinity
          for (let i = 0; i < t.boxes.length; i += 6) if (Math.abs(x - t.boxes[i]!) <= t.boxes[i + 3]! && Math.abs(z - t.boxes[i + 2]!) <= t.boxes[i + 5]!) top = Math.max(top, t.boxes[i + 1]! + t.boxes[i + 4]!)
          return top
        }
        for (let u = 0.9; u < 1.1; u += 0.0007) {
          for (const w of [0.5013, 1.2007]) {
            const [x, z] = along === 'x' ? [u, w] : [w, u]
            const drawn = ground(x, z), top = boxTop(x, z)
            expect(collisionSurface(t, 0, 0, x, z, Math.max)).toBeLessThanOrEqual(Math.max(drawn, top) + 0.005)
            if (top === -Infinity) expect(collisionSurface(t, 0, 0, x, z, Math.min)).toBeGreaterThanOrEqual(drawn - 0.005)
          }
        }
      }
    }
  })

  // the flat boxes of T3.8ag's first take left 3.5 cm here, 12 cm in the bowl, 7.9 cm on the crater wall and 50 cm under the high side of a plane, everywhere on it
  it('is under the surface everywhere and within 1 cm of it on a gentle ground', () => {
    const t = buildGroundTile(rolling, 0, 0, 2)
    expect(t.solid.boxes.length).toBeGreaterThan(0)
    expectNet(t, rolling, 0, 0, { most: 0.01 + 0.0006 })
  })

  // the turned box reaches past the tile's edges over the neighbour's ground (read up to SOLID_RING out), so a plane is SOLID_MARGIN under the ground at the edges too
  it('a plane, sloped along one axis or both: SOLID_MARGIN under the ground over the whole tile, its edges too', () => {
    const plane = (x: number, z: number): number => 0.6 * x + 0.5 * z
    for (const ground of [planar, plane]) expectNet(buildGroundTile(ground, 0, 0, 2), ground, 0, 0, { most: SOLID_MARGIN + 1e-5 })
    // one turned box and its block's upright box under it (06e05d340 was one box; the slab and floor of a730b5450 were 104)
    expect(buildGroundTile(planar, 0, 0, 2).solid.boxes.length / SOLID_STRIDE).toBe(2)
  })

  it('never sticks out above a steep bowl or crater wall, and stays close under them; level ground has none (its slab is solid already)', () => {
    // the bowl's edges are its steepest ground (0.74): its boxes there lean furthest past the tile
    expectNet(buildGroundTile(bowl, -1, -1, 2), bowl, -1, -1, { most: 0.05 })
    // the crater's wall bends under the smallest blocks, and a box is lowered for every cell its top reaches (2.7 cm, as 06e05d340), and under the collision field where it
    // dips under the drawn ground (the 5 cm field: 2.74 cm)
    const t = buildGroundTile(crater, 0, 0, 2)
    expectNet(t, crater, 0, 0, { most: 0.03 })
    // a block is one box (06e05d340: 364), and a sloped one has its upright box under its turned one
    const turnedCount = t.solid.boxes.filter((_, k) => k % SOLID_STRIDE === 9 && t.solid.boxes[k] !== 1).length
    expect(t.solid.boxes.length / SOLID_STRIDE).toBe(364 + turnedCount)
    expect(buildGroundTile(() => 0.3, 0, 0, 2).solid).toEqual(NO_SOLID)
  })

  // a turned box leans uphill under its top: past a ridge whose far side drops steeper (2.5) than its sides do (1 / 0.6), they are looked for under the ground there too
  it('a ridge with a steep far side: no leaning side of the boxes on its near slope is above the far side', () => {
    const ridge = (x: number, z: number): number => (x < 1 ? 0.6 * x : Math.max(-0.2, 0.6 - 2.5 * (x - 1))) + 0.05 * z
    expectNet(buildGroundTile(ridge, 0, 0, 2), ridge, 0, 0, { most: 0.45 })
  })

  /**
   * Over strips past every edge of the tile, `SOLID_RING` wide and 2 cm more: no point of the net, top, edge or leaning side (the highest point of every column, `highestAt`),
   * is above the ground there less SOLID_MARGIN, and nothing of it is past `SOLID_RING`. Inside the tile, `expectNet`'s check that nothing is above the ground.
   */
  const expectUnderNeighbours = (t: GroundTile, ground: (x: number, z: number) => number): void => {
    const out = SOLID_RING + 0.02
    for (let x = -out; x < 2 + out; x += 0.0043) {
      const inside = x > 0 && x < 2
      for (let z = -out; z < 2 + out; z += inside && z > -0.0001 && z < 2 ? 2 - z + 0.0001 : 0.0127) {
        const top = highestAt(t, x, z)
        if (Math.min(x, z, 2 - x, 2 - z) < -SOLID_RING - 1e-6) expect(top).toBe(-Infinity)
        else expect(ground(x, z) - top).toBeGreaterThan(SOLID_MARGIN - 0.0006)
      }
    }
  }

  it('past the tile, over the neighbour\'s ground: flat past a fold, a step down at the seam, a plane turned about both axes, a crater on the edge or the corner', () => {
    const cases: Array<(x: number, z: number) => number> = []
    // the ground bends at the tile's edge (x = 2): 0.8 up along x on the tile, flat past it, or a step 30 cm down at the seam; with a slope along z too, so the boxes turn about both axes
    for (const along of [0, 0.4]) for (const step of [0, 0.3]) cases.push((x, z) => 0.8 * Math.min(2, x) + along * z - (x > 2 ? step : 0))
    // a plane turned about both axes, flat past every edge; a slope whose low side (x < 0) has a step 30 cm down
    cases.push((x, z) => 0.6 * Math.min(2, Math.max(0, x)) + 0.5 * Math.min(2, Math.max(0, z)))
    cases.push((x, z) => 0.5 * x + 0.1 * z - (x < 0 ? 0.3 : 0))
    // a crater whose middle is on the edge, and one on the corner, on a gentle roll
    const dent = (cx: number, cz: number) => (x: number, z: number): number => rolling(x, z) - 0.3 * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - cx, z - cz) / 0.6)) ** 2
    cases.push(dent(2, 1), dent(2, 2), dent(0, 0))
    for (const ground of cases) {
      const t = buildGroundTile(ground, 0, 0, 2)
      expectUnderNeighbours(t, ground)
      expectNet(t, ground, 0, 0, { most: 0.35 })
    }
  })

  // the ring takes a cell for a step as the neighbour does (`holdsStep`: its centre and the middles of its edges), so a pit only an edge's middle falls in counts
  it('past the tile, a 5 cm pit 1.5 by 1 cm around the middle of a cell edge: no point of the net above it', () => {
    const pit = (x: number, z: number): number => 0.5 * x + 0.1 * z - (Math.abs(x - 2.0125) < 0.0075 && Math.abs(z - 1) < 0.005 ? 0.05 : 0)
    const t = buildGroundTile(pit, 0, 0, 2)
    for (let x = 2.0001; x < 2.025; x += 0.0007) for (let z = 0.9951; z < 1.005; z += 0.0007) expect(pit(x, z) - highestAt(t, x, z)).toBeGreaterThan(SOLID_MARGIN - 0.0006)
  })

  it('a slope with a step down going uphill (step boxes on the tile): no point of the net above the drawn ground', () => {
    const stepped = (x: number, z: number): number => 0.5 * x + 0.1 * z - (x >= 1.2 ? 0.3 : 0)
    const t = buildGroundTile(stepped, 0, 0, 2)
    expect(t.boxes.length).toBeGreaterThan(0)
    for (let x = 0.004; x < 2; x += 0.007) for (let z = 0.004; z < 2; z += 0.019) expect(stepped(x, z) - highestAt(t, x, z)).toBeGreaterThan(SOLID_MARGIN - 0.0006)
  })

  it('follows the ground when it is dug: made again from the new heights, still under it, within 2.5 cm of it', () => {
    let depth = 0
    const dug = (x: number, z: number): number => rolling(x, z) - depth * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - 1, z - 1) / 0.8)) ** 2
    const before = buildGroundTile(dug, 0, 0, 2)
    depth = 0.3
    const after = buildGroundTile(dug, 0, 0, 2)
    expect(after.solid.boxes).not.toEqual(before.solid.boxes)
    // a 30 cm dig 1.6 m wide is no gentle ground: its bowl bends under the smallest blocks, each slab lowered for every cell it reaches (the prisms of before held 1 cm here)
    expectNet(after, dug, 0, 0, { most: 0.025 })
  })
})

interface Probe {
  readonly system: PieceSystem
  readonly root: THREE.Object3D
  readonly piece: PieceBody
  readonly world: PhysicsWorld
  /** The ground the system stands on: replaced by the test when the ground changes. */
  readonly ground: { at: (x: number, z: number) => number }
}

const rollingGround = (raise: number) => (x: number, z: number): number => raise + 0.01 * Math.sin(2 * x) * Math.sin(2 * z)
const HALF: [number, number, number] = [0.3, 0.02, 0.3]
const THIN = HALF[1]

/** A 4 cm thick plate on a gently rolling ground that can be raised as a whole: a height field tile, not a slab. */
const plateOnRolling = (y: number, speed = 0): Probe => {
  const ground = { at: rollingGround(0) }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x, z) => ground.at(x, z), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const root = new THREE.Object3D()
  root.position.set(0.3, y, 0.3)
  const piece = system.create('plate', root, HALF, new THREE.Vector3(), 3)
  piece.velocity[1] = -speed
  return { system, root, piece, world: (system as unknown as { engine: { world: PhysicsWorld } }).engine.world, ground }
}

const fellThroughOf = (p: Probe): number => (p.system as unknown as { engine: { fellThrough: number } }).engine.fellThrough
/** The highest ground under the plate's four corners (it lies flat): where its underside rests. */
const restingTop = (p: Probe): number => Math.max(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => p.ground.at(p.root.position.x + sx * HALF[0], p.root.position.z + sz * HALF[2]))))
const run = (p: Probe, frames: number): number => {
  let lowest = Infinity
  for (let i = 0; i < frames; i++) {
    p.system.update(1 / 60)
    lowest = Math.min(lowest, p.root.position.y)
  }
  return lowest
}

describe.skipIf(!IS_JOLT)('solid ground in the engine', () => {
  it('ground that rises 5 cm under a sleeping plate leaves it on top, never inside or under, and fellThrough stays 0', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    expect(p.piece.sleeping).toBe(true)
    p.ground.at = rollingGround(0.05)
    p.system.wakeRegion(0.3, 0.3, 3)
    const lowest = run(p, 240)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(p.root.position.y).toBeCloseTo(restingTop(p) + THIN, 1)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('the same when the host never says so: a sleeping piece looks at the ground under it and wakes when it rose', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    p.ground.at = rollingGround(0.05)
    const lowest = run(p, 600)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('a thin plate shot down through the surface at 40 m/s ends on it, not under it', () => {
    const p = plateOnRolling(1, 40)
    const lowest = run(p, 240)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('a plate the engine finds wholly under the surface (put there directly, as a tunnelled one is) is held by the solid: it does not fall on, and fellThrough stays 0', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const engine = (p.system as unknown as { engine: { links: Map<PieceBody, { id: BodyId }> } }).engine
    const put = restingTop(p) - 0.04
    p.world.setPose(engine.links.get(p.piece)!.id, [0.3, put, 0.3], [0, 0, 0, 1], true)
    const lowest = run(p, 120)
    expect(lowest).toBeGreaterThan(put - 0.01)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('under the height field every tile has a solid body that follows a dig: its top stays under the surface, within 1 cm, and the plate dropped into the pit lands in it', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const tiles = (p.system as unknown as { engine: { tiles: Map<number, { solid: BodyId | null; ground: BodyId }> } }).engine.tiles
    const solidTops = (x: number, z: number): number[] => {
      const hits: RayHit[] = []
      p.world.rayAll([x, 3, z], [0, -1, 0], 6, hits)
      const solids = new Set([...tiles.values()].map((t) => t.solid))
      return hits.filter((h) => solids.has(h.body)).map((h) => 3 - h.distance)
    }
    const before = solidTops(0.7, 0.9)
    expect(before.length).toBeGreaterThan(0)
    // dug 20 cm deep around (0.7, 0.9): under the plate, which wakes
    const dug = (x: number, z: number): number => rollingGround(0)(x, z) - 0.2 * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - 0.7, z - 0.9) / 1)) ** 2
    p.ground.at = dug
    p.system.wakeRegion(0.7, 0.9, 1.2)
    run(p, 120)
    const after = solidTops(0.7, 0.9)
    expect(Math.max(...after)).toBeLessThanOrEqual(dug(0.7, 0.9) + 0.001)
    expect(dug(0.7, 0.9) - Math.max(...after)).toBeLessThan(0.025)
    expect(Math.max(...after)).toBeLessThan(Math.max(...before) - 0.1)
    expect(p.root.position.y).toBeLessThan(0.1)
  })

  it('laying the ground again and again leaks nothing: the heap and the body count are the same after every round', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const round = (k: number): void => {
      p.ground.at = (x, z) => 0.01 * Math.sin(2 * x) * Math.sin(2 * z) + 0.02 * (k % 2) * Math.sin(3 * x)
      p.system.wakeRegion(0.3, 0.3, 4)
      run(p, 12)
    }
    // two grounds in turn: the heap holds what the current shapes are (a compound's size follows its children), so it is compared at the same ground; the contacts
    // of the plate move it by a hundred bytes either way, and one leaked solid is 39 KB a round, 1.5 MB over the 40
    for (let k = 0; k < 4; k++) round(k)
    const bytes = p.world.memoryInUse()
    const bodies = p.world.bodyCount
    for (let k = 4; k < 44; k++) round(k)
    expect(p.world.bodyCount).toBe(bodies)
    expect(Math.abs(p.world.memoryInUse() - bytes)).toBeLessThan(4096)
  })

  it('a 45 m wire lying across the ground lays the tiles under it, not the circle around it (a 480 ms update in the room), and a thin piece still has ground under every point of it (T3.8b)', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    const root = new THREE.Object3D()
    root.position.set(0, 0.02, 0)
    // 22.7 m each way along a diagonal of the ground, 4 cm thick, lying
    root.rotation.set(0, Math.PI / 4, 0)
    const piece = system.create('wire', root, [22.675, 0.02, 0.02], new THREE.Vector3(), 12)
    system.update(1 / 60)
    const tiles = (system as unknown as { engine: { tiles: Map<number, unknown> } }).engine.tiles
    // the circle around it is 24 x 24 = 576+ tiles; the diagonal strip is about 2 x 23
    expect(tiles.size).toBeLessThan(80)
    expect(tiles.size).toBeGreaterThan(20)
    // every point along the wire is over a laid tile (the key is column and row of a 2 m tile)
    const laid = (x: number, z: number): boolean => tiles.has((Math.floor(x / 2) + 32768) * 65536 + (Math.floor(z / 2) + 32768))
    const along = Math.SQRT1_2
    for (let d = -22.6; d <= 22.6; d += 0.5) expect(laid(d * along, -d * along) || laid(d * along, d * along)).toBe(true)
    expect(piece.mass).toBe(12)
  })

  it('with tilesUnderParts, a piece of two far parts (a pole and the wire span it hung) lays the tiles under each part, not the 20 m of ground between them (T3.8v)', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), tilesUnderParts: true })
    const root = new THREE.Object3D()
    root.position.set(0, 0.02, 0)
    const piece = system.create('span', root, [10.1, 0.02, 1], new THREE.Vector3(), 9)
    piece.partBoxes = [
      { center: [-10, 0, 0], half: [0.1, 0.02, 0.1] },
      { center: [10, 0, 0], half: [0.1, 0.02, 0.1] },
    ]
    system.update(1 / 60)
    const tiles = (system as unknown as { engine: { tiles: Map<number, unknown> } }).engine.tiles
    const laid = (x: number, z: number): boolean => tiles.has((Math.floor(x / 2) + 32768) * 65536 + (Math.floor(z / 2) + 32768))
    expect(laid(-10, 0)).toBe(true)
    expect(laid(10, 0)).toBe(true)
    expect(laid(0, 0)).toBe(false)
    expect(laid(-5, 0)).toBe(false)
    // the box of the whole piece, 20 m by 2 m, was 11 tiles a row and more: two parts of 0.2 m are a few tiles each
    expect(tiles.size).toBeLessThan(14)
  })

  it('without tilesUnderParts the same piece lays the ground under the box of the whole piece, as it always did', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    const root = new THREE.Object3D()
    root.position.set(0, 0.02, 0)
    const piece = system.create('span', root, [10.1, 0.02, 1], new THREE.Vector3(), 9)
    piece.partBoxes = [
      { center: [-10, 0, 0], half: [0.1, 0.02, 0.1] },
      { center: [10, 0, 0], half: [0.1, 0.02, 0.1] },
    ]
    system.update(1 / 60)
    const tiles = (system as unknown as { engine: { tiles: Map<number, unknown> } }).engine.tiles
    expect(tiles.has((Math.floor(0 / 2) + 32768) * 65536 + (Math.floor(0 / 2) + 32768))).toBe(true)
    expect(tiles.size).toBeGreaterThan(20)
  })
})
