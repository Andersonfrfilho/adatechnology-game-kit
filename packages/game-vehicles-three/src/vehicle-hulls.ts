import { convexFaces, reducePoints } from './hull-geometry'
import type { HullFace } from './hull-geometry'

/** Points a hull is made of at most (design 10.3, H6). */
export const MAX_HULL_POINTS = 64
/** A hull stands this far (m) inside the drawn shell at most: the chord of a curved panel is air inside the car. */
export const MAX_STANDOFF_INSIDE = 0.03
/** A hull stands this far (m) outside the drawn shell at most (H2): beyond it, a thing that rests on the hull floats in the air. */
export const MAX_STANDOFF_OUTSIDE = 0.01
/** A thin hull is extruded inward up to this thickness (m), never outward. */
export const THIN_UNDER = 0.03
/** The cell (m) of the vehicle a part's drawing starts from; a cell whose hull is not close enough to the drawn shell is cut in half along its longest side. */
export const HULL_CELL = 1.6
/** A cell is not cut below this side (m), nor more than this many times. */
const MIN_SIDE = 0.1
const MAX_DEPTH = 6
/** Samples of the drawn surface are this far apart at most (m): the nearest one is within half of it of the true surface. */
const SURFACE_STEP = 0.01
/** Samples on a hull face are this far apart at most (m), and at most this many along a side. */
const FACE_STEP = 0.05
const FACE_MAX_SIDE = 24
/** The cell (m) of the hash the nearest drawn sample is looked for in: the search of one cell around reaches `MAX_STANDOFF_INSIDE`. */
const HASH_CELL = MAX_STANDOFF_INSIDE

type Vec3 = readonly [number, number, number]

/** The triangles of a drawn piece (or of several, merged) in the vehicle's frame. */
export interface HullSoup {
  readonly vertices: readonly number[]
  readonly indices: readonly number[]
}

const hashKey = (x: number, y: number, z: number): number => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)

/** The drawn surface as points no more than `SURFACE_STEP` apart, in a hash of `HASH_CELL` cubes. */
class SurfaceSamples {
  private readonly cells = new Map<number, number[]>()

  constructor(soup: HullSoup, triangles: readonly number[]) {
    const v = soup.vertices
    for (const t of triangles) {
      const a = soup.indices[t * 3]! * 3, b = soup.indices[t * 3 + 1]! * 3, c = soup.indices[t * 3 + 2]! * 3
      const longest = Math.max(
        Math.hypot(v[a]! - v[b]!, v[a + 1]! - v[b + 1]!, v[a + 2]! - v[b + 2]!),
        Math.hypot(v[b]! - v[c]!, v[b + 1]! - v[c + 1]!, v[b + 2]! - v[c + 2]!),
        Math.hypot(v[c]! - v[a]!, v[c + 1]! - v[a + 1]!, v[c + 2]! - v[a + 2]!),
      )
      const n = Math.min(200, Math.max(1, Math.ceil(longest / SURFACE_STEP)))
      for (let i = 0; i <= n; i++) {
        for (let j = 0; i + j <= n; j++) {
          const u = i / n, w = j / n, s = 1 - u - w
          this.add(v[a]! * s + v[b]! * u + v[c]! * w, v[a + 1]! * s + v[b + 1]! * u + v[c + 1]! * w, v[a + 2]! * s + v[b + 2]! * u + v[c + 2]! * w)
        }
      }
    }
  }

  private add(x: number, y: number, z: number): void {
    const key = hashKey(Math.floor(x / HASH_CELL), Math.floor(y / HASH_CELL), Math.floor(z / HASH_CELL))
    let list = this.cells.get(key)
    if (!list) this.cells.set(key, (list = []))
    list.push(x, y, z)
  }

  /** The drawn sample nearest to the point within `HASH_CELL`, or null when there is none. */
  nearest(x: number, y: number, z: number): { readonly at: Vec3; readonly distance: number } | null {
    const cx = Math.floor(x / HASH_CELL), cy = Math.floor(y / HASH_CELL), cz = Math.floor(z / HASH_CELL)
    let best = Infinity
    let at: Vec3 = [0, 0, 0]
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const list = this.cells.get(hashKey(cx + i, cy + j, cz + k))
      if (!list) continue
      for (let m = 0; m < list.length; m += 3) {
        const d = (list[m]! - x) ** 2 + (list[m + 1]! - y) ** 2 + (list[m + 2]! - z) ** 2
        if (d < best) [best, at] = [d, [list[m]!, list[m + 1]!, list[m + 2]!]]
      }
    }
    return best <= HASH_CELL * HASH_CELL ? { at, distance: Math.sqrt(best) } : null
  }
}

