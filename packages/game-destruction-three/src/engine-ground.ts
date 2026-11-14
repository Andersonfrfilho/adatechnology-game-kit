/**
 * The ground a physics engine stands the pieces on, one tile of `groundAt` at a time: a height field over the cell corners for what is smooth, and solid boxes
 * for the cells a hard step runs through (a crater's rim, a terraced slope) and the cells around them. A box's top is its cell's centre height and its
 * sides are vertical, so a step keeps its edge (within half a cell of where it is) instead of a ramp one cell wide; under the boxes the height field is lowered so
 * it does not ramp up through them. A level tile is one slab, solid below.
 *
 * Why not triangles: the step-keeping triangle mesh this replaces was one-sided (a thin piece pressed half through a triangle fell through for good) and had to be
 * made again, as a new body, for every change, which threw away the engine's contact cache. A height field of the same tile is made in about 0.3 ms and can be
 * swapped on the same body (`EnginePieces`), so the pieces on it keep their contacts.
 */

/** Cells of a tile (m), as Rapier's spike measured good enough for a 4 cm plate. */
export const GROUND_CELL = 0.025
/** How far (m) a sample may leave its cell's corners before the cell counts as holding a step. */
const STEP_TOLERANCE = 0.005
/** How far (m) under the lowest ground around them the step boxes go, and how far the height field drops under them. */
const BOX_DEPTH = 0.05
const UNDER_BOX = 0.01

export interface GroundTile {
  /** Corner heights, `(cells + 1)^2`, x fastest: `heights[iz * (cells + 1) + ix]`. Empty when the tile is level. */
  readonly heights: Float32Array
  readonly cells: number
  /** The step boxes: centre x, y, z and half x, y, z, six numbers each. */
  readonly boxes: readonly number[]
  /** The height of a level tile (every sample equal), or null. */
  readonly level: number | null
  /** Every sample read, to tell whether the ground changed since. */
  readonly samples: Float64Array
}

export const buildGroundTile = (groundAt: (x: number, z: number) => number, x0: number, z0: number, size: number): GroundTile => {
  const n = Math.round(size / GROUND_CELL)
  const c = size / n
  const m = n + 1
  const corners = new Float64Array(m * m)
  const centres = new Float64Array(n * n)
  const midX = new Float64Array(n * m)
  const midZ = new Float64Array(m * n)
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) corners[j * m + i] = groundAt(x0 + i * c, z0 + j * c)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) centres[j * n + i] = groundAt(x0 + (i + 0.5) * c, z0 + (j + 0.5) * c)
  for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) midX[j * n + i] = groundAt(x0 + (i + 0.5) * c, z0 + j * c)
  for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) midZ[j * m + i] = groundAt(x0 + i * c, z0 + (j + 0.5) * c)
  const samples = new Float64Array(corners.length + centres.length + midX.length + midZ.length)
  samples.set(corners, 0)
  samples.set(centres, corners.length)
  samples.set(midX, corners.length + centres.length)
  samples.set(midZ, corners.length + centres.length + midX.length)
  let low = Infinity
  let high = -Infinity
  for (const h of samples) {
    low = Math.min(low, h)
    high = Math.max(high, h)
  }
  if (high - low < 1e-9) return { heights: new Float32Array(0), cells: n, boxes: [], level: high, samples }
  const corner = (i: number, j: number): number => corners[j * m + i]
  const off = (a: number, b: number): boolean => Math.abs(a - b) > STEP_TOLERANCE
  // a cell whose centre or an edge's middle leaves its corners holds a step; it and the cells around it become boxes
  const mask = new Uint8Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = corner(i, j), b = corner(i + 1, j), d = corner(i, j + 1), e = corner(i + 1, j + 1)
      const step = off(centres[j * n + i], (a + b + d + e) / 4) || off(midX[j * n + i], (a + b) / 2) || off(midX[(j + 1) * n + i], (d + e) / 2) || off(midZ[j * m + i], (a + d) / 2) || off(midZ[j * m + i + 1], (b + e) / 2)
      if (!step) continue
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
  return { heights, cells: n, boxes, level: null, samples }
}

/** The same samples: the ground of the tile did not change. */
export const sameGround = (a: Float64Array, b: Float64Array): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
