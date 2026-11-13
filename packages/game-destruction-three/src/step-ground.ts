/**
 * A tile of `groundAt` that keeps hard steps: a height field over the cell corners for what is smooth, and solid boxes for the cells a step runs through (a cell whose
 * centre or an edge's middle leaves the plane of its corners by more than `STEP_TOLERANCE`) and the cells around them. A box's top is its cell's centre height and its
 * sides are vertical: a table top in the height field keeps its edge instead of a ramp the width of a cell. Under the boxes the height field is lowered so it does not
 * ramp up through them. (A triangle mesh with vertical walls was tried first: 13k triangles a tile cost 6-9 ms to build, too slow for ground that changes every frame.)
 */

/** How far (m) a sample may leave its cell's corners before the cell counts as holding a step. */
export const STEP_TOLERANCE = 0.005

export interface GroundTileMesh {
  /** Corner heights for the engine's height field: (cells + 1)^2, z fastest (`heights[iz + ix * (cells + 1)]`). */
  readonly heights: Float32Array
  /** The step boxes: centre x, y, z, half x, y, z each. */
  readonly boxes: readonly number[]
  /** Every sample was the same height: the tile is level (`level`), and a slab serves. */
  readonly level: number | null
  /** The samples, to tell whether the ground changed since. */
  readonly samples: Float64Array
  readonly stepCells: number
}

export const buildGroundTile = (groundAt: (x: number, z: number) => number, x0: number, z0: number, size: number, cells: number): GroundTileMesh => {
  const n = cells
  const c = size / n
  const corners = new Float64Array((n + 1) * (n + 1))
  const centres = new Float64Array(n * n)
  const midX = new Float64Array(n * (n + 1))
  const midZ = new Float64Array((n + 1) * n)
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) corners[j * (n + 1) + i] = groundAt(x0 + i * c, z0 + j * c)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) centres[j * n + i] = groundAt(x0 + (i + 0.5) * c, z0 + (j + 0.5) * c)
  for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) midX[j * n + i] = groundAt(x0 + (i + 0.5) * c, z0 + j * c)
  for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) midZ[j * (n + 1) + i] = groundAt(x0 + i * c, z0 + (j + 0.5) * c)
  const samples = new Float64Array(corners.length + centres.length + midX.length + midZ.length)
  samples.set(corners, 0)
  samples.set(centres, corners.length)
  samples.set(midX, corners.length + centres.length)
  samples.set(midZ, corners.length + centres.length + midX.length)
  let low = Infinity
  let high = -Infinity
  for (const h of samples) {
    if (h < low) low = h
    if (h > high) high = h
  }
  if (high - low < 1e-9) return { heights: new Float32Array(0), boxes: [], level: high, samples, stepCells: 0 }
  const corner = (i: number, j: number): number => corners[j * (n + 1) + i]
  const step = new Uint8Array(n * n)
  let stepCells = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = corner(i, j), b = corner(i + 1, j), d = corner(i, j + 1), e = corner(i + 1, j + 1)
      const off =
        Math.abs(centres[j * n + i] - (a + b + d + e) / 4) > STEP_TOLERANCE ||
        Math.abs(midX[j * n + i] - (a + b) / 2) > STEP_TOLERANCE ||
        Math.abs(midX[(j + 1) * n + i] - (d + e) / 2) > STEP_TOLERANCE ||
        Math.abs(midZ[j * (n + 1) + i] - (a + d) / 2) > STEP_TOLERANCE ||
        Math.abs(midZ[j * (n + 1) + i + 1] - (b + e) / 2) > STEP_TOLERANCE
      if (off) {
        step[j * n + i] = 1
        stepCells++
      }
    }
  }
  // the cells around a step become boxes too, so the height field under the step can be lowered without denting the smooth ground next to it
  const mask = new Uint8Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!step[j * n + i]) continue
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj
      if (ii >= 0 && jj >= 0 && ii < n && jj < n) mask[jj * n + ii] = 1
    }
  }
  const heights = new Float32Array((n + 1) * (n + 1))
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      let h = corner(i, j)
      // a corner whose four cells are all boxes goes down to the lowest around it
      let inside = true
      let least = h
      for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
        const ii = i + di, jj = j + dj
        if (ii < 0 || jj < 0 || ii >= n || jj >= n || !mask[jj * n + ii]) inside = false
        else least = Math.min(least, centres[jj * n + ii], corner(ii, jj), corner(ii + 1, jj), corner(ii, jj + 1), corner(ii + 1, jj + 1))
      }
      if (inside) h = least - 0.01
      heights[j + i * (n + 1)] = h
    }
  }
  // boxes: runs along x of masked cells at one height, down to below the lowest ground around them
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
      for (let k = Math.max(0, i - 1); k <= Math.min(n, end + 1); k++) for (let jj = Math.max(0, j - 1); jj <= Math.min(n, j + 2); jj++) bottom = Math.min(bottom, corner(Math.min(k, n), Math.min(jj, n)))
      bottom -= 0.05
      boxes.push(x0 + ((i + end) / 2) * c, (top + bottom) / 2, z0 + (j + 0.5) * c, ((end - i) * c) / 2, (top - bottom) / 2, c / 2)
      i = end
    }
  }
  return { heights, boxes, level: null, samples, stepCells }
}
