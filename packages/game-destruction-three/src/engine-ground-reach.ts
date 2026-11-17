import type { GroundRing } from './engine-ground-ring'

/**
 * How far a turned box rises above the ground, over every column it has a point in, its leaning sides as much as its top: what it must be lowered by to be under the ground
 * everywhere (§12). The ground between a cell's corners is flat (the engine's two triangles, or bilinear), so a plane rises over it the most at a corner.
 * - Its top: the top's plane over every corner under the top's extent.
 * - Its sides, which lean uphill under the top: the box is its top slid down along -n, so where the ground over the box's shadow is nowhere steeper than the top's slope
 *   allows (1 / its slope), no point of it is further over the ground than its top is. Else every cell of the shadow: a column's highest point is under each face that
 *   looks up (the top, and the uphill side of each tilted axis), so over a cell under the lowest of those planes, found from the top down over a pyramid of planes under the
 *   tile's ground (a block of cells whose plane is above every plane of the box over it is skipped whole).
 * - Past the tile's edges, every cell of the shadow there, over the ring's ground (`engine-ground-ring`).
 */

/** A box: its centre, axes (x, y, z: the y axis is the normal of its top) and half sizes. */
export interface ReachBox {
  readonly c: ArrayLike<number>
  readonly axes: ReadonlyArray<ArrayLike<number>>
  readonly half: ArrayLike<number>
}

/**
 * Under each block of 2^l by 2^l cells (l from 1 up to one block over the whole tile), a plane no sample of the block is under: the block's corner slopes, lowered to its
 * lowest sample. Three numbers a block (its height at the block's first corner, and its slopes along x and z per cell), made when first asked for: over a slope or a
 * crater's wall the plane follows the ground, so a box whose planes are under it there is skipped whole.
 */
export interface LowPyramid {
  readonly heights: Float32Array
  readonly cells: number
  readonly sizes: readonly number[]
  readonly planes: readonly Float64Array[]
  /** The square of the steepest the ground is (m per m, any way) over each block: a cell's from its edges (its two triangles, or bilinear, are no steeper), a block's the steepest of its four. */
  readonly steepest: readonly Float64Array[]
}

export const buildLowPyramid = (heights: Float32Array, cells: number, cell: number): LowPyramid => {
  const m = cells + 1
  const first = new Float64Array(cells * cells)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const h00 = heights[j * m + i]!, h10 = heights[j * m + i + 1]!, h01 = heights[(j + 1) * m + i]!, h11 = heights[(j + 1) * m + i + 1]!
      const dx = Math.max(Math.abs(h10 - h00), Math.abs(h11 - h01)), dz = Math.max(Math.abs(h01 - h00), Math.abs(h11 - h10))
      first[j * cells + i] = (dx * dx + dz * dz) / (cell * cell)
    }
  }
  const sizes: number[] = [cells]
  const planes: Float64Array[] = [new Float64Array(0)]
  const steepest: Float64Array[] = [first]
  for (let s = 2; s < 2 * cells; s *= 2) {
    const below = steepest[steepest.length - 1]!
    const n = sizes[sizes.length - 1]!
    const k = Math.ceil(cells / s)
    const level = new Float64Array(k * k)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) level[(j >> 1) * k + (i >> 1)] = Math.max(level[(j >> 1) * k + (i >> 1)]!, below[j * n + i]!)
    sizes.push(k)
    planes.push(new Float64Array(3 * k * k).fill(NaN))
    steepest.push(level)
  }
  return { heights, cells, sizes, planes, steepest }
}

/** Whether the ground is steeper than `limit` (m per m) anywhere over the cells `ia`..`ib` (not included) by `ja`..`jb`. */
// the question `steeperOver` is asking, for `visit` (one at a time)
let steepPyramid: LowPyramid | null = null
let steepSquare = 0
let steepIa = 0, steepIb = 0, steepJa = 0, steepJb = 0

