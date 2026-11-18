import { NO_SOLID, buildSolidVolume } from './engine-ground-solid'
import type { SolidVolume } from './engine-ground-solid'
import { collisionFieldOf } from './engine-ground-collision'
import { holdsStep } from './engine-ground-step'

/**
 * The ground a physics engine stands the pieces on, one tile of `groundAt` at a time: a height field over the cell corners for what is smooth, and solid boxes
 * for the cells a hard step runs through (a crater's rim, a terraced slope) and the cells around them. A box's top is its cell's centre height and its
 * sides are vertical, so a step keeps its edge (within half a cell of where it is) instead of a ramp one cell wide; under the boxes the height field is lowered so
 * it does not ramp up through them. A level tile is one slab, solid below.
 *
 * Why not triangles: the step-keeping triangle mesh this replaces was one-sided (a thin piece pressed half through a triangle fell through for good) and had to be
 * made again, as a new body, for every change, which threw away the engine's contact cache. A height field of the same tile is made in about 0.3 ms and can be
 * swapped on the same body (`EnginePieces`), so the pieces on it keep their contacts.
 *
 * The tile is read at `GROUND_CELL`; the engine collides with every second corner of it, a 5 cm field (`engine-ground-collision`, owner decision 2026-11-17), and the solid
 * under it stays under both.
 */

/** Cells of a tile (m), as Rapier's spike measured good enough for a 4 cm plate. */
export const GROUND_CELL = 0.025
/** How far (m) under the lowest ground around them the step boxes go, and how far the height field drops under them. */
const BOX_DEPTH = 0.05
const UNDER_BOX = 0.01

export interface GroundTile {
  /** Corner heights, `(cells + 1)^2`, x fastest: `heights[iz * (cells + 1) + ix]`. Empty when the tile is level. */
  readonly heights: Float32Array
  readonly cells: number
  /** The height field the engine collides with (`engine-ground-collision`): every `cells / collisionCells`-th corner of `heights`, `(collisionCells + 1)^2`. Empty when level. */
  readonly collision: Float32Array
  readonly collisionCells: number
  /** The step boxes: centre x, y, z and half x, y, z, six numbers each. */
  readonly boxes: readonly number[]
  /** The solid under the height field (`engine-ground-solid`); none when the tile is level (a slab is solid already). */
  readonly solid: SolidVolume
  /** The height of a level tile (every sample equal), or null. */
  readonly level: number | null
  /** Every sample read, to tell whether the ground changed since; null for a tile proved level from the terrain's own bounds (`flatTile`), whose samples were never read. */
  readonly samples: Float64Array | null
}

const NO_HEIGHTS = new Float32Array(0)
/** One cell's nine samples, for `holdsStep`. */
const cellSamples = new Float64Array(9)

/** The tile of a level `size` at `level`, laid without a sample read: the caller has proved, from the ground's own data, that every sample there is `level` (to 1e-9, as `shapeGround` calls level). */
export const flatTile = (level: number, size: number): GroundTile => ({ heights: NO_HEIGHTS, cells: Math.round(size / GROUND_CELL), collision: NO_HEIGHTS, collisionCells: 0, boxes: [], solid: NO_SOLID, level, samples: null })