/** Whether a face sample is farther from the drawn shell than a hull may be: on the drawn side of the face (the shell beyond it, in the car) `MAX_STANDOFF_INSIDE`, on the other `MAX_STANDOFF_OUTSIDE`. */
const standsOff = (surface: SurfaceSamples, point: Vec3, normal: Vec3): boolean => {
  const near = surface.nearest(point[0], point[1], point[2])
  if (!near) return true
  const toward = (near.at[0] - point[0]) * normal[0] + (near.at[1] - point[1]) * normal[1] + (near.at[2] - point[2]) * normal[2]
  return toward < 0 && near.distance > MAX_STANDOFF_OUTSIDE
}

const facesAreClose = (points: readonly number[], faces: readonly HullFace[], surface: SurfaceSamples): boolean => {
  for (const [a, b, c] of faces) {
    const pa: Vec3 = [points[a * 3]!, points[a * 3 + 1]!, points[a * 3 + 2]!]
    const pb: Vec3 = [points[b * 3]!, points[b * 3 + 1]!, points[b * 3 + 2]!]
    const pc: Vec3 = [points[c * 3]!, points[c * 3 + 1]!, points[c * 3 + 2]!]
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2]
    const wx = pc[0] - pa[0], wy = pc[1] - pa[1], wz = pc[2] - pa[2]
    const cross: Vec3 = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]
    const length = Math.hypot(...cross) || 1
    const normal: Vec3 = [cross[0] / length, cross[1] / length, cross[2] / length]
    const longest = Math.max(Math.hypot(ux, uy, uz), Math.hypot(wx, wy, wz), Math.hypot(pc[0] - pb[0], pc[1] - pb[1], pc[2] - pb[2]))
    const n = Math.min(FACE_MAX_SIDE, Math.max(1, Math.ceil(longest / FACE_STEP)))
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        const u = i / n, w = j / n, s = 1 - u - w
        const sample: Vec3 = [pa[0] * s + pb[0] * u + pc[0] * w, pa[1] * s + pb[1] * u + pc[1] * w, pa[2] * s + pb[2] * u + pc[2] * w]
        if (standsOff(surface, sample, normal)) return false
      }
    }
  }
  return true
}

/** The points of the triangles of a cell (x y z triples, each vertex once). */
const pointsOfTriangles = (soup: HullSoup, triangles: readonly number[]): number[] => {
  const seen = new Set<number>()
  const out: number[] = []
  for (const t of triangles) {
    for (let k = 0; k < 3; k++) {
      const vertex = soup.indices[t * 3 + k]!
      if (seen.has(vertex)) continue
      seen.add(vertex)
      out.push(soup.vertices[vertex * 3]!, soup.vertices[vertex * 3 + 1]!, soup.vertices[vertex * 3 + 2]!)
    }
  }
  return out
}

/** The normal of the largest triangle of the cell: the direction a thin hull is thin along. */
const mainNormal = (soup: HullSoup, triangles: readonly number[]): Vec3 => {
  const v = soup.vertices
  let best: Vec3 = [0, 1, 0]
  let bestArea = 0
  for (const t of triangles) {
    const a = soup.indices[t * 3]! * 3, b = soup.indices[t * 3 + 1]! * 3, c = soup.indices[t * 3 + 2]! * 3
    const ux = v[b]! - v[a]!, uy = v[b + 1]! - v[a + 1]!, uz = v[b + 2]! - v[a + 2]!
    const wx = v[c]! - v[a]!, wy = v[c + 1]! - v[a + 1]!, wz = v[c + 2]! - v[a + 2]!
    const cross: Vec3 = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]
    const area = Math.hypot(...cross)
    if (area > bestArea) [best, bestArea] = [[cross[0] / area, cross[1] / area, cross[2] / area], area]
  }
  return best
}