const visit = (l: number, bi: number, bj: number): boolean => {
  const pyramid = steepPyramid!
  if (pyramid.steepest[l]![bj * pyramid.sizes[l]! + bi]! <= steepSquare) return false
  const s = 1 << l
  const a = bi * s, c = bj * s
  const b = Math.min(pyramid.cells, a + s), d = Math.min(pyramid.cells, c + s)
  if (a >= steepIb || b <= steepIa || c >= steepJb || d <= steepJa) return false
  if (l === 0) return true
  for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) if (visit(l - 1, 2 * bi + di, 2 * bj + dj)) return true
  return false
}

const steeperOver = (pyramid: LowPyramid, ia: number, ib: number, ja: number, jb: number, limit: number): boolean => {
  steepPyramid = pyramid
  steepSquare = limit * limit
  steepIa = ia
  steepIb = ib
  steepJa = ja
  steepJb = jb
  return visit(pyramid.sizes.length - 1, 0, 0)
}

/** Where the plane under the block (`bi`, `bj`) of level `l` is in `pyramid.planes[l]`, made now if it was not. */
const planeUnder = (pyramid: LowPyramid, l: number, bi: number, bj: number): number => {
  const level = pyramid.planes[l]!
  const at = 3 * (bj * pyramid.sizes[l]! + bi)
  if (!Number.isNaN(level[at]!)) return at
  const { heights, cells } = pyramid
  const m = cells + 1
  const s = 1 << l
  const ia = bi * s, ja = bj * s, ib = Math.min(cells, ia + s), jb = Math.min(cells, ja + s)
  const h00 = heights[ja * m + ia]!, h10 = heights[ja * m + ib]!, h01 = heights[jb * m + ia]!, h11 = heights[jb * m + ib]!
  const sx = (h10 - h00 + h11 - h01) / 2 / (ib - ia), sz = (h01 - h00 + h11 - h10) / 2 / (jb - ja)
  let under = 0
  for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) under = Math.min(under, heights[j * m + i]! - (h00 + sx * (i - ia) + sz * (j - ja)))
  level[at] = h00 + under
  level[at + 1] = sx
  level[at + 2] = sz
  return at
}

export interface ReachTile {
  readonly heights: Float32Array
  readonly cells: number
  readonly x0: number
  readonly z0: number
  readonly cell: number
  readonly pyramid: LowPyramid
  readonly ring: GroundRing
}

export interface Reach {
  /** The most the box rises over the ground of the tile's cells (0 when it is nowhere above), and over the ring's cells past its edges. */
  readonly tile: number
  readonly ring: number
}

const corner4 = new Float64Array(4)
/** A block whose bound is within this (m) of the most found is skipped: the heights are 32 bit floats, and a plane through them is that close to a plane under them. */
const PRUNE_SLACK = 1e-6
// one box at a time: its planes (a, bx, bz each), the directions of its shadow's sides (x, z each) and its extent along each (low, high)
const planes = new Float64Array(9)
const dirs = new Float64Array(10)
const spans = new Float64Array(10)
let planeCount = 0
let dirCount = 0

/** Whether the rectangle and the box's shadow are apart along one of its sides' directions. */
const apart = (xa: number, xb: number, za: number, zb: number): boolean => {
  for (let d = 0; d < dirCount; d += 2) {
    const dx = dirs[d]!, dz = dirs[d + 1]!
    const lo = (dx > 0 ? xa * dx : xb * dx) + (dz > 0 ? za * dz : zb * dz)
    const hi = (dx > 0 ? xb * dx : xa * dx) + (dz > 0 ? zb * dz : za * dz)
    if (hi < spans[d]! - 1e-9 || lo > spans[d + 1]! + 1e-9) return true
  }
  return false
}

/** The least, over the box's planes, of the most each rises over the four corner heights (`corner4`) of the rectangle. */
const over = (xa: number, xb: number, za: number, zb: number): number => {
  let best = Infinity
  for (let p = 0; p < planeCount; p += 3) {
    const a = planes[p]!, bx = planes[p + 1]!, bz = planes[p + 2]!
    const most = Math.max(a + bx * xa + bz * za - corner4[0]!, a + bx * xb + bz * za - corner4[1]!, a + bx * xa + bz * zb - corner4[2]!, a + bx * xb + bz * zb - corner4[3]!)
    if (most < best) best = most
  }
  return best
}

