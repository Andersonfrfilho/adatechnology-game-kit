/**
 * The ground a tile's solid reads around the tile: its own heights inside, and past its edges, as far as `SOLID_RING`, the ground the neighbour tile is made from (`groundAt`),
 * read only where a block of the solid reaches and once each. Every sample read past the edge is kept (`read`): the solid depends on them, so a change there makes it again.
 */

/**
 * How far (m) past its tile's edges a block of the solid may reach: a cell of overlap, the skew of a top turned about both axes (a cell or two at the edge's block sizes), and a
 * box at least 15 cm deep at any slope (`engine-ground-solid` caps the depth of a box that would lean further). The host's changes this close to a tile make its solid again.
 */
export const SOLID_RING = 0.2
/** How far (m) a cell's centre may leave its corners' mean before the cell counts as holding a step: `engine-ground`'s own tolerance. */
const STEP_TOLERANCE = 0.005

export interface GroundRing {
  /** How many cells the ring is wide. */
  readonly cells: number
  /** The four corners (`(i, j)`, `(i + 1, j)`, `(i, j + 1)`, `(i + 1, j + 1)`) of a cell past the tile's edge into `out`; a cell holding a step has its lowest sample (corners and centre) at all four. */
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

export const createGroundRing = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number, groundAt: (x: number, z: number) => number): GroundRing => {
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
    const h = groundAt(x, z)
    heldSamples[key] = h
    sampleBuild[key] = mark
    read.push(x, z, h)
    return h
  }
  const off = (a: number, b: number): boolean => Math.abs(a - b) > STEP_TOLERANCE
  return {
    cells: ring,
    read,
    cell(i, j, out) {
      const key = (j + ring) * across + i + ring
      if (cellBuild[key] !== mark) {
        const a = 2 * i, b = 2 * j
        const c00 = half(a, b), c10 = half(a + 2, b), c01 = half(a, b + 2), c11 = half(a + 2, b + 2)
        const centre = half(a + 1, b + 1)
        // a step through the cell moves its centre off its corners' mean (a step that cuts off one corner by a quarter of its height); where it runs is not known, so
        // the ground there is no lower than its lowest sample
        const step = off(centre, (c00 + c10 + c01 + c11) / 4)
        const floor = Math.min(c00, c10, c01, c11, centre)
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