/** A rectangle of the ground, world x and z. */
export interface GroundRect {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/**
 * The four series of samples of a tile, one after the other in `samples`: the corners, the cells' centres, the middles of the edges along x and those along z.
 * `ox` and `oz` are where the series sits in a cell (0 or half), `width` and `rows` how many samples it has along x and along z.
 */
const seriesOf = (n: number): ReadonlyArray<{ offset: number; width: number; rows: number; ox: number; oz: number }> => {
  const m = n + 1
  return [
    { offset: 0, width: m, rows: m, ox: 0, oz: 0 },
    { offset: m * m, width: n, rows: n, ox: 0.5, oz: 0.5 },
    { offset: m * m + n * n, width: n, rows: m, ox: 0.5, oz: 0 },
    { offset: m * m + n * n + n * m, width: m, rows: n, ox: 0, oz: 0.5 },
  ]
}

/** The `samples` array of a tile of `n` cells. */
const sampleCount = (n: number): number => (n + 1) * (n + 1) + n * n + 2 * n * (n + 1)

/**
 * The ground over a lattice in one pass: the height at (`xs[i]`, `zs[j]`) into `out[j * xs.length + i]`, to the bit what the tile's `groundAt` answers at each point
 * (`Terrain.heightGrid` is one). A tile reads its 26 000 samples through it instead of a call each.
 */
export type GroundGrid = (xs: ArrayLike<number>, zs: ArrayLike<number>, out: Float64Array) => void

// the lattice a grid read asks for and what it answers, kept between reads (one at a time) so a read does not make them again
let latticeX = new Float64Array(0)
let latticeZ = new Float64Array(0)
let latticeHeights = new Float64Array(0)

/**
 * Reads the ground of the tile at (x0, z0) into `samples`: every sample, or only those a rectangle reaches (a sample a cell outside it is read too, so what the
 * rectangle's edge touches is not left old). True when a sample read differs from the one held. A crater in a corner of a tile asks `groundAt` for the corner.
 * With a `grid` the samples are read in one pass over the half-cell lattice they all lie on, each point the one `groundAt` would be asked for, so the same heights.
 * Not reentrant: the lattice is module scratch, so neither reader may read a tile in turn.
 */
export const readGround = (groundAt: (x: number, z: number) => number, samples: Float64Array, x0: number, z0: number, size: number, rect?: GroundRect, grid?: GroundGrid): boolean => {
  const n = Math.round(size / GROUND_CELL)
  const c = size / n
  const ranges = seriesOf(n).map(({ offset, width, rows, ox, oz }) => ({
    offset, width, ox, oz,
    i0: rect ? Math.max(0, Math.floor((rect.minX - x0) / c - ox)) : 0,
    i1: rect ? Math.min(width - 1, Math.ceil((rect.maxX - x0) / c - ox)) : width - 1,
    j0: rect ? Math.max(0, Math.floor((rect.minZ - z0) / c - oz)) : 0,
    j1: rect ? Math.min(rows - 1, Math.ceil((rect.maxZ - z0) / c - oz)) : rows - 1,
  }))
  // the half-cell lattice (index a: x0 + (a / 2) * c) over every series' range: a sample at (i + ox, j + oz) is its point (2i + 2ox, 2j + 2oz)
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
  for (const r of ranges) {
    if (r.i0 > r.i1 || r.j0 > r.j1) continue
    a0 = Math.min(a0, 2 * (r.i0 + r.ox)); a1 = Math.max(a1, 2 * (r.i1 + r.ox))
    b0 = Math.min(b0, 2 * (r.j0 + r.oz)); b1 = Math.max(b1, 2 * (r.j1 + r.oz))
  }
  const across = a1 - a0 + 1
  const lattice = grid !== undefined && a1 >= a0 && b1 >= b0
  if (lattice) {
    const along = b1 - b0 + 1
    if (latticeX.length < across) latticeX = new Float64Array(across)
    if (latticeZ.length < along) latticeZ = new Float64Array(along)
    if (latticeHeights.length < across * along) latticeHeights = new Float64Array(across * along)
    // (a / 2) is exactly i + ox, so each point is the one `groundAt` is asked for below
    for (let a = 0; a < across; a++) latticeX[a] = x0 + ((a0 + a) / 2) * c
    for (let b = 0; b < along; b++) latticeZ[b] = z0 + ((b0 + b) / 2) * c
    grid(latticeX.subarray(0, across), latticeZ.subarray(0, along), latticeHeights)
  }
  let changed = false
  for (const { offset, width, ox, oz, i0, i1, j0, j1 } of ranges) {
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const h = lattice ? latticeHeights[(2 * (j + oz) - b0) * across + 2 * (i + ox) - a0]! : groundAt(x0 + (i + ox) * c, z0 + (j + oz) * c)
        if (samples[offset + j * width + i] !== h) changed = true
        samples[offset + j * width + i] = h
      }
    }
  }
  return changed
}

export const buildGroundTile = (groundAt: (x: number, z: number) => number, x0: number, z0: number, size: number, withSolid = true, grid?: GroundGrid): GroundTile => {
  const samples = new Float64Array(sampleCount(Math.round(size / GROUND_CELL)))
  readGround(groundAt, samples, x0, z0, size, undefined, grid)
  return shapeGround(samples, x0, z0, size, withSolid ? groundAt : null)
}

