/**
 * The engine collides with a tile's ground at a coarser grid than the tile is read at, as Unreal's "Simple Collision" mip level 1 does: every second corner of the 2.5 cm
 * grid, so a 5 cm height field. The read grid stays where the steps are found and the solid under the ground is made; the engine's narrow phase meets a quarter of the
 * triangles under a piece (the frame after a blast was mostly a piece resting on 2.5 cm triangles, T3.8ah). Owner decision 2026-11-17. The collision surface is off the drawn
 * ground by the bend of the ground across one of its cells: a few millimetres on a crater's wall (`engine-ground.test.ts` holds it under 5 mm).
 */
export const GROUND_COLLISION_CELL = 0.05

/** How many read cells (of `readCell` m, `cells` a side) one collision cell spans along each side: 1 keeps the read grid (a collision cell that does not divide the tile). */
export const collisionStep = (cells: number, readCell: number): number => {
  const k = Math.max(1, Math.round(GROUND_COLLISION_CELL / readCell))
  return cells % k === 0 ? k : 1
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
export const collisionAt = (get: (p: number, q: number) => number, p: number, q: number, k: number): number => {
  const p0 = Math.floor(p / k) * k, q0 = Math.floor(q / k) * k
  const u = (p - p0) / k, v = (q - q0) / k
  if (u === 0 && v === 0) return get(p0, q0)
  // on a collision cell's edge only that edge's corners are asked for (the tile's last row and column have no cell past them)
  const p1 = u === 0 ? p0 : p0 + k, q1 = v === 0 ? q0 : q0 + k
  const h00 = get(p0, q0), h10 = get(p1, q0), h01 = get(p0, q1), h11 = get(p1, q1)
  // the diagonal from (0, 0) to (1, 1), and the one from (1, 0) to (0, 1)
  const main = u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01)
  const cross = u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11)
  return Math.min(main, cross)
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
