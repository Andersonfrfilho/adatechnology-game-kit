/** The grid of a wall's mask a stamp writes: `len` metres along over `w` texels, `height` metres up from `y0` over `h` texels. */
export type StampGrid = {
  readonly data: Uint8Array
  readonly w: number
  readonly h: number
  readonly len: number
  readonly y0: number
  readonly height: number
}

/** A box along the wall (`s0`–`s1`) and up (`y0`–`y1`), in metres, grown by `reach` on every side. */
export type StampBox = { readonly s0: number; readonly s1: number; readonly y0: number; readonly y1: number; readonly reach: number }

/**
 * Marks through (255) the texels of `box` whose centre is `inside`. A texel already through is skipped without asking `inside`: each hole's ragged edge
 * asks noise per texel, and the holes a blast leaves overlap (adjacent bricks share their edges and their reach), so asking again was most of the paint.
 */
export function stampMask(grid: StampGrid, box: StampBox, inside: (s: number, y: number) => boolean): void {
  const { data, w, h, len, y0, height } = grid
  const i0 = Math.max(0, Math.floor((box.s0 - box.reach) / len * w)), i1 = Math.min(w - 1, Math.ceil((box.s1 + box.reach) / len * w))
  const j0 = Math.max(0, Math.floor((box.y0 - box.reach - y0) / height * h)), j1 = Math.min(h - 1, Math.ceil((box.y1 + box.reach - y0) / height * h))
  for (let j = j0; j <= j1; j++) {
    const y = y0 + (j + 0.5) / h * height
    for (let i = i0; i <= i1; i++) {
      const at = j * w + i
      if (data[at] === 255) continue
      if (inside((i + 0.5) / w * len, y)) data[at] = 255
    }
  }
}

/** The plaster that breaks off around a hole: `least` metres always, and up to `band` metres more where its ragged edge (noise in [0, 1)) reaches. */
export type SpallReach = { readonly least: number; readonly band: number }

/**
 * Whether the plaster is gone at distance `d` from a hole. The noise is asked only inside the ragged band: within `least` it is gone and past `least + band` it
 * stays whatever the noise says, and those are most of the texels a hole stamps (the same answer as asking the noise everywhere).
 */
export function isPlasterGone(d: number, reach: SpallReach, ragged: () => number): boolean {
  if (d <= reach.least) return true
  if (d > reach.least + reach.band) return false
  return d <= reach.least + reach.band * ragged()
}

/**
 * Whether a shot broke through the unit at a texel of its crater: `distance` is the texel's signed distance to the crater's ellipse (negative inside), and
 * the hole runs up to `depth` metres in from it, as deep there as `noise` (in [0, 1]) says. Outside the ellipse it never does and deeper than `depth` it
 * always does, so only the ring between asks the noise (the same answer as asking it everywhere).
 */
export function isCoreThrough(distance: number, depth: number, noise: () => number): boolean {
  if (distance > 0) return false
  if (distance <= -depth) return true
  return distance <= -depth * noise()
}
