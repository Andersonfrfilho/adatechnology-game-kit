import { createGroundRing } from './engine-ground-ring'
import { buildLowPyramid, reachOf } from './engine-ground-reach'

/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to a top close under the surface and never above it (§12). A block is split until a plane through its corners is within `SOLID_RELIEF` of the surface or it is
 * `SOLID_MIN_CELLS` cells wide. A level block is a box topped at its lowest ground less `SOLID_MARGIN`; a sloped block is one box turned to its corner plane, its top that
 * plane over the block and a cell past it each way (turned boxes side by side lean apart under their tops: what is pushed out sideways meets the next one), lowered by the
 * most any point of it, top or leaning side, rises over the ground under it (`engine-ground-reach`) and `SOLID_MARGIN`. Where it reaches past the tile, the ground there is
 * the neighbour's (`engine-ground-ring`), read up to `SOLID_RING` out; a box that would lean further is made shallower. Under the turned boxes, one upright box over the
 * whole tile up to its lowest ground holds what slips between them.
 * Every block is boxes: a sloped one used to be a prism (a convex hull each), and a crater tile's 400 hulls were most of the frame after the blast (T3.8ag).
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/** A top is this far (m) under the lowest ground it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. */
export const SOLID_MARGIN = 0.005
/** The thinnest (m) a turned box is made where it would lean past the ring: thinner, the block is split, or (at its smallest) left to its upright box. */
const SOLID_THINNEST = 0.05
/** How much (m) more a block's box must be lowered for the ground past the tile than for its own before the block is split, so a fold at the seam lowers a narrow box only. */
const SEAM_SPLIT = 0.01
/** Numbers per block in `SolidVolume.boxes`. */
export const SOLID_STRIDE = 10

export interface SolidVolume {
  /** The blocks: centre x, y, z, half x, y, z and turn x, y, z, w (`SOLID_STRIDE` numbers each); the box's own y is the normal of its top. */
  readonly boxes: readonly number[]
  /** The ground read past the tile's edges, x, z and height each (`engine-ground-ring`): the blocks are made again when one of these changes. */
  readonly ring: readonly number[]
}

export const NO_SOLID: SolidVolume = { boxes: [], ring: [] }

const unit = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

