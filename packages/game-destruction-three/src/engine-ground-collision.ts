/**
 * The engine collides with a tile's ground at a coarser grid than the tile is read at, as Unreal's "Simple Collision" mip level 1 does: every second corner of the 2.5 cm
 * grid, so a 5 cm height field. The read grid stays where the steps are found and the solid under the ground is made; the engine's narrow phase meets a quarter of the
 * triangles under a piece (the frame after a blast was mostly a piece resting on 2.5 cm triangles, T3.8ah). Owner decision 2026-11-17. The collision surface is off the drawn
 * ground by the bend of the ground across one of its cells: a tile keeps the coarse field only where that, with the engine's own 8 bit steps, is within 5 mm everywhere
 * on it, and has no step (`collisionStep`); else it collides at the read grid.
 */
export const GROUND_COLLISION_CELL = 0.05

/** The most (m) the collision surface may be off the drawn ground anywhere on a tile for the tile to collide at `GROUND_COLLISION_CELL` (the owner's bound). */
export const COLLISION_TOLERANCE = 0.005
/** Samples a side of the engine's height field blocks (`game-physics-jolt` `HEIGHT_BLOCK`): each block's heights are 8 bit steps of its own range. */
const ENGINE_BLOCK = 4

/** How many read cells (of `readCell` m, `cells` a side) a collision cell would span: 1 keeps the read grid (a collision cell that does not divide the tile). */
export const coarseStep = (cells: number, readCell: number): number => {
  const k = Math.max(1, Math.round(GROUND_COLLISION_CELL / readCell))
  return cells % k === 0 ? k : 1
}

/**
 * The step of a tile's collision field: the coarse one (`GROUND_COLLISION_CELL`) when the tile has no step boxes (a step's edge is between read corners, and a coarser
 * field ramps or grooves across it: 14 cm by a terrace's wall) and the coarse surface, on either diagonal and with the engine's 8 bit steps, is within
 * `COLLISION_TOLERANCE` of the drawn ground at every read corner (both are flat between them); else 1, the read grid itself.
 */
export const collisionStep = (heights: Float32Array, cells: number, readCell: number, hasSteps: boolean): number => {
  const k = coarseStep(cells, readCell)
  if (k === 1 || hasSteps || heights.length === 0) return 1
  const m = cells + 1
  const get = (p: number, q: number): number => heights[q * m + p]!
  let off = 0
  for (let q = 0; q <= cells; q++) {
    for (let p = 0; p <= cells; p++) {
      const [lo, hi] = collisionBoth(get, p, q, k)
      const h = heights[q * m + p]!
      off = Math.max(off, h - lo, hi - h)
    }
  }
  return off + quantumOf(collisionOf(heights, cells, k), cells / k) <= COLLISION_TOLERANCE ? k : 1
}

/** The most the engine's 8 bit heights may be off the field's own, over its blocks: half a step of a block's range. */
const quantumOf = (field: Float32Array, cells: number): number => {
  const m = cells + 1
  let most = 0
  for (let bj = 0; bj < cells; bj += ENGINE_BLOCK) {
    for (let bi = 0; bi < cells; bi += ENGINE_BLOCK) {
      let lo = Infinity, hi = -Infinity
      for (let j = bj; j <= Math.min(cells, bj + ENGINE_BLOCK); j++) {
        for (let i = bi; i <= Math.min(cells, bi + ENGINE_BLOCK); i++) {
          lo = Math.min(lo, field[j * m + i]!)
          hi = Math.max(hi, field[j * m + i]!)
        }
      }
      most = Math.max(most, (hi - lo) / 510)
    }
  }
  return most
}

/** The collision field of a tile's heights (`(cells + 1)^2`, x fastest): every `k`-th corner, `(cells / k + 1)^2` of them. */
export const collisionOf = (heights: Float32Array, cells: number, k: number): Float32Array => {
  if (k === 1) return heights
  const m = cells + 1
  const n = cells / k + 1
  const out = new Float32Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = heights[j * k * m + i * k]!
  return out
}

/**
 * The collision surface at the read corner (`p`, `q`) (any integers: past the tile too), from `get` of the corners on the collision grid (multiples of `k`): the lower of the
 * two ways the engine may cut the collision cell into triangles, so whichever it uses is no lower than this.
 */
export const collisionAt = (get: (p: number, q: number) => number, p: number, q: number, k: number): number => collisionBoth(get, p, q, k)[0]

/** The collision surface at the read corner (`p`, `q`) on the two ways a collision cell may be cut, the lower then the higher. */
const collisionBoth = (get: (p: number, q: number) => number, p: number, q: number, k: number): [number, number] => {
  const p0 = Math.floor(p / k) * k, q0 = Math.floor(q / k) * k
  const u = (p - p0) / k, v = (q - q0) / k
  if (u === 0 && v === 0) {
    const h = get(p0, q0)
    return [h, h]
  }
  // on a collision cell's edge only that edge's corners are asked for (the tile's last row and column have no cell past them)
  const p1 = u === 0 ? p0 : p0 + k, q1 = v === 0 ? q0 : q0 + k
  const h00 = get(p0, q0), h10 = get(p1, q0), h01 = get(p0, q1), h11 = get(p1, q1)
  // the diagonal from (0, 0) to (1, 1), and the one from (1, 0) to (0, 1)
  const main = u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01)
  const cross = u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11)
  return main < cross ? [main, cross] : [cross, main]
}

/**
 * A tile's read heights lowered, corner by corner, to the collision surface where it is lower: a grid nothing over which (taken flat between corners, as the engine takes
 * both surfaces) rises over either surface. What must stay under the ground (the solid under it, §12) is made over this.
 */
export const underBoth = (heights: Float32Array, cells: number, k: number): Float32Array => {
  if (k === 1) return heights
  const m = cells + 1
  const get = (p: number, q: number): number => heights[q * m + p]!
  const out = new Float32Array(m * m)
  for (let q = 0; q <= cells; q++) for (let p = 0; p <= cells; p++) out[q * m + p] = Math.min(heights[q * m + p]!, collisionAt(get, p, q, k))
  return out
}