/** The points plus a copy of each moved `depth` along the normal that points toward `centre`: a sheet becomes a slab that reaches into the car, never out of it. */
const extrudedInward = (points: readonly number[], normal: Vec3, centre: Vec3, depth: number): number[] => {
  let at = 0
  for (let i = 0; i < points.length; i += 3) at += (centre[0] - points[i]!) * normal[0] + (centre[1] - points[i + 1]!) * normal[1] + (centre[2] - points[i + 2]!) * normal[2]
  const sign = at >= 0 ? 1 : -1
  const out = [...points]
  for (let i = 0; i < points.length; i += 3) out.push(points[i]! + sign * normal[0] * depth, points[i + 1]! + sign * normal[1] * depth, points[i + 2]! + sign * normal[2] * depth)
  return out
}

/** How far the points reach along the normal (m). */
const spreadAlong = (points: readonly number[], normal: Vec3): number => {
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < points.length; i += 3) {
    const t = points[i]! * normal[0] + points[i + 1]! * normal[1] + points[i + 2]! * normal[2]
    if (t < low) low = t
    if (t > high) high = t
  }
  return high - low
}

/** Two groups of triangles apart by at least this much (m) along an axis are cut there: a hollow shell is two sheets, and no cut across its long side separates them. */
const MIN_GAP = 0.03

/** The cell cut in two: at the widest gap between the triangles' centres along any axis when it is `MIN_GAP` or more, else at the middle of its longest side. */
const halves = (soup: HullSoup, triangles: readonly number[]): [number[], number[]] | null => {
  const centres = triangles.map((t) => {
    const c = [0, 0, 0]
    for (let k = 0; k < 3; k++) for (let m = 0; m < 3; m++) c[m] = c[m]! + soup.vertices[soup.indices[t * 3 + k]! * 3 + m]! / 3
    return c
  })
  let cutAxis = -1
  let cutAt = 0
  let widest = MIN_GAP
  let longest = 0
  let longestAxis = 0
  let longestMiddle = 0
  for (let axis = 0; axis < 3; axis++) {
    const sorted = centres.map((c) => c[axis]!).sort((x, y) => x - y)
    const extent = sorted[sorted.length - 1]! - sorted[0]!
    if (extent > longest) [longest, longestAxis, longestMiddle] = [extent, axis, (sorted[0]! + sorted[sorted.length - 1]!) / 2]
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]! - sorted[i - 1]!
      if (gap > widest) [widest, cutAxis, cutAt] = [gap, axis, (sorted[i]! + sorted[i - 1]!) / 2]
    }
  }
  if (cutAxis < 0) {
    if (longest < MIN_SIDE) return null
    ;[cutAxis, cutAt] = [longestAxis, longestMiddle]
  }
  const left: number[] = []
  const right: number[] = []
  triangles.forEach((t, i) => (centres[i]![cutAxis]! <= cutAt ? left : right).push(t))
  return left.length === 0 || right.length === 0 ? null : [left, right]
}

/** The hulls (each at most `MAX_HULL_POINTS` drawn points, x y z triples) of the triangles `triangles` of the soup; `centre` is the middle of the vehicle, the side a sheet is extruded to; a solid part (`isSolid`: a block, a tyre, a lamp) is one hull, never cut. */
export const hullsOf = (soup: HullSoup, triangles: readonly number[], centre: Vec3, isSolid = false): number[][] => {
  const surface = new SurfaceSamples(soup, triangles)
  const out: number[][] = []
  const make = (cell: readonly number[], depth: number): void => {
    const points = pointsOfTriangles(soup, cell)
    if (points.length < 9) return
    const reduced = reducePoints(points, MAX_HULL_POINTS)
    const normal = mainNormal(soup, cell)
    const spread = spreadAlong(reduced, normal)
    if (spread < THIN_UNDER) {
      const thick = extrudedInward(reducePoints(reduced, MAX_HULL_POINTS / 2), normal, centre, THIN_UNDER - spread)
      if (convexFaces(thick)) out.push(thick)
      return
    }
    const faces = convexFaces(reduced)
    if (!faces) return
    if (!isSolid && depth < MAX_DEPTH && !facesAreClose(reduced, faces, surface)) {
      const cut = halves(soup, cell)
      if (cut) {
        make(cut[0], depth + 1)
        make(cut[1], depth + 1)
        return
      }
    }
    out.push(reduced)
  }
  make(triangles, 0)
  return out
}