// the tile and box `search` walks (one at a time): the top's own extent in cells (from, to along x, then z), and the most found so far
let searchTile: ReachTile | null = null
const searchTop = new Int32Array(4)
let searchMost = 0

/** The cell (`ia`, `ja`): its corners, and how far the box rises over them. */
const leaf = (ia: number, ja: number): void => {
  const { heights, cells, x0, z0, cell } = searchTile!
  const m = cells + 1
  const xa = x0 + ia * cell, za = z0 + ja * cell
  corner4[0] = heights[ja * m + ia]!
  corner4[1] = heights[ja * m + ia + 1]!
  corner4[2] = heights[(ja + 1) * m + ia]!
  corner4[3] = heights[(ja + 1) * m + ia + 1]!
  const e = over(xa, xa + cell, za, za + cell)
  if (e > searchMost) searchMost = e
}

/** The block (`bi`, `bj`) of level `l`, skipped when the box is apart from it or no higher over its low plane than the most found already, else its four. */
const search = (l: number, bi: number, bj: number): void => {
  const { cells, x0, z0, cell, pyramid } = searchTile!
  const s = 1 << l
  const ia = bi * s, ja = bj * s
  if (ia >= cells || ja >= cells) return
  const ib = Math.min(cells, ia + s), jb = Math.min(cells, ja + s)
  if (ia >= searchTop[0]! && ib <= searchTop[1]! && ja >= searchTop[2]! && jb <= searchTop[3]!) return
  const xa = x0 + ia * cell, xb = x0 + ib * cell, za = z0 + ja * cell, zb = z0 + jb * cell
  if (apart(xa, xb, za, zb)) return
  if (l === 0) return leaf(ia, ja)
  const level = pyramid.planes[l]!
  const at = planeUnder(pyramid, l, bi, bj)
  const h = level[at]!, sx = level[at + 1]!, sz = level[at + 2]!
  corner4[0] = h
  corner4[1] = h + sx * (ib - ia)
  corner4[2] = h + sz * (jb - ja)
  corner4[3] = h + sx * (ib - ia) + sz * (jb - ja)
  if (over(xa, xb, za, zb) <= searchMost + PRUNE_SLACK) return
  for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) search(l - 1, 2 * bi + di, 2 * bj + dj)
}

