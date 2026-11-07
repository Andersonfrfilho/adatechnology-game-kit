import { createRng } from './math'

/**
 * The path of a stair-step crack in a wall of units, in the wall's plane: `h` metres toward the side that went down, `u` metres up. In running bond a
 * crack through the joints goes half a unit along a bed joint and one course up a head joint, again and again, so it climbs at about 45 degrees for a
 * brick of 19 x 9 cm. `step` is the run of one unit and the rise of one course; `seed` makes the same crack every time.
 */
export function stairCrackPath(spec: { readonly length: number; readonly step: readonly [number, number]; readonly seed: number }): Array<[number, number]> {
  const rnd = createRng(spec.seed)
  const run = Math.max(0.02, spec.step[0] / 2)
  const rise = Math.max(0.02, spec.step[1])
  const points: Array<[number, number]> = [[0, 0]]
  let h = 0
  let u = 0
  let walked = 0
  while (walked < spec.length) {
    // a head joint is not always the next one along: now and then the crack runs on a whole unit before it climbs
    const along = run * (rnd() < 0.2 ? 2 : 1)
    h += along
    points.push([h, u])
    u += rise
    points.push([h, u])
    walked += along + rise
  }
  return points
}

/**
 * The crack as a strip of triangles over the path, `width` metres wide at its start and narrowing to `taper` of that at its end: flat (`h`, `u`)
 * pairs, three points a triangle, wound counter-clockwise seen from +h × +u.
 */
export function stairCrackStrip(points: ReadonlyArray<readonly [number, number]>, width: number, taper: number): number[] {
  const out: number[] = []
  const n = points.length - 1
  for (let k = 0; k < n; k++) {
    const [h0, u0] = points[k]!
    const [h1, u1] = points[k + 1]!
    const length = Math.hypot(h1 - h0, u1 - u0) || 1
    const half0 = (width * (1 - ((1 - taper) * k) / n)) / 2
    const half1 = (width * (1 - ((1 - taper) * (k + 1)) / n)) / 2
    // the side of the segment, and a joint's worth past each end so the steps meet without gaps
    const sh = -(u1 - u0) / length
    const su = (h1 - h0) / length
    const eh = ((h1 - h0) / length) * half0
    const eu = ((u1 - u0) / length) * half0
    const a: [number, number] = [h0 - eh - sh * half0, u0 - eu - su * half0]
    const b: [number, number] = [h1 + eh - sh * half1, u1 + eu - su * half1]
    const c: [number, number] = [h1 + eh + sh * half1, u1 + eu + su * half1]
    const d: [number, number] = [h0 - eh + sh * half0, u0 - eu + su * half0]
    out.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  return out
}