/**
 * The tile the samples make: level, or its height field, step boxes and (given the ground, which it reads past the tile's edges; else `NO_SOLID`, for a caller that may
 * not need it) the solid under it. Pure of the samples (and that ground), so a tile made from samples patched in place is the one made from all of them read again, but
 * for its collision field near the bound, which keeps the coarse one it had (`wasCoarse`, `collisionFieldOf`).
 */
export const shapeGround = (samples: Float64Array, x0: number, z0: number, size: number, solidGround: ((x: number, z: number) => number) | null, wasCoarse = false): GroundTile => {
  const n = Math.round(size / GROUND_CELL)
  const c = size / n
  const m = n + 1
  const [cornerSeries, centreSeries, midXSeries, midZSeries] = seriesOf(n)
  const corners = samples.subarray(cornerSeries!.offset, centreSeries!.offset)
  const centres = samples.subarray(centreSeries!.offset, midXSeries!.offset)
  const midX = samples.subarray(midXSeries!.offset, midZSeries!.offset)
  const midZ = samples.subarray(midZSeries!.offset)
  let low = Infinity
  let high = -Infinity
  for (const h of samples) {
    low = Math.min(low, h)
    high = Math.max(high, h)
  }
  if (high - low < 1e-9) return { heights: new Float32Array(0), cells: n, collision: NO_HEIGHTS, collisionCells: 0, boxes: [], solid: NO_SOLID, level: high, samples }
  const corner = (i: number, j: number): number => corners[j * m + i]
  // a cell whose centre or an edge's middle leaves its corners holds a step; it and the cells around it become boxes
  const mask = new Uint8Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      cellSamples[0] = corner(i, j)
      cellSamples[1] = corner(i + 1, j)
      cellSamples[2] = corner(i, j + 1)
      cellSamples[3] = corner(i + 1, j + 1)
      cellSamples[4] = centres[j * n + i]
      cellSamples[5] = midX[j * n + i]
      cellSamples[6] = midX[(j + 1) * n + i]
      cellSamples[7] = midZ[j * m + i]
      cellSamples[8] = midZ[j * m + i + 1]
      if (!holdsStep(cellSamples)) continue
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (i + di >= 0 && j + dj >= 0 && i + di < n && j + dj < n) mask[(j + dj) * n + i + di] = 1
    }
  }
  const heights = new Float32Array(m * m)
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      // a corner whose four cells are all boxes goes under the lowest of them
      let inside = true
      let least = corner(i, j)
      for (let dj = -1; dj <= 0 && inside; dj++) for (let di = -1; di <= 0; di++) {
        const ii = i + di, jj = j + dj
        if (ii < 0 || jj < 0 || ii >= n || jj >= n || !mask[jj * n + ii]) {
          inside = false
          break
        }
        least = Math.min(least, centres[jj * n + ii], corner(ii, jj), corner(ii + 1, jj), corner(ii, jj + 1), corner(ii + 1, jj + 1))
      }
      heights[j * m + i] = inside ? least - UNDER_BOX : corner(i, j)
    }
  }
  // the boxes: runs along x of masked cells at one height, down to under the lowest ground around them
  const boxes: number[] = []
  for (let j = 0; j < n; j++) {
    let i = 0
    while (i < n) {
      if (!mask[j * n + i]) {
        i++
        continue
      }
      const top = centres[j * n + i]
      let end = i + 1
      while (end < n && mask[j * n + end] && Math.abs(centres[j * n + end] - top) < 0.001) end++
      let bottom = top
      for (let k = Math.max(0, i - 1); k <= Math.min(n, end + 1); k++) for (let jj = Math.max(0, j - 1); jj <= Math.min(n, j + 2); jj++) bottom = Math.min(bottom, corner(k, jj))
      bottom -= BOX_DEPTH
      boxes.push(x0 + ((i + end) / 2) * c, (top + bottom) / 2, z0 + (j + 0.5) * c, ((end - i) * c) / 2, (top - bottom) / 2, c / 2)
      i = end
    }
  }
  const { step, field } = collisionFieldOf(heights, n, c, boxes.length > 0, wasCoarse)
  return { heights, cells: n, collision: field, collisionCells: n / step, boxes, solid: solidGround ? buildSolidVolume(heights, n, x0, z0, c, solidGround, step) : NO_SOLID, level: null, samples }
}
