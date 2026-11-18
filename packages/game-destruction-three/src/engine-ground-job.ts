import { GROUND_CELL, shapeGround } from './engine-ground'
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
  readonly samples: Float64Array
  readonly band: Float64Array
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

/** The tile a job makes: `shapeGround` of its samples and, under a height field, its solid over the band. Pure of the job. */
export const computeGroundTile = (job: GroundTileJob): GroundTileResult => {
  const t = shapeGround(job.samples, job.x0, job.z0, job.size, null, job.wasCoarse)
  const solid = t.level === null ? buildSolidVolume(t.heights, t.cells, job.x0, job.z0, job.size / t.cells, job.band, t.cells / t.collisionCells) : NO_SOLID
  return {
    id: job.id, cells: t.cells, collisionCells: t.collisionCells, level: t.level, heights: t.heights, collision: t.collision,
    boxes: Float64Array.from(t.boxes), solid: Float64Array.from(solid.boxes), ring: Float64Array.from(solid.ring), samples: job.samples, band: job.band,
  }
}

/** The buffers a result hands over, each once and none empty (a height field may be its own collision field). */
export const transferOf = (r: GroundTileResult): ArrayBuffer[] => {
  const out: ArrayBuffer[] = []
  for (const array of [r.heights, r.collision, r.boxes, r.solid, r.ring, r.samples, r.band]) {
    const buffer = array.buffer as ArrayBuffer
    if (buffer.byteLength > 0 && !out.includes(buffer)) out.push(buffer)
  }
  return out
}

/** The tile a result stands for, over the samples the main thread keeps for the tile. */
export const tileOfResult = (r: GroundTileResult, samples: Float64Array): GroundTile => ({
  heights: r.heights, cells: r.cells, collision: r.collision, collisionCells: r.collisionCells, boxes: Array.from(r.boxes),
  solid: r.level === null ? { boxes: Array.from(r.solid), ring: Array.from(r.ring) } : NO_SOLID, level: r.level, samples,
})
