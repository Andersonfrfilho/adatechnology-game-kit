/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to a top close under the surface and never above it (§12). A block is split until a plane through its corners is within `SOLID_RELIEF` of the surface or it is
 * `SOLID_MIN_CELLS` cells wide. A level block is a box topped at its lowest ground less `SOLID_MARGIN`; a sloped block is a box turned to its corner plane, the plane
 * lowered by the ground's deepest dip under it and `SOLID_MARGIN`, so what is under a slope rests close under it too and is pushed back up through it. Every block is
 * a box: a sloped one used to be a prism (a convex hull each), and a crater tile's 400 hulls were most of the frame after the blast (T3.8ag).
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/** A top is this far (m) under the lowest ground it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. */
export const SOLID_MARGIN = 0.005
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
   * A sloped block: a box turned to the plane through its corners, its top the rectangle on that plane over the block (a little past it where both slopes turn it), the plane
   * lowered by the deepest the ground dips under it over every cell the top reaches and by `SOLID_MARGIN`. The ground is flat between samples, so under no sample is under nowhere.
   */
  const sloped = (i0: number, j0: number, i1: number, j1: number): void => {
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
    // past the block by a cell each way: turned boxes side by side lean apart under their tops, and what is pushed out sideways meets the next one, not a gap
    hx += cell
    hz += cell
    // the cells the top reaches (its corners seen from above), and the deepest dip of the ground under the plane over them
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
    const ia = Math.max(0, Math.floor((minX - x0) / cell)), ib = Math.min(cells, Math.ceil((maxX - x0) / cell))
    const ja = Math.max(0, Math.floor((minZ - z0) / cell)), jb = Math.min(cells, Math.ceil((maxZ - z0) / cell))
    let dip = 0
    for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) dip = Math.min(dip, at(i, j) - plane(x0 + i * cell, z0 + j * cell))
    const drop = SOLID_MARGIN - dip
    // deep enough that the bottom face is under the solid's bottom everywhere
    const hy = (highest - drop - bottom) / (2 * n[1])
    const q = quatOfAxes(ax, n, az)
    boxes.push(cx - n[0] * hy, cy - drop - n[1] * hy, cz - n[2] * hy, hx, hy, hz, q[0], q[1], q[2], q[3])
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
    if (planeGap(i0, j0, i1, j1) > SOLID_RELIEF && Math.max(i1 - i0, j1 - j0) > SOLID_MIN_CELLS) {
      for (const [a, b] of halves(i0, i1)) for (const [d, e] of halves(j0, j1)) fill(a, d, b, e)
      return
    }
    sloped(i0, j0, i1, j1)
  }
  fill(0, 0, cells, cells)
  return { boxes }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
