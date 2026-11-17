/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to a top close under the surface and never above it (§12), nor above a neighbour tile's: nothing of it leaves its tile. A block is split until a plane through its
 * corners is within `SOLID_RELIEF` of the surface or it is `SOLID_MIN_CELLS` cells wide. A level block is a box topped at its lowest ground less `SOLID_MARGIN`; a sloped
 * block is that box and over it a thin slab turned to the block's slope, close under the surface, so what is under a slope rests close under it, and a body less than about
 * a centimetre under is pushed back up through it (deeper, the engine pushes it out sideways, its shortest way: the net holds it, it does not lift it). Every block is boxes:
 * a sloped one used to be a prism (a convex hull each), and a crater tile's 400 hulls were most of the frame after the blast (T3.8ag).
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/** The widest (cells) a sloped block on the tile's edge may be: its slab is cut back from the edge, and the floor under the sliver is as far under the ground as the block is wide. */
const SOLID_EDGE_CELLS = 16
/** A top is this far (m) under the lowest ground it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. */
export const SOLID_MARGIN = 0.005
/** How thick (m) the turned slab over a sloped block is: what a body is pushed up through when it ends a little under a slope. */
const SLAB_THICKNESS = 0.05
/** Numbers per block in `SolidVolume.boxes`. */
export const SOLID_STRIDE = 10

export interface SolidVolume {
  /** The blocks: centre x, y, z, half x, y, z and turn x, y, z, w (`SOLID_STRIDE` numbers each); the box's own y is the normal of its top. */
  readonly boxes: readonly number[]
}

export const NO_SOLID: SolidVolume = { boxes: [] }

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

/** The blocks under a tile of `cells` cells of side `cell` from (`x0`, `z0`), over its `heights` (`(cells + 1)^2`, x fastest). */
export const buildSolidVolume = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number): SolidVolume => {
  const m = cells + 1
  let low = Infinity
  for (const h of heights) low = Math.min(low, h)
  const bottom = low - SOLID_DEPTH
  const boxes: number[] = []
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
   * A sloped block: its upright box topped at its lowest ground (the floor under it all, sides on the block's edges), and over it a slab `SLAB_THICKNESS` thick turned to the
   * plane through the block's corners. The slab's top is the rectangle on that plane over the block and a cell past it each way (turned slabs side by side lean apart under their
   * tops: what is pushed out sideways meets the next one), cut to stay, all of it, over this tile (nothing of it under a neighbour tile, whose ground this tile does not know),
   * then lowered by the ground's deepest dip under the plane over every cell it reaches, and `SOLID_MARGIN`. Where the cut leaves a sliver at the tile's edge the upright box holds.
   */
  const sloped = (i0: number, j0: number, i1: number, j1: number, least: number): void => {
    level(i0, j0, i1, j1, least)
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
    let uHi = 0
    let wHi = 0
    for (const x of [xa, xb]) {
      for (const z of [za, zb]) {
        const d = [x - cx, plane(x, z) - cy, z - cz]
        uHi = Math.max(uHi, Math.abs(d[0]! * ax[0] + d[1]! * ax[1] + d[2]! * ax[2]))
        wHi = Math.max(wHi, Math.abs(d[0]! * az[0] + d[1]! * az[1] + d[2]! * az[2]))
      }
    }
    uHi += cell
    wHi += cell
    let uLo = -uHi
    let wLo = -wHi
    // every corner, the bottom ones too (the slab leans uphill under its top), over the tile: z depends on w only, x on both
    const hy = SLAB_THICKNESS / 2
    const lean = [-2 * hy * n[0], -2 * hy * n[2]]
    const tileX = [x0, x0 + cells * cell], tileZ = [z0, z0 + cells * cell]
    wLo = Math.max(wLo, (tileZ[0]! - cz - Math.min(0, lean[1]!)) / az[2])
    wHi = Math.min(wHi, (tileZ[1]! - cz - Math.max(0, lean[1]!)) / az[2])
    uLo = Math.max(uLo, (tileX[0]! - cx - Math.min(wLo * az[0], wHi * az[0]) - Math.min(0, lean[0]!)) / ax[0])
    uHi = Math.min(uHi, (tileX[1]! - cx - Math.max(wLo * az[0], wHi * az[0]) - Math.max(0, lean[0]!)) / ax[0])
    if (uHi - uLo < cell || wHi - wLo < cell) return
    const um = (uLo + uHi) / 2, wm = (wLo + wHi) / 2
    const hx = (uHi - uLo) / 2, hz = (wHi - wLo) / 2
    // the slab with its top on the plane (not lowered yet)
    const c = [cx + um * ax[0] + wm * az[0] - n[0] * hy, cy + um * ax[1] + wm * az[1] - n[1] * hy, cz + um * ax[2] + wm * az[2] - n[2] * hy]
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let k = 0; k < 8; k++) {
      const s0 = k & 1 ? 1 : -1, s1 = k & 2 ? 1 : -1, s2 = k & 4 ? 1 : -1
      const px = c[0]! + s0 * hx * ax[0] + s1 * hy * n[0] + s2 * hz * az[0]
      const pz = c[2]! + s0 * hx * ax[2] + s1 * hy * n[2] + s2 * hz * az[2]
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minZ = Math.min(minZ, pz)
      maxZ = Math.max(maxZ, pz)
    }
    // no point of the slab is above its top's plane, and the ground is flat between samples: the plane SOLID_MARGIN under every sample of the cells the slab reaches is enough
    let dip = 0
    const ia = Math.max(0, Math.floor((minX - x0) / cell)), ib = Math.min(cells, Math.ceil((maxX - x0) / cell))
    const ja = Math.max(0, Math.floor((minZ - z0) / cell)), jb = Math.min(cells, Math.ceil((maxZ - z0) / cell))
    for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) dip = Math.min(dip, at(i, j) - plane(x0 + i * cell, z0 + j * cell))
    const drop = SOLID_MARGIN - dip
    const q = quatOfAxes(ax, n, az)
    boxes.push(c[0]!, c[1]! - drop, c[2]!, hx, hy, hz, q[0], q[1], q[2], q[3])
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
    // a sloped block on the tile's edge is split to the smallest: its slab is cut back from the edge (nothing of it under the neighbour), and the sliver is the floor's
    const atEdge = i0 === 0 || j0 === 0 || i1 === cells || j1 === cells
    const span = Math.max(i1 - i0, j1 - j0)
    if (((atEdge && span > SOLID_EDGE_CELLS) || planeGap(i0, j0, i1, j1) > SOLID_RELIEF) && span > SOLID_MIN_CELLS) {
      for (const [a, b] of halves(i0, i1)) for (const [d, e] of halves(j0, j1)) fill(a, d, b, e)
      return
    }
    sloped(i0, j0, i1, j1, least)
  }
  fill(0, 0, cells, cells)
  return { boxes }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
