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