/** The quaternion of the turn whose columns are the axes `a` (x), `b` (y) and `c` (z). */
const quatOfAxes = (a: readonly number[], b: readonly number[], c: readonly number[]): [number, number, number, number] => {
  const m00 = a[0]!, m10 = a[1]!, m20 = a[2]!, m01 = b[0]!, m11 = b[1]!, m21 = b[2]!, m02 = c[0]!, m12 = c[1]!, m22 = c[2]!
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

/** How thick (m) a box whose bottom moves by `lean` per metre of thickness may be and stay within `lo`..`hi`, its top spanning `low`..`high` (no thickness when the top does not fit). */
const thickWithin = (lean: number, low: number, high: number, lo: number, hi: number): number => {
  if (low < lo || high > hi) return -Infinity
  return lean > 1e-12 ? (hi - high) / lean : lean < -1e-12 ? (low - lo) / -lean : Infinity
}

/**
 * The blocks under a tile of `cells` cells of side `cell` from (`x0`, `z0`), over its `heights` (`(cells + 1)^2`, x fastest), and the ground around it (`groundAt`, read
 * only past the tile's edges, up to `SOLID_RING`).
 */
export const buildSolidVolume = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number, groundAt: (x: number, z: number) => number): SolidVolume => {
  const m = cells + 1
  let low = Infinity
  for (const h of heights) low = Math.min(low, h)
  const bottom = low - SOLID_DEPTH
  const boxes: number[] = []
  const ring = createGroundRing(heights, cells, x0, z0, cell, groundAt)
  const reachTile = { heights, cells, x0, z0, cell, pyramid: buildLowPyramid(heights, cells, cell), ring }
  const outer = ring.cells * cell
  const loX = x0 - outer, hiX = x0 + cells * cell + outer, loZ = z0 - outer, hiZ = z0 + cells * cell + outer
  const halves = (a: number, b: number): ReadonlyArray<readonly [number, number]> => (b - a < 2 ? [[a, b]] : [[a, (a + b) >> 1], [(a + b) >> 1, b]])
  const at = (i: number, j: number): number => heights[j * m + i]!
  /** The slopes (per cell) of the plane through the block's corners. */
  const slopesOf = (i0: number, j0: number, i1: number, j1: number): [number, number] => [
    (at(i1, j0) - at(i0, j0) + at(i1, j1) - at(i0, j1)) / 2 / (i1 - i0),
    (at(i0, j1) - at(i0, j0) + at(i1, j1) - at(i1, j0)) / 2 / (j1 - j0),
  ]

  /** How far the surface rises above the plane through the block's corners lowered to its lowest sample: the block is split while it is more. */
  const planeGap = (i0: number, j0: number, i1: number, j1: number): number => {
    const [sx, sz] = slopesOf(i0, j0, i1, j1)
    let least = Infinity
    let most = -Infinity
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const above = at(i, j) - (at(i0, j0) + sx * (i - i0) + sz * (j - j0))
        if (above < least) least = above
        if (above > most) most = above
      }
    }
    return most - least
  }

  /** A level block: an upright box topped at its lowest ground less `SOLID_MARGIN`. */
  const level = (i0: number, j0: number, i1: number, j1: number, least: number): void => {
    const top = least - SOLID_MARGIN
    boxes.push(x0 + ((i0 + i1) / 2) * cell, (top + bottom) / 2, z0 + ((j0 + j1) / 2) * cell, ((i1 - i0) * cell) / 2, (top - bottom) / 2, ((j1 - j0) * cell) / 2, 0, 0, 0, 1)
  }

  /**
   * A sloped block: one box turned to the plane through its corners, its top the rectangle on that plane over the block and a cell past it each way, down to under the
   * solid's bottom, lowered by the most it rises over the ground anywhere (`reachOf`) and `SOLID_MARGIN`. A box that would lean past the ring is made as deep as stays in
   * it (the tile's floor is under it); a box lowered by more than the block's relief is the upright box alone. False when the block should be split instead: its box would not
   * fit the ring, or the ground past the tile lowers it much more than its own.
   */
  const sloped = (i0: number, j0: number, i1: number, j1: number, least: number, most: number): boolean => {
    const span = Math.max(i1 - i0, j1 - j0)
    const [sx, sz] = slopesOf(i0, j0, i1, j1)
    const gx = sx / cell
    const gz = sz / cell
    const ox = x0 + i0 * cell
    const oz = z0 + j0 * cell
    const base = at(i0, j0)
    const plane = (x: number, z: number): number => base + gx * (x - ox) + gz * (z - oz)
    const n = unit(-gx, 1, -gz)
    const ax = unit(1, gx, 0)
    const az: [number, number, number] = [ax[1] * n[2] - ax[2] * n[1], ax[2] * n[0] - ax[0] * n[2], ax[0] * n[1] - ax[1] * n[0]]
    const xa = ox, xb = x0 + i1 * cell, za = oz, zb = z0 + j1 * cell
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, cy = plane(cx, cz)
    let hx = 0
    let hz = 0
    for (const x of [xa, xb]) {
      for (const z of [za, zb]) {
        const d = [x - cx, plane(x, z) - cy, z - cz]
        hx = Math.max(hx, Math.abs(d[0]! * ax[0] + d[1]! * ax[1] + d[2]! * ax[2]))
        hz = Math.max(hz, Math.abs(d[0]! * az[0] + d[1]! * az[1] + d[2]! * az[2]))
      }
    }
    hx += cell
    hz += cell
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, highest = -Infinity
    for (const su of [-1, 1]) {
      for (const sw of [-1, 1]) {
        const qx = cx + su * hx * ax[0] + sw * hz * az[0]
        const qz = cz + su * hx * ax[2] + sw * hz * az[2]
        minX = Math.min(minX, qx)
        maxX = Math.max(maxX, qx)
        minZ = Math.min(minZ, qz)
        maxZ = Math.max(maxZ, qz)
        highest = Math.max(highest, cy + su * hx * ax[1] + sw * hz * az[1])
      }
    }
    // deep enough that the bottom face is under the solid's bottom everywhere, unless its bottom would lean (uphill: by -n per metre of thickness) past the ring
    const deep = (highest - bottom) / n[1]
    const fits = Math.min(thickWithin(-n[0], minX, maxX, loX, hiX), thickWithin(-n[2], minZ, maxZ, loZ, hiZ))
    const thick = Math.min(deep, fits)
    if (thick < SOLID_THINNEST) {
      if (span > SOLID_MIN_CELLS) return false
      level(i0, j0, i1, j1, least)
      return true
    }
    const hy = thick / 2
    const centre = [cx - n[0] * hy, cy - n[1] * hy, cz - n[2] * hy]
    const reach = reachOf({ c: centre, axes: [ax, n, az], half: [hx, hy, hz] }, reachTile)
    if (reach.ring > reach.tile + SEAM_SPLIT && span > SOLID_MIN_CELLS) return false
    const drop = SOLID_MARGIN + Math.max(reach.tile, reach.ring)
    // lowered further than the block's own relief, its top would be further under the ground than the upright box's
    if (drop - SOLID_MARGIN >= most - least) {
      level(i0, j0, i1, j1, least)
      return true
    }
    const q = quatOfAxes(ax, n, az)
    boxes.push(centre[0]!, centre[1]! - drop, centre[2]!, hx, hy, hz, q[0], q[1], q[2], q[3])
    return true
  }

  const fill = (i0: number, j0: number, i1: number, j1: number): void => {
    let least = Infinity
    let most = -Infinity
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const h = at(i, j)
        if (h < least) least = h
        if (h > most) most = h
      }
    }
    if (most - least <= SOLID_RELIEF) return level(i0, j0, i1, j1, least)
    const span = Math.max(i1 - i0, j1 - j0)
    if ((planeGap(i0, j0, i1, j1) > SOLID_RELIEF && span > SOLID_MIN_CELLS) || !sloped(i0, j0, i1, j1, least, most)) {
      for (const [a, b] of halves(i0, i1)) for (const [d, e] of halves(j0, j1)) fill(a, d, b, e)
    }
  }
  fill(0, 0, cells, cells)
  // under every turned box, one upright box over the whole tile up to its lowest ground: turned boxes side by side part under their tops (a cell's overlap closes
  // only so deep), and what is pushed out sideways into such a wedge is held there, not let through the solid's bottom
  if (boxes.some((_, k) => k % SOLID_STRIDE === 6 && boxes[k] !== 0)) level(0, 0, cells, cells, low)
  return { boxes, ring: ring.read }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
