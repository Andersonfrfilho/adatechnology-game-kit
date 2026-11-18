import { cellCoordinate, heightPatchGrid } from '@adatechnology/game-terrain'
import type { HeightPatch } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount, shapeGround } from './engine-ground'
import type { GroundGrid, GroundTile } from './engine-ground'
import { SOLID_RING } from './engine-ground-ring'
import { NO_SOLID, buildSolidVolume } from './engine-ground-solid'

/**
 * A tile of the engine's ground as plain data, so it can be made off the main thread (`engine-ground-port`): the main thread reads the tile's samples and the band of ground
 * past its edges its solid may read (`readGroundBand`), and the tile is a pure function of those (`computeGroundTile`), the same bits wherever it runs. Nothing here calls back
 * into the host: a worker has no `groundAt`.
 */

/** What a tile is made from: its samples (`readGround`) and the band past its edges (`readGroundBand`), both read on the main thread at the frame it was asked for. */
export interface GroundTileJob {
  readonly id: number
  readonly x0: number
  readonly z0: number
  readonly size: number
  /** Whether the tile collided on the coarse field before (`collisionFieldOf`). */
  readonly wasCoarse: boolean
  /** Empty in a patch job (`patch`), whose samples and band are made where the tile is. */
  readonly samples: Float64Array
  readonly band: Float64Array
  /**
   * The terrain's vertices under the tile and its ring (`readGroundPatch`), in place of the samples and the band: about 26 x 26 numbers instead of 60 000. The tile is made from
   * the samples and band the patch gives (`heightPatchGrid`, the terrain's own blend), the same bits as read from the terrain on the main thread.
   */
  readonly patch?: HeightPatch
}

/** A tile made from a job, as arrays that cross threads; `samples` and `band` are the job's own, handed back for the next job. */
export interface GroundTileResult {
  readonly id: number
  readonly cells: number
  readonly collisionCells: number
  readonly level: number | null
  readonly heights: Float32Array
  readonly collision: Float32Array
  readonly boxes: Float64Array
  readonly solid: Float64Array
  readonly ring: Float64Array
  readonly samples: Float64Array
  readonly band: Float64Array
  /** A patch job's vertex heights, handed back for the next job. */
  readonly patch?: Float64Array
}

/** How many read cells the ring past a tile of `cells` cells of side `cell` is wide (`createGroundRing`). */
const ringOf = (cell: number): number => Math.round(SOLID_RING / cell)

/** The length of the band of a tile of `size` m: one height per half cell over the tile and its ring (`GroundSource`). */
export const bandLength = (size: number): number => {
  const n = Math.round(size / GROUND_CELL)
  const width = 2 * (n + 2 * ringOf(size / n)) + 1
  return width * width
}

// the lattice of a band read through the grid, kept between reads (one at a time)
let lineX = new Float64Array(0)
let lineZ = new Float64Array(0)
let sideOut = new Float64Array(0)

/**
 * Reads into `band` the ground past the tile's edges, as far as its solid may read it (`SOLID_RING`) and on the edges themselves: every half cell `(a, b)` with `a` or `b` on or
 * past an edge, at the very point the ring asks `groundAt` for (`x0 + (a / 2) * cell`). Through `grid` in four strips, else a call each. The tile's inside is left as it was.
 */