export const reachOf = (box: ReachBox, t: ReachTile): Reach => {
  const { heights, cells, x0, z0, cell, pyramid, ring } = t
  const m = cells + 1
  // the planes over the box's columns, y <= a + bx x + bz z: one per axis, the face of it that looks up
  planeCount = 0
  for (let k = 0; k < 3; k++) {
    const a = box.axes[k]!
    if (Math.abs(a[1]!) < 1e-9) continue
    const bx = -a[0]! / a[1]!, bz = -a[2]! / a[1]!
    planes[planeCount++] = box.c[1]! + box.half[k]! / Math.abs(a[1]!) - bx * box.c[0]! - bz * box.c[2]!
    planes[planeCount++] = bx
    planes[planeCount++] = bz
  }
  // the box's shadow as a convex polygon: its extent along x, z and across each axis seen from above
  dirs[0] = 1
  dirs[1] = 0
  dirs[2] = 0
  dirs[3] = 1
  dirCount = 4
  for (const a of box.axes) {
    const l = Math.hypot(a[0]!, a[2]!)
    if (l < 1e-9) continue
    dirs[dirCount++] = -a[2]! / l
    dirs[dirCount++] = a[0]! / l
  }
  for (let d = 0; d < dirCount; d += 2) {
    const dx = dirs[d]!, dz = dirs[d + 1]!
    let r = 0
    for (let k = 0; k < 3; k++) r += box.half[k]! * Math.abs(box.axes[k]![0]! * dx + box.axes[k]![2]! * dz)
    const mid = box.c[0]! * dx + box.c[2]! * dz
    spans[d] = mid - r
    spans[d + 1] = mid + r
  }
  let inTile = 0
  // under the top's own extent, the top's plane over every corner (each cell's most is at a corner): the most found there skips most of the rest
  const n = box.axes[1]!, ax = box.axes[0]!, az = box.axes[2]!
  const tx = box.c[0]! + n[0]! * box.half[1]!, ty = box.c[1]! + n[1]! * box.half[1]!, tz = box.c[2]! + n[2]! * box.half[1]!
  const rx = box.half[0]! * Math.abs(ax[0]!) + box.half[2]! * Math.abs(az[0]!), rz = box.half[0]! * Math.abs(ax[2]!) + box.half[2]! * Math.abs(az[2]!)
  const ta = Math.max(0, Math.floor((tx - rx - x0) / cell)), tb = Math.min(cells, Math.ceil((tx + rx - x0) / cell))
  const sa = Math.max(0, Math.floor((tz - rz - z0) / cell)), sb = Math.min(cells, Math.ceil((tz + rz - z0) / cell))
  const bx = -n[0]! / n[1]!, bz = -n[2]! / n[1]!
  for (let j = sa; j <= sb; j++) {
    for (let i = ta; i <= tb; i++) {
      const e = ty + bx * (x0 + i * cell - tx) + bz * (z0 + j * cell - tz) - heights[j * m + i]!
      if (e > inTile) inTile = e
    }
  }
  // the box is its top slid down along -n: a point of it a slide s from the top at q stands s n_y under the top, over ground at most s |n_h| (the steepest) under q's.
  // Where the ground is nowhere steeper than 1 / (its top's slope), no point of the box is further over the ground than its top over its own extent (all in the tile)
  const ia = Math.floor((spans[0]! - x0) / cell), ib = Math.ceil((spans[1]! - x0) / cell)
  const ja = Math.floor((spans[2]! - z0) / cell), jb = Math.ceil((spans[3]! - z0) / cell)
  const within = ia >= 0 && ja >= 0 && ib <= cells && jb <= cells
  if (within && !steeperOver(pyramid, ia, ib, ja, jb, n[1]! / Math.max(1e-12, Math.hypot(n[0]!, n[2]!)))) return { tile: inTile, ring: 0 }
  searchTile = t
  searchTop[0] = ta
  searchTop[1] = tb
  searchTop[2] = sa
  searchTop[3] = sb
  searchMost = inTile
  // else every cell of its shadow, from the level whose blocks are as wide as the shadow's extent along x and z, over the (at most four) of them it covers
  const ua = Math.max(0, ia), ub = Math.min(cells, ib), va = Math.max(0, ja), vb = Math.min(cells, jb)
  if (ua < ub && va < vb) {
    let l = 0
    while (1 << l < Math.max(ub - ua, vb - va) && l < pyramid.sizes.length - 1) l++
    for (let bj = va >> l; bj <= (vb - 1) >> l; bj++) for (let bi = ua >> l; bi <= (ub - 1) >> l; bi++) search(l, bi, bj)
  }
  inTile = searchMost
  // past the edges: the ring's cells the shadow's extent reaches
  let inRing = 0
  const r = ring.cells
  if (within) return { tile: inTile, ring: 0 }
  for (let j = Math.max(-r, ja); j < Math.min(cells + r, jb); j++) {
    const across = j >= 0 && j < cells
    for (let i = Math.max(-r, ia); i < Math.min(cells + r, ib); i++) {
      // over the tile, along the row: on to its far edge
      if (across && i >= 0 && i < cells) i = cells
      if (i >= Math.min(cells + r, ib)) break
      const xa = x0 + i * cell, za = z0 + j * cell
      if (apart(xa, xa + cell, za, za + cell)) continue
      ring.cell(i, j, corner4)
      const e = over(xa, xa + cell, za, za + cell)
      if (e > inRing) inRing = e
    }
  }
  return { tile: inTile, ring: inRing }
}
