import { describe, expect, it } from 'vitest'

import { SOLID_RING, createGroundRing } from '../src/engine-ground-ring'
import { buildLowPyramid, reachOf } from '../src/engine-ground-reach'

const CELLS = 80
const CELL = 0.025

/** A tile's heights from `ground` at its corners. */
const heightsOf = (ground: (x: number, z: number) => number): Float32Array => {
  const out = new Float32Array((CELLS + 1) ** 2)
  for (let j = 0; j <= CELLS; j++) for (let i = 0; i <= CELLS; i++) out[j * (CELLS + 1) + i] = ground(i * CELL, j * CELL)
  return out
}

/** The ground as the proof sees it: flat between the corners of a cell (bilinear), the tile's own heights inside and `ground`'s corners past its edges. */
const flatBetween = (heights: Float32Array, ground: (x: number, z: number) => number) => (x: number, z: number): number => {
  const i = Math.floor(x / CELL), j = Math.floor(z / CELL)
  const u = x / CELL - i, v = z / CELL - j
  const at = (a: number, b: number): number => (a >= 0 && b >= 0 && a <= CELLS && b <= CELLS ? heights[b * (CELLS + 1) + a]! : ground(a * CELL, b * CELL))
  return at(i, j) * (1 - u) * (1 - v) + at(i + 1, j) * u * (1 - v) + at(i, j + 1) * (1 - u) * v + at(i + 1, j + 1) * u * v
}

const unit = (v: readonly number[]): number[] => {
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
}

/** The highest point of the box on the vertical through (x, z) (slab method), or -Infinity. */
const highestAt = (c: readonly number[], axes: ReadonlyArray<readonly number[]>, h: readonly number[], x: number, z: number): number => {
  let low = -Infinity, high = Infinity
  for (let k = 0; k < 3 && low <= high; k++) {
    const a = axes[k]!
    const offset = (x - c[0]!) * a[0]! - c[1]! * a[1]! + (z - c[2]!) * a[2]!
    if (Math.abs(a[1]!) < 1e-12) {
      if (Math.abs(offset) > h[k]!) low = Infinity
      continue
    }
    const t0 = (-h[k]! - offset) / a[1]!, t1 = (h[k]! - offset) / a[1]!
    low = Math.max(low, Math.min(t0, t1))
    high = Math.min(high, Math.max(t0, t1))
  }
  return low <= high ? high : -Infinity
}

describe('how far a turned box rises over the ground (engine-ground-reach)', () => {
  // a ridge whose far side drops steeper than a box's leaning side, a crater, a fold at the tile's edge with a step down past it
  const grounds: Record<string, (x: number, z: number) => number> = {
    ridge: (x, z) => (x < 1 ? 0.6 * x : Math.max(-0.2, 0.6 - 2.5 * (x - 1))) + 0.05 * z,
    crater: (x, z) => -0.3 * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - 1, z - 1) / 0.6)) ** 2,
    seam: (x, z) => 0.8 * Math.min(2, x) + 0.3 * z - (x > 2.06 ? 0.3 : 0),
  }
  for (const [name, ground] of Object.entries(grounds)) {
    it(`${name}: never less than the most any column of the box, top or leaning side, rises over the ground`, () => {
      const heights = heightsOf(ground)
      const flat = flatBetween(heights, ground)
      let seed = 7
      const random = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
      let tried = 0
      while (tried < 60) {
        const gx = 2 * random() - 1, gz = 2 * random() - 1
        const n = unit([-gx, 1, -gz])
        const ax = unit([1, gx, 0])
        const az = [ax[1]! * n[2]! - ax[2]! * n[1]!, ax[2]! * n[0]! - ax[0]! * n[2]!, ax[0]! * n[1]! - ax[1]! * n[0]!]
        const half = [0.02 + 0.2 * random(), (0.05 + 0.6 * random()) / 2, 0.02 + 0.2 * random()]
        const tx = 0.1 + 1.8 * random(), tz = 0.1 + 1.8 * random()
        const top = [tx, flat(tx, tz) + 0.05 * (random() - 0.5), tz]
        const c = top.map((v, k) => v - n[k]! * half[1]!)
        const axes = [ax, n, az]
        const rx = half.reduce((r, s, k) => r + s * Math.abs(axes[k]![0]!), 0), rz = half.reduce((r, s, k) => r + s * Math.abs(axes[k]![2]!), 0)
        // the reader holds the ground SOLID_RING past the tile: boxes that reach further are not made (engine-ground-solid)
        if (c[0]! - rx < -SOLID_RING || c[0]! + rx > 2 + SOLID_RING || c[2]! - rz < -SOLID_RING || c[2]! + rz > 2 + SOLID_RING) continue
        tried++
        const ring = createGroundRing(heights, CELLS, 0, 0, CELL, ground)
        const reach = reachOf({ c, axes, half }, { heights, cells: CELLS, x0: 0, z0: 0, cell: CELL, pyramid: buildLowPyramid(heights, CELLS, CELL), ring })
        let most = 0
        for (let x = c[0]! - rx; x <= c[0]! + rx; x += 0.004) {
          for (let z = c[2]! - rz; z <= c[2]! + rz; z += 0.004) {
            const high = highestAt(c, axes, half, x, z)
            if (high > -Infinity) most = Math.max(most, high - flat(x, z))
          }
        }
        // a cell holding a step past the edge counts at its lowest sample: never less than the flat ground's
        expect(Math.max(reach.tile, reach.ring)).toBeGreaterThanOrEqual(most - 1e-6)
      }
    })
  }
})