export const readGroundBand = (groundAt: (x: number, z: number) => number, band: Float64Array, x0: number, z0: number, size: number, grid?: GroundGrid): void => {
  const n = Math.round(size / GROUND_CELL)
  const cell = size / n
  const r = ringOf(cell)
  const lo = -2 * r
  const hi = 2 * n + 2 * r
  const width = hi - lo + 1
  const xAt = (a: number): number => x0 + (a / 2) * cell
  const zAt = (b: number): number => z0 + (b / 2) * cell
  if (!grid) {
    for (let b = lo; b <= hi; b++) {
      for (let a = lo; a <= hi; a++) {
        if (a > 0 && a < 2 * n && b > 0 && b < 2 * n) continue
        band[(b - lo) * width + a - lo] = groundAt(xAt(a), zAt(b))
      }
    }
    return
  }
  const strip = 2 * r + 1
  const middle = 2 * n - 1
  if (lineX.length < width) lineX = new Float64Array(width)
  if (lineZ.length < width) lineZ = new Float64Array(width)
  if (sideOut.length < strip * middle) sideOut = new Float64Array(strip * middle)
  for (let a = lo; a <= hi; a++) lineX[a - lo] = xAt(a)
  const xs = lineX.subarray(0, width)
  // the rows under the tile and over it, whole: straight into the band
  for (const from of [lo, 2 * n]) {
    for (let k = 0; k < strip; k++) lineZ[k] = zAt(from + k)
    grid(xs, lineZ.subarray(0, strip), band.subarray((from - lo) * width, (from - lo + strip) * width))
  }
  // the columns left and right of it, between those rows
  for (let k = 0; k < middle; k++) lineZ[k] = zAt(1 + k)
  const zs = lineZ.subarray(0, middle)
  for (const from of [lo, 2 * n]) {
    grid(lineX.subarray(from - lo, from - lo + strip), zs, sideOut)
    for (let k = 0; k < middle; k++) for (let i = 0; i < strip; i++) band[(1 + k - lo) * width + from - lo + i] = sideOut[k * strip + i]!
  }
}

/** The host's terrain as vertex heights under a rectangle (min x, max x, min z, max z), or null where it cannot (`Terrain.heightPatch` is one); written into `into` when long enough. */
export type GroundPatchRead = (minX: number, maxX: number, minZ: number, maxZ: number, into?: Float64Array) => HeightPatch | null

/**
 * The terrain's vertices under the tile at (x0, z0) and its ring, the rectangle every sample and band point lies in (the band's own outermost points, as `readGroundBand` computes
 * them); null where the host has none (a tile crossing the terrain's bounds, where its `baseHeight` answers): that tile is read as before.
 */
export const readGroundPatch = (read: GroundPatchRead, x0: number, z0: number, size: number, into?: Float64Array): HeightPatch | null => {
  const n = Math.round(size / GROUND_CELL)
  const cell = size / n
  const r = ringOf(cell)
  const lo = -2 * r
  const hi = 2 * n + 2 * r
  return read(x0 + (lo / 2) * cell, x0 + (hi / 2) * cell, z0 + (lo / 2) * cell, z0 + (hi / 2) * cell, into)
}

/** The cell of `latticePatchRead`'s ground (m): a terrain's usual one. */
const LATTICE_CELL = 0.1

/**
 * A `GroundPatchRead` of any ground as a terrain would hold it: `ground` sampled at the vertices of a `LATTICE_CELL` lattice laid a metre and more around each rectangle asked,
 * the patch found with the terrain's own cell rule (`cellCoordinate`). For the warm job of a patch tile, which has no terrain: whatever the tile size and ring are, its patch
 * covers them, as a real one does.
 */
export const latticePatchRead = (ground: (x: number, z: number) => number): GroundPatchRead => (minX, maxX, minZ, maxZ, into) => {
  const originX = Math.floor(minX) - 1
  const originZ = Math.floor(minZ) - 1
  const columns = Math.ceil((maxX - originX) / LATTICE_CELL) + 2
  const rows = Math.ceil((maxZ - originZ) / LATTICE_CELL) + 2
  const column0 = cellCoordinate(minX, originX, columns, LATTICE_CELL) | 0
  const row0 = cellCoordinate(minZ, originZ, rows, LATTICE_CELL) | 0
  const width = (cellCoordinate(maxX, originX, columns, LATTICE_CELL) | 0) + 2 - column0
  const depth = (cellCoordinate(maxZ, originZ, rows, LATTICE_CELL) | 0) + 2 - row0
  const heights = into && into.length >= width * depth ? into : new Float64Array(width * depth)
  for (let j = 0; j < depth; j++) for (let i = 0; i < width; i++) heights[j * width + i] = ground(originX + (column0 + i) * LATTICE_CELL, originZ + (row0 + j) * LATTICE_CELL)
  return { cellSize: LATTICE_CELL, originX, originZ, columns, rows, column0, row0, width, depth, heights }
}

