/**
 * The solid under a height field. Jolt's height field is a surface: a body that ends up wholly below it (ground raised under a sleeping piece, a piece that
 * tunnelled) has nothing to push it out and falls for good. Under the surface of a tile there are blocks, from the lowest ground of the tile less `SOLID_DEPTH`
 * up to the lowest ground over the block less `SOLID_MARGIN`: never above the surface (§12). A block is split until a plane through its corners is within `SOLID_RELIEF`
 * of the surface or it is `SOLID_MIN_CELLS` cells wide, so a level block's top is close to the surface and a sloped block's top is under its lowest point. Every block
 * is a box: a sloped one used to be a prism with a planar top, a convex hull each, and a crater tile's 400 hulls were most of the frame after the blast (T3.8ag).
 */

/** How far (m) under the lowest corner of its tile the solid goes. */
export const SOLID_DEPTH = 0.5
/** How far (m) under the surface a block's top may be before the block is split, unless it is already `SOLID_MIN_CELLS` cells wide. */
const SOLID_RELIEF = 0.005
const SOLID_MIN_CELLS = 3
/** A top is this far (m) under the lowest corner it stands for: 2 mm put the solid in the contacts of what rests on the surface and the bowl's seed 18 gained 4 cm. */
export const SOLID_MARGIN = 0.005

export interface SolidVolume {
  /** The blocks: centre x, y, z and half x, y, z, six numbers each. */
  readonly boxes: readonly number[]
}

export const NO_SOLID: SolidVolume = { boxes: [] }

/** The blocks under a tile of `cells` cells of side `cell` from (`x0`, `z0`), over its `heights` (`(cells + 1)^2`, x fastest). */
export const buildSolidVolume = (heights: Float32Array, cells: number, x0: number, z0: number, cell: number): SolidVolume => {
  const m = cells + 1
  let low = Infinity
  for (const h of heights) low = Math.min(low, h)
  const bottom = low - SOLID_DEPTH
  const boxes: number[] = []
  const halves = (a: number, b: number): ReadonlyArray<readonly [number, number]> => (b - a < 2 ? [[a, b]] : [[a, (a + b) >> 1], [(a + b) >> 1, b]])
  const at = (i: number, j: number): number => heights[j * m + i]

  /** How far the surface rises above the plane through the block's corners lowered to its lowest sample: the block is split while it is more. */
  const planeGap = (i0: number, j0: number, i1: number, j1: number): number => {
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
    return most - least
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
    if (most - least > SOLID_RELIEF && planeGap(i0, j0, i1, j1) > SOLID_RELIEF && Math.max(i1 - i0, j1 - j0) > SOLID_MIN_CELLS) {
      for (const [a, b] of halves(i0, i1)) for (const [d, e] of halves(j0, j1)) fill(a, d, b, e)
      return
    }
    const top = least - SOLID_MARGIN
    boxes.push(x0 + ((i0 + i1) / 2) * cell, (top + bottom) / 2, z0 + ((j0 + j1) / 2) * cell, ((i1 - i0) * cell) / 2, (top - bottom) / 2, ((j1 - j0) * cell) / 2)
  }
  fill(0, 0, cells, cells)
  return { boxes }
}

/** The same blocks. */
export const sameSolid = (a: SolidVolume, b: SolidVolume): boolean => same(a.boxes, b.boxes)

const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])
