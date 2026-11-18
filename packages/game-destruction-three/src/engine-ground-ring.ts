import { collisionAt } from './engine-ground-collision'
import { holdsStep } from './engine-ground-step'

/**
 * The ground a tile's solid reads around the tile: its own heights inside, and past its edges, as far as `SOLID_RING`, the ground the neighbour tile is made from (`groundAt`),
 * read only where a block of the solid reaches and once each. Every sample read past the edge is kept (`read`): the solid depends on them, so a change there makes it again.
 */

/**
 * How far (m) past its tile's edges a block of the solid may reach: a cell of overlap, the skew of a top turned about both axes (a cell or two at the edge's block sizes), and a
 * box at least 15 cm deep at any slope (`engine-ground-solid` caps the depth of a box that would lean further). The host's changes this close to a tile make its solid again.
 */
export const SOLID_RING = 0.2
/** One cell's nine samples, for `holdsStep`. */
const nine = new Float64Array(9)

/**
 * Where the ring reads the ground past the tile's edges: the host's `groundAt`, or a band read ahead of time (`engine-ground-job` `readGroundBand`), one height per half cell
 * `(a, b)` at `(b + 2 * ring) * width + a + 2 * ring` (`width` = `2 * (cells + 2 * ring) + 1`), each the very height `groundAt` answers there. A worker has no `groundAt`.
 */
export type GroundSource = ((x: number, z: number) => number) | Float64Array

export interface GroundRing {
  /** How many cells the ring is wide. */
  readonly cells: number
  /** The four corners (`(i, j)`, `(i + 1, j)`, `(i, j + 1)`, `(i + 1, j + 1)`) of a cell past the tile's edge into `out`; a cell holding a step (`holdsStep`, as the neighbour builds it) has its lowest of nine samples at all four. */
  cell(i: number, j: number, out: Float64Array): void
  /** The samples read past the edge: x, z and height, three numbers each. */
  readonly read: number[]
}

// the samples and cells read for the ring being made, marked by the build they belong to (one at a time), so a ring costs no new arrays
let build = 0
let heldSamples = new Float64Array(0)
let sampleBuild = new Uint32Array(0)
let heldCells = new Float64Array(0)
let cellBuild = new Uint32Array(0)

/**
 * `heights` are the tile's own (already under its collision field), `fieldStep` how many read cells a neighbour's coarse collision cell spans: past the edge a corner is the lower of
 * the ground there and that coarse field at it (the neighbour collides with it or with the ground itself).
 */
export const createGroundRing = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number, groundAt: GroundSource, fieldStep = 1): GroundRing => {
  const band = typeof groundAt === 'function' ? null : groundAt
  const ring = Math.round(SOLID_RING / cell)
  const m = cells + 1
  const width = 2 * (cells + 2 * ring) + 1
  const across = cells + 2 * ring
  if (sampleBuild.length < width * width) {
    heldSamples = new Float64Array(width * width)
    sampleBuild = new Uint32Array(width * width)
  }
  if (cellBuild.length < across * across) {
    heldCells = new Float64Array(4 * across * across)
    cellBuild = new Uint32Array(across * across)
  }
  const mark = ++build
  const read: number[] = []
  /** The ground at the half cell (`a` / 2, `b` / 2): the tile's own height at its corners, the neighbour's ground elsewhere. */
  const half = (a: number, b: number): number => {
    if (a % 2 === 0 && b % 2 === 0 && a >= 0 && b >= 0 && a <= 2 * cells && b <= 2 * cells) return heights[(b / 2) * m + a / 2]!
    const key = (b + 2 * ring) * width + a + 2 * ring
    if (sampleBuild[key] === mark) return heldSamples[key]!
    const x = x0 + (a / 2) * cell
    const z = z0 + (b / 2) * cell
    const h = band === null ? (groundAt as (x: number, z: number) => number)(x, z) : band[key]!
    heldSamples[key] = h
    sampleBuild[key] = mark
    read.push(x, z, h)
    return h
  }
  /** The ground at the read corner (`p`, `q`). */
  const fine = (p: number, q: number): number => half(2 * p, 2 * q)
  return {
    cells: ring,
    read,
    cell(i, j, out) {
      const key = (j + ring) * across + i + ring
      if (cellBuild[key] !== mark) {
        const a = 2 * i, b = 2 * j
        nine[0] = half(a, b)
        nine[1] = half(a + 2, b)
        nine[2] = half(a, b + 2)
        nine[3] = half(a + 2, b + 2)
        nine[4] = half(a + 1, b + 1)
        nine[5] = half(a + 1, b)
        nine[6] = half(a + 1, b + 2)
        nine[7] = half(a, b + 1)
        nine[8] = half(a + 2, b + 1)
        // a cell the neighbour builds as a step: where the step runs in it is not known, so the ground there is no lower than its lowest sample
        const step = holdsStep(nine)
        let floor = Infinity
        for (let k = 0; k < 9; k++) floor = Math.min(floor, nine[k]!)
        const corner = (p: number, q: number, h: number): number => (fieldStep === 1 ? h : Math.min(h, collisionAt(fine, p, q, fieldStep)))
        const c00 = corner(i, j, nine[0]!), c10 = corner(i + 1, j, nine[1]!), c01 = corner(i, j + 1, nine[2]!), c11 = corner(i + 1, j + 1, nine[3]!)
        heldCells[4 * key] = step ? floor : c00
        heldCells[4 * key + 1] = step ? floor : c10
        heldCells[4 * key + 2] = step ? floor : c01
        heldCells[4 * key + 3] = step ? floor : c11
        cellBuild[key] = mark
      }
      for (let k = 0; k < 4; k++) out[k] = heldCells[4 * key + k]!
    },
  }
}