const NO_GROUND = (): number => {
  throw new Error('engine-ground-job: a patch job reads its patch only')
}
// the patch the grid below reads, and the samples and band a patch job is made into, kept between jobs (one at a time) so a job makes no arrays for them
let gridPatch: HeightPatch | null = null
const patchGrid: GroundGrid = (xs, zs, out) => heightPatchGrid(gridPatch as HeightPatch, xs, zs, out)
let patchSamples = new Float64Array(0)
let patchBand = new Float64Array(0)

/** The samples and band of a patch job, read from its patch through the same lattices `readGround` and `readGroundBand` read the terrain at (module scratch: not reentrant). */
const groundOfPatch = (job: GroundTileJob, patch: HeightPatch): { samples: Float64Array; band: Float64Array } => {
  const count = sampleCount(Math.round(job.size / GROUND_CELL))
  if (patchSamples.length !== count) patchSamples = new Float64Array(count)
  if (patchBand.length !== bandLength(job.size)) patchBand = new Float64Array(bandLength(job.size))
  gridPatch = patch
  readGround(NO_GROUND, patchSamples, job.x0, job.z0, job.size, undefined, patchGrid)
  readGroundBand(NO_GROUND, patchBand, job.x0, job.z0, job.size, patchGrid)
  gridPatch = null
  return { samples: patchSamples, band: patchBand }
}

/**
 * The tile a job makes: `shapeGround` of its samples and, under a height field, its solid over the band (both made from its patch first, in a patch job). Pure of the job.
 * Not reentrant: a patch job's samples and band, and `readGround`'s lattice, are module scratch (one job at a time per thread, as a worker and the schedule run them).
 */
export const computeGroundTile = (job: GroundTileJob): GroundTileResult => {
  const { samples, band } = job.patch ? groundOfPatch(job, job.patch) : job
  const t = shapeGround(samples, job.x0, job.z0, job.size, null, job.wasCoarse)
  const solid = t.level === null ? buildSolidVolume(t.heights, t.cells, job.x0, job.z0, job.size / t.cells, band, t.cells / t.collisionCells) : NO_SOLID
  return {
    id: job.id, cells: t.cells, collisionCells: t.collisionCells, level: t.level, heights: t.heights, collision: t.collision,
    boxes: Float64Array.from(t.boxes), solid: Float64Array.from(solid.boxes), ring: Float64Array.from(solid.ring), samples: job.samples, band: job.band,
    ...(job.patch ? { patch: job.patch.heights } : {}),
  }
}

/** Each buffer of the arrays once, none empty (an empty one may be shared, and a buffer transferred twice throws). */
const buffersOf = (arrays: ReadonlyArray<Float32Array | Float64Array | undefined>): ArrayBuffer[] => {
  const out: ArrayBuffer[] = []
  for (const array of arrays) {
    const buffer = array?.buffer as ArrayBuffer | undefined
    if (buffer && buffer.byteLength > 0 && !out.includes(buffer)) out.push(buffer)
  }
  return out
}

/** The buffers a result hands over, each once and none empty (a height field may be its own collision field). */
export const transferOf = (r: GroundTileResult): ArrayBuffer[] => buffersOf([r.heights, r.collision, r.boxes, r.solid, r.ring, r.samples, r.band, r.patch])

/** The buffers a job hands over: its samples and band, or its patch. */
export const jobTransferOf = (job: GroundTileJob): ArrayBuffer[] => buffersOf([job.samples, job.band, job.patch?.heights])

/** The tile a result stands for, over the samples the main thread keeps for the tile (none for a patch tile, which keeps its patch instead). */
export const tileOfResult = (r: GroundTileResult, samples: Float64Array | null, patch?: HeightPatch): GroundTile => ({
  heights: r.heights, cells: r.cells, collision: r.collision, collisionCells: r.collisionCells, boxes: r.boxes,
  solid: r.level === null ? { boxes: r.solid, ring: r.ring } : NO_SOLID, level: r.level, samples, ...(patch ? { patch } : {}),
})
