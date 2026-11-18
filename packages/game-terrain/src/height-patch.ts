/**
 * The ground's blend as pure functions of numbers, shared by `Terrain.heightAt`, `Terrain.heightGrid` and `heightPatchGrid`: the same code reads the terrain on the main
 * thread and a copy of its vertices anywhere else (a worker has no terrain), so the heights agree to the bit.
 */

/** Where `v` falls along an axis of `count` cells of `cellSize` from `origin`, in cells, held inside the last cell: its whole part is the cell, the rest the blend across it. */
export const cellCoordinate = (v: number, origin: number, count: number, cellSize: number): number => Math.max(0, Math.min(count - 1e-6, (v - origin) / cellSize))

/** The blend of two heights, `t` of the way from `near` to `far` (the one step every blend of the ground is made of). */
export const blendHeights = (near: number, far: number, t: number): number => near * (1 - t) + far * t

/**
 * The terrain's vertex heights (`base - dug + loose`, as `heightAt` reads them) over a block of its cells, with what places them in the terrain: plain numbers, so a worker
 * can read the ground from them (`heightPatchGrid`) and answer what `heightGrid` does there, to the bit. Made by `Terrain.heightPatch`.
 */
export interface HeightPatch {
  readonly cellSize: number
  /** The terrain's first vertex (its bounds' min x and z) and its cells along x and z: where a point's cell is found, with its clamps. */
  readonly originX: number
  readonly originZ: number
  readonly columns: number
  readonly rows: number
  /** The patch's first vertex (column and row of the terrain) and how many vertices it has along x and along z. */
  readonly column0: number
  readonly row0: number
  readonly width: number
  readonly depth: number
  /** The heights, `width` per row, rows from `row0`: `heights[(row - row0) * width + column - column0]` (the array may be longer). */
  readonly heights: Float64Array
}

// the cell and the blend of each column and row a patch read finds, kept between reads (one at a time) so a read costs no new arrays
let patchColumns = new Int32Array(0)
let patchBlendX = new Float64Array(0)
let patchNear = new Float64Array(0)
let patchFar = new Float64Array(0)

/**
 * The ground over a lattice from a patch: the height at (`xs[i]`, `zs[j]`) into `out[j * xs.length + i]`, to the bit what the terrain's `heightGrid` answers there (the same
 * cell, clamps and blends, on the same vertex heights). Every point must lie inside the terrain and over the patch's cells (`Terrain.heightPatch` of a rectangle holding
 * them): one that does not throws. Not reentrant (module scratch).
 */
export function heightPatchGrid(patch: HeightPatch, xs: ArrayLike<number>, zs: ArrayLike<number>, out: Float64Array): void {
  const width = xs.length
  const depth = zs.length
  if (out.length < width * depth) throw new RangeError(`heightPatchGrid: out holds ${out.length} heights, the grid has ${width * depth}`)
  const { cellSize, originX, originZ, columns, rows, column0, row0, heights } = patch
  const stride = patch.width
  if (patchColumns.length < width) {
    patchColumns = new Int32Array(width)
    patchBlendX = new Float64Array(width)
    patchNear = new Float64Array(width)
    patchFar = new Float64Array(width)
  }
  for (let i = 0; i < width; i++) {
    const fx = cellCoordinate(xs[i]!, originX, columns, cellSize)
    const column = (fx | 0) - column0
    if (column < 0 || column + 1 >= stride) throw new RangeError(`heightPatchGrid: x ${xs[i]} is past the patch`)
    patchColumns[i] = column
    patchBlendX[i] = fx - (fx | 0)
  }
  let blended = -1
  for (let j = 0; j < depth; j++) {
    const fz = cellCoordinate(zs[j]!, originZ, rows, cellSize)
    const row = (fz | 0) - row0
    if (row < 0 || row + 1 >= patch.depth) throw new RangeError(`heightPatchGrid: z ${zs[j]} is past the patch`)
    const tz = fz - (fz | 0)
    // the two x blends of a column depend on its row of cells only, as in `heightGrid`
    if (row !== blended) {
      blended = row
      for (let i = 0; i < width; i++) {
        const index = row * stride + patchColumns[i]!
        const tx = patchBlendX[i]!
        patchNear[i] = blendHeights(heights[index]!, heights[index + 1]!, tx)
        patchFar[i] = blendHeights(heights[index + stride]!, heights[index + stride + 1]!, tx)
      }
    }
    for (let i = 0; i < width; i++) out[j * width + i] = blendHeights(patchNear[i]!, patchFar[i]!, tz)
  }
}

/** Whether two patches hold the same vertices at the same heights (the ground they read is the same, to the bit, wherever both reach). */
export const samePatch = (a: HeightPatch, b: HeightPatch): boolean => {
  if (a.cellSize !== b.cellSize || a.originX !== b.originX || a.originZ !== b.originZ || a.columns !== b.columns || a.rows !== b.rows) return false
  if (a.column0 !== b.column0 || a.row0 !== b.row0 || a.width !== b.width || a.depth !== b.depth) return false
  const count = a.width * a.depth
  for (let k = 0; k < count; k++) if (a.heights[k] !== b.heights[k]) return false
  return true
}
