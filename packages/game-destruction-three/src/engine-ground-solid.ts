import { coarseStep, underBoth } from './engine-ground-collision'
import { createGroundRing } from './engine-ground-ring'
import { buildLowPyramid, reachOf } from './engine-ground-reach'

/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to a top close under the surface and never above it (§12). A block is split until a plane through its corners is within `SOLID_RELIEF` of the surface or it is
 * `SOLID_MIN_CELLS` cells wide. A level block is a box topped at its lowest ground less `SOLID_MARGIN`; a sloped block is one box turned to its corner plane, its top that
 * plane over the block and a cell past it each way (turned boxes side by side lean apart under their tops: what is pushed out sideways meets the next one), lowered by the
 * most any point of it, top or leaning side, rises over the ground under it (`engine-ground-reach`) and `SOLID_MARGIN`. Where it reaches past the tile, the ground there is
 * the neighbour's (`engine-ground-ring`), read up to `SOLID_RING` out; a box that would lean further is made shallower. Under each turned box is its block's upright box
 * (topped at the block's lowest ground less `SOLID_MARGIN`): turned boxes side by side part under their tops, and what slips between them rests on it, its top no further
 * under the ground than the block's relief and its own size.
 * Every block is boxes: a sloped one used to be a prism (a convex hull each), and a crater tile's 400 hulls were most of the frame after the blast (T3.8ag).
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/**
 * A top is this far (m) under the lowest ground it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. The engine
 * holds a height field's samples in 8 bit steps of each 4-sample block's range, up to half a step off (range / 510: 0.15 mm on a 0.75 slope at 2.5 cm, 0.3 mm at 5 cm), well
 * inside this margin.
 */
export const SOLID_MARGIN = 0.005
/** The thinnest (m) a turned box is made; where that would lean past the ring, the block is split, or (at its smallest) left to its upright box. */
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

/** The unit vector along (x, y, z), into `out`. */
const unitInto = (out: Float64Array, x: number, y: number, z: number): Float64Array => {
  const l = Math.hypot(x, y, z)
  out[0] = x / l
  out[1] = y / l
  out[2] = z / l
  return out
}

// one block at a time: its corner plane's slopes, and the box the reach is asked about (filled in place, no arrays per block)
const slopes = new Float64Array(2)
const reachAxes = [new Float64Array(3), new Float64Array(3), new Float64Array(3)] as const
const reachBox = { c: new Float64Array(3), axes: [reachAxes[0], reachAxes[1], reachAxes[2]], half: new Float64Array(3) }

/** The quaternion of the turn whose columns are the axes `a` (x), `b` (y) and `c` (z). */
const quatOfAxes = (a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>): [number, number, number, number] => {
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
 * The blocks under a tile of `cells` cells of side `cell` from (`x0`, `z0`), over its `read` heights (`(cells + 1)^2`, x fastest) and the engine's coarser collision field of
 * them (`step`: every how many corners it is), and the ground around it (`groundAt`, read only past the tile's edges, up to `SOLID_RING`, and its collision field there too).
 */
export const buildSolidVolume = (read: Float32Array, cells: number, x0: number, z0: number, cell: number, groundAt: (x: number, z: number) => number, step = 1): SolidVolume => {
  // under the drawn ground and the engine's collision field (every `step`-th corner, `engine-ground-collision`) both, whichever is lower at each corner
  const heights = underBoth(read, cells, step)
  const m = cells + 1
  let low = Infinity
  for (const h of heights) low = Math.min(low, h)
  const bottom = low - SOLID_DEPTH
  const boxes: number[] = []
  // past the edge, under the neighbour's coarse field too, whichever it collides with
  const ring = createGroundRing(heights, cells, x0, z0, cell, groundAt, coarseStep(cells, cell))
  const reachTile = { heights, cells, x0, z0, cell, pyramid: buildLowPyramid(heights, cells, cell), ring }
  const outer = ring.cells * cell
  const loX = x0 - outer, hiX = x0 + cells * cell + outer, loZ = z0 - outer, hiZ = z0 + cells * cell + outer
  const at = (i: number, j: number): number => heights[j * m + i]!
  /** The slopes (per cell) of the plane through the block's corners, into `slopes` (x then z). */
  const slopesOf = (i0: number, j0: number, i1: number, j1: number): void => {
    slopes[0] = (at(i1, j0) - at(i0, j0) + at(i1, j1) - at(i0, j1)) / 2 / (i1 - i0)
    slopes[1] = (at(i0, j1) - at(i0, j0) + at(i1, j1) - at(i1, j0)) / 2 / (j1 - j0)
  }

  /** How far the surface rises above the plane through the block's corners lowered to its lowest sample: the block is split while it is more. */
  const planeGap = (i0: number, j0: number, i1: number, j1: number): number => {
    slopesOf(i0, j0, i1, j1)
    const sx = slopes[0]!, sz = slopes[1]!
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
   * it (the block's upright box is under it); a box lowered by more than the block's relief is the upright box alone. False when the block should be split instead: its box would not
   * fit the ring, or the ground past the tile lowers it much more than its own.
   */
  const sloped = (i0: number, j0: number, i1: number, j1: number, least: number, most: number): boolean => {
    const span = Math.max(i1 - i0, j1 - j0)
    slopesOf(i0, j0, i1, j1)
    const gx = slopes[0]! / cell
    const gz = slopes[1]! / cell
    const ox = x0 + i0 * cell
    const oz = z0 + j0 * cell
    const base = at(i0, j0)
    // the box's axes, in the scratch the reach reads them from: n the normal of its top, ax along x up the slope, az across both
    const n = unitInto(reachAxes[1]!, -gx, 1, -gz)
    const ax = unitInto(reachAxes[0]!, 1, gx, 0)
    const az = reachAxes[2]!
    az[0] = ax[1]! * n[2]! - ax[2]! * n[1]!
    az[1] = ax[2]! * n[0]! - ax[0]! * n[2]!
    az[2] = ax[0]! * n[1]! - ax[1]! * n[0]!
    const xa = ox, xb = x0 + i1 * cell, za = oz, zb = z0 + j1 * cell
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, cy = base + gx * (cx - ox) + gz * (cz - oz)
    let hx = 0
    let hz = 0
    for (let a = 0; a < 2; a++) {
      const x = a === 0 ? xa : xb
      for (let b = 0; b < 2; b++) {
        const z = b === 0 ? za : zb
        const d0 = x - cx, d1 = base + gx * (x - ox) + gz * (z - oz) - cy, d2 = z - cz
        hx = Math.max(hx, Math.abs(d0 * ax[0]! + d1 * ax[1]! + d2 * ax[2]!))
        hz = Math.max(hz, Math.abs(d0 * az[0]! + d1 * az[1]! + d2 * az[2]!))
      }
    }
    hx += cell
    hz += cell
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, highest = -Infinity
    for (let a = 0; a < 2; a++) {
      const su = a === 0 ? -1 : 1
      for (let b = 0; b < 2; b++) {
        const sw = b === 0 ? -1 : 1
        const qx = cx + su * hx * ax[0] + sw * hz * az[0]
        const qz = cz + su * hx * ax[2] + sw * hz * az[2]
        minX = Math.min(minX, qx)
        maxX = Math.max(maxX, qx)
        minZ = Math.min(minZ, qz)
        maxZ = Math.max(maxZ, qz)
        highest = Math.max(highest, cy + su * hx * ax[1] + sw * hz * az[1])
      }
    }
    // deep enough that its bottom face is under the solid's bottom everywhere (a box made only as deep as its block's upright box let what it pushed out the bottom through:
    // 17 of the 48 boxes of the push-up sweep fell, as with a730b5450's slab), unless its bottom would lean (uphill: by -n per metre of thickness) past the ring
    const deep = (highest - bottom) / n[1]
    const fits = Math.min(thickWithin(-n[0], minX, maxX, loX, hiX), thickWithin(-n[2], minZ, maxZ, loZ, hiZ))
    const thick = Math.max(SOLID_THINNEST, Math.min(deep, fits))
    if (fits < thick) {
      if (span > SOLID_MIN_CELLS) return false
      level(i0, j0, i1, j1, least)
      return true
    }
    const hy = thick / 2
    const centre = reachBox.c
    centre[0] = cx - n[0]! * hy
    centre[1] = cy - n[1]! * hy
    centre[2] = cz - n[2]! * hy
    reachBox.half[0] = hx
    reachBox.half[1] = hy
    reachBox.half[2] = hz
    const reach = reachOf(reachBox, reachTile)
    if (reach.ring > reach.tile + SEAM_SPLIT && span > SOLID_MIN_CELLS) return false
    const drop = SOLID_MARGIN + Math.max(reach.tile, reach.ring)
    // lowered further than the block's own relief, its top would be further under the ground than the upright box's
    if (drop - SOLID_MARGIN >= most - least) {
      level(i0, j0, i1, j1, least)
      return true
    }
    // and under it the block's upright box: what slips between two turned boxes (they part under their tops; a cell's overlap closes only so deep) rests on it, no
    // further under the ground than the block's relief
    level(i0, j0, i1, j1, least)
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
      // in halves (a side under two cells stays whole), x's halves first
      const im = i1 - i0 < 2 ? i1 : (i0 + i1) >> 1
      const jm = j1 - j0 < 2 ? j1 : (j0 + j1) >> 1
      for (let a = i0; a < i1; a = im) {
        const b = a === i0 ? im : i1
        for (let d = j0; d < j1; d = jm) {
          const e = d === j0 ? jm : j1
          fill(a, d, b, e)
          if (e === j1) break
        }
        if (b === i1) break
      }
    }
  }
  fill(0, 0, cells, cells)
  return { boxes, ring: ring.read }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
