import { convexFaces } from './hull-geometry'
import type { HullSoup } from './vehicle-hulls'

/** A point of a hull face is floating when no drawn triangle of the piece is within this (m): a ball of the check (r = 10 cm) leans on it with nothing drawn at its side (design 10.3, K3). */
export const FLOATING_REACH = 0.05
/** The floating area (m2) of a hull a piece is divided again over. */
export const FLOATING_AREA = 0.004

/** Samples of a face are on a grid of this many steps along each edge. */
const STEPS = 3

/** Triangles are looked up in a grid of this cell (m); one covering more than `MAX_CELLS` cells is always looked at. */
const CELL = 0.1
const MAX_CELLS = 64
const cellKey = (x: number, y: number, z: number): number => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)

type Point = readonly [number, number, number]

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Squared distance from `p` to the triangle `a b c` (closest point on the triangle). */
const distanceSquared = (p: Point, a: Point, b: Point, c: Point): number => {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  let closest: Point
  const at = (u: number, v: number): Point => [a[0] + ab[0] * u + ac[0] * v, a[1] + ab[1] * u + ac[1] * v, a[2] + ab[2] * u + ac[2] * v]
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp)
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp)
  const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4
  if (d1 <= 0 && d2 <= 0) closest = a
  else if (d3 >= 0 && d4 <= d3) closest = b
  else if (vc <= 0 && d1 >= 0 && d3 <= 0) closest = at(d1 / (d1 - d3), 0)
  else if (d6 >= 0 && d5 <= d6) closest = c
  else if (vb <= 0 && d2 >= 0 && d6 <= 0) closest = at(0, d2 / (d2 - d6))
  else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) closest = at(1 - (d4 - d3) / (d4 - d3 + (d5 - d6)), (d4 - d3) / (d4 - d3 + (d5 - d6)))
  else {
    const sum = va + vb + vc
    closest = at(vb / sum, vc / sum)
  }
  const d = sub(p, closest)
  return dot(d, d)
}

/** The triangles of a piece laid in a grid, to ask whether any is near a point. */
export interface DrawnIndex {
  readonly isNear: (x: number, y: number, z: number) => boolean
}

/** The grid of the triangles of a piece (all of them, protrusions too: they are drawn), built the first time it is asked and then kept. */
export const drawnIndexOf = (soup: HullSoup): DrawnIndex => {
  let built: DrawnIndex | null = null
  return { isNear: (x, y, z) => (built ??= buildIndex(soup)).isNear(x, y, z) }
}

const buildIndex = (soup: HullSoup): DrawnIndex => {
  const triangles = soup.indices.length / 3
  const corner = new Float64Array(triangles * 9)
  const boxes = new Float64Array(triangles * 6)
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      const v = soup.indices[t * 3 + k]! * 3
      for (let a = 0; a < 3; a++) corner[t * 9 + k * 3 + a] = soup.vertices[v + a]!
    }
    for (let a = 0; a < 3; a++) {
      const x = corner[t * 9 + a]!, y = corner[t * 9 + 3 + a]!, z = corner[t * 9 + 6 + a]!
      boxes[t * 6 + a] = Math.min(x, y, z) - FLOATING_REACH
      boxes[t * 6 + 3 + a] = Math.max(x, y, z) + FLOATING_REACH
    }
  }
  const cells = new Map<number, number[]>()
  const wide: number[] = []
  for (let t = 0; t < triangles; t++) {
    const o = t * 6
    const [x0, y0, z0, x1, y1, z1] = [0, 1, 2, 3, 4, 5].map((k) => Math.floor(boxes[o + k]! / CELL))
    if ((x1! - x0! + 1) * (y1! - y0! + 1) * (z1! - z0! + 1) > MAX_CELLS) {
      wide.push(t)
      continue
    }
    for (let x = x0!; x <= x1!; x++) for (let y = y0!; y <= y1!; y++) for (let z = z0!; z <= z1!; z++) {
      const key = cellKey(x, y, z)
      const list = cells.get(key)
      if (list) list.push(t)
      else cells.set(key, [t])
    }
  }
  const isNearTriangle = (t: number, x: number, y: number, z: number): boolean => {
    const o = t * 6
    if (x < boxes[o]! || y < boxes[o + 1]! || z < boxes[o + 2]! || x > boxes[o + 3]! || y > boxes[o + 4]! || z > boxes[o + 5]!) return false
    const c = t * 9
    return distanceSquared([x, y, z], [corner[c]!, corner[c + 1]!, corner[c + 2]!], [corner[c + 3]!, corner[c + 4]!, corner[c + 5]!], [corner[c + 6]!, corner[c + 7]!, corner[c + 8]!]) <= FLOATING_REACH * FLOATING_REACH
  }
  return {
    isNear: (x, y, z) => {
      for (const t of cells.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL))) ?? []) if (isNearTriangle(t, x, y, z)) return true
      for (const t of wide) if (isNearTriangle(t, x, y, z)) return true
      return false
    },
  }
}

/**
 * The area (m2) of the hull's faces that is floating: samples of each face with no triangle of the piece within `FLOATING_REACH`. It is what a convex hull of a concave piece adds over
 * the drawn one (the cone from an antenna's tip to the roof, the filled floor between its rails); a piece is divided over it. A local stand-in for K3: only the piece's own triangles count.
 */
export const floatingAreaOf = (points: ArrayLike<number>, drawn: DrawnIndex): number => {
  const faces = convexFaces(points)
  if (!faces) return 0
  const vertex = (i: number): Point => [points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!]
  let floating = 0
  for (const [ia, ib, ic] of faces) {
    const a = vertex(ia), b = vertex(ib), c = vertex(ic)
    const ab = sub(b, a), ac = sub(c, a)
    const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) / 2
    let samples = 0, far = 0
    for (let i = 0; i <= STEPS; i++) {
      for (let j = 0; i + j <= STEPS; j++) {
        samples++
        const u = i / STEPS, v = j / STEPS
        if (!drawn.isNear(a[0] + ab[0] * u + ac[0] * v, a[1] + ab[1] * u + ac[1] * v, a[2] + ab[2] * u + ac[2] * v)) far++
      }
    }
    floating += (area * far) / samples
  }
  return floating
}
