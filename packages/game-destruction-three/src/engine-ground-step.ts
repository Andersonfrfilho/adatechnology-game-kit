/** How far (m) a sample may leave its cell's corners before the cell counts as holding a step. */
export const STEP_TOLERANCE = 0.005

/**
 * Whether a cell holds a step, from its nine samples in `s`: the corners (x0 z0, x1 z0, x0 z1, x1 z1), the centre, and the middles of its edges (z0, z1, x0, x1). A step
 * moves the centre or an edge's middle off its corners. The one test the tile (`engine-ground`) and the ring past it (`engine-ground-ring`) make, so both see the same cells.
 */
export const holdsStep = (s: ArrayLike<number>): boolean => {
  const off = (a: number, b: number): boolean => Math.abs(a - b) > STEP_TOLERANCE
  const c00 = s[0]!, c10 = s[1]!, c01 = s[2]!, c11 = s[3]!
  return off(s[4]!, (c00 + c10 + c01 + c11) / 4) || off(s[5]!, (c00 + c10) / 2) || off(s[6]!, (c01 + c11) / 2) || off(s[7]!, (c00 + c01) / 2) || off(s[8]!, (c10 + c11) / 2)
}
