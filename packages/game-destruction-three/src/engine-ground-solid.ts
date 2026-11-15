/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to a top that never sticks out above the surface: a box where the block is level, a prism with a sloped top where it is not. A block is split until its top is
 * within `SOLID_RELIEF` of the surface or it is `SOLID_MIN_CELLS` cells wide, so anything under the surface rests on a top close to it and is pushed up through it.
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/** A top is this far (m) under the lowest corner it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. */
const SOLID_MARGIN = 0.005

export interface SolidVolume {
  /** Level blocks: centre x, y, z and half x, y, z, six numbers each. */
  readonly boxes: readonly number[]
  /** Sloped blocks: eight points (x, y, z) each, the four top corners first (x0z0, x1z0, x0z1, x1z1), then the four bottom ones under them. */
  readonly prisms: readonly number[]
}

export const NO_SOLID: SolidVolume = { boxes: [], prisms: [] }

/** The blocks under a tile of `cells` cells of side `cell` from (`x0`, `z0`), over its `heights` (`(cells + 1)^2`, x fastest). */
export const buildSolidVolume = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number): SolidVolume => {
  const m = cells + 1
  let low = Infinity
  for (const h of heights) low = Math.min(low, h)
  const bottom = low - SOLID_DEPTH
  const boxes: number[] = []
  const prisms: number[] = []
  const halves = (a: number, b: number): ReadonlyArray<readonly [number, number]> => (b - a < 2 ? [[a, b]] : [[a, (a + b) >> 1], [(a + b) >> 1, b]])
  const at = (i: number, j: number): number => heights[j * m + i]

  /** The plane through the block's corners lowered to its lowest sample: how far above it the surface goes (the gap), and the plane at the four corners. */
  const planeOf = (i0: number, j0: number, i1: number, j1: number): { gap: number; corners: number[] } => {
    const sx = (at(i1, j0) - at(i0, j0) + at(i1, j1) - at(i0, j1)) / 2 / (i1 - i0)
    const sz = (at(i0, j1) - at(i0, j0) + at(i1, j1) - at(i1, j0)) / 2 / (j1 - j0)
    let least = Infinity
    let most = -Infinity
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const above = at(i, j) - (at(i0, j0) + sx * (i - i0) + sz * (j - j0))
        if (above < least) least = above
        if (above > most) most = above
      }
    }
    const corner = (di: number, dj: number): number => at(i0, j0) + sx * di + sz * dj + least - SOLID_MARGIN
    return { gap: most - least, corners: [corner(0, 0), corner(i1 - i0, 0), corner(0, j1 - j0), corner(i1 - i0, j1 - j0)] }
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
    const span = Math.max(i1 - i0, j1 - j0)
    if (most - least <= SOLID_RELIEF) {
      const top = least - SOLID_MARGIN
      boxes.push(x0 + ((i0 + i1) / 2) * cell, (top + bottom) / 2, z0 + ((j0 + j1) / 2) * cell, ((i1 - i0) * cell) / 2, (top - bottom) / 2, ((j1 - j0) * cell) / 2)
      return
    }
    const plane = planeOf(i0, j0, i1, j1)
    if (plane.gap > SOLID_RELIEF && span > SOLID_MIN_CELLS) {
      for (const [a, b] of halves(i0, i1)) for (const [d, e] of halves(j0, j1)) fill(a, d, b, e)
      return
    }
    const xs = [x0 + i0 * cell, x0 + i1 * cell]
    const zs = [z0 + j0 * cell, z0 + j1 * cell]
    for (let k = 0; k < 4; k++) prisms.push(xs[k & 1]!, plane.corners[k]!, zs[k >> 1]!)
    for (let k = 0; k < 4; k++) prisms.push(xs[k & 1]!, bottom, zs[k >> 1]!)
  }
  fill(0, 0, cells, cells)
  return { boxes, prisms }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes) && same(a.prisms, b.prisms)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
