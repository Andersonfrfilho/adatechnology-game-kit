export type Vec3 = readonly [number, number, number]
export type Vec2 = readonly [number, number]
export type Triangle = readonly [Vec3, Vec3, Vec3]
type Triangle2 = readonly [Vec2, Vec2, Vec2]

export interface Overlap2 {
  readonly area: number
  readonly center: Vec2
}

const ZERO: Vec3 = [0, 0, 0]

export function normalOf(t: Triangle): Vec3 {
  const ax = t[1][0] - t[0][0], ay = t[1][1] - t[0][1], az = t[1][2] - t[0][2]
  const bx = t[2][0] - t[0][0], by = t[2][1] - t[0][1], bz = t[2][2] - t[0][2]
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
  const length = Math.hypot(nx, ny, nz)
  return length < 1e-12 ? ZERO : [nx / length, ny / length, nz / length]
}

/** The axis the plane is most perpendicular to: dropping it projects the triangle without folding it. */
export function dominantAxis(n: Vec3): 0 | 1 | 2 {
  const x = Math.abs(n[0]), y = Math.abs(n[1]), z = Math.abs(n[2])
  if (x >= y && x >= z) return 0
  return y >= z ? 1 : 2
}

function keptAxes(drop: 0 | 1 | 2): readonly [number, number] {
  if (drop === 0) return [1, 2]
  return drop === 1 ? [0, 2] : [0, 1]
}

export function projectTriangle(t: Triangle, drop: 0 | 1 | 2): Triangle2 {
  const [u, w] = keptAxes(drop)
  return [[t[0][u]!, t[0][w]!], [t[1][u]!, t[1][w]!], [t[2][u]!, t[2][w]!]]
}

/** Lifts a point of the projected plane back onto the plane `dot(n, p) = offset`. */
export function unprojectPoint(p: Vec2, drop: 0 | 1 | 2, plane: { readonly n: Vec3; readonly offset: number }): Vec3 {
  const [u, w] = keptAxes(drop)
  const out: [number, number, number] = [0, 0, 0]
  out[u] = p[0]
  out[w] = p[1]
  out[drop] = (plane.offset - plane.n[u]! * p[0] - plane.n[w]! * p[1]) / plane.n[drop]!
  return out
}

function cross2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function edgeCrossing(p0: Vec2, p1: Vec2, e0: Vec2, e1: Vec2): Vec2 {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], ex = e1[0] - e0[0], ey = e1[1] - e0[1]
  const d = dx * ey - dy * ex
  if (Math.abs(d) < 1e-15) return p1
  const t = ((e0[0] - p0[0]) * ey - (e0[1] - p0[1]) * ex) / d
  return [p0[0] + t * dx, p0[1] + t * dy]
}

function clipByEdge(polygon: readonly Vec2[], e0: Vec2, e1: Vec2): Vec2[] {
  const out: Vec2[] = []
  for (let j = 0; j < polygon.length; j++) {
    const current = polygon[j]!, previous = polygon[(j + polygon.length - 1) % polygon.length]!
    const currentIn = cross2(e0, e1, current) >= -1e-12, previousIn = cross2(e0, e1, previous) >= -1e-12
    if (currentIn !== previousIn) out.push(edgeCrossing(previous, current, e0, e1))
    if (currentIn) out.push(current)
  }
  return out
}

function polygonAreaAndCenter(polygon: readonly Vec2[]): Overlap2 {
  let twice = 0, cx = 0, cy = 0
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!
    twice += p[0] * q[1] - q[0] * p[1]
    cx += p[0]
    cy += p[1]
  }
  return { area: Math.abs(twice) / 2, center: [cx / polygon.length, cy / polygon.length] }
}

/** Area (and a point inside) of the intersection of two triangles on the same plane; undefined when they do not overlap. */
export function overlapOfTriangles(a: Triangle2, b: Triangle2): Overlap2 | undefined {
  const clip: Triangle2 = cross2(b[0], b[1], b[2]) >= 0 ? b : [b[0], b[2], b[1]]
  let polygon: Vec2[] = [...a]
  for (let i = 0; i < 3 && polygon.length > 0; i++) polygon = clipByEdge(polygon, clip[i]!, clip[(i + 1) % 3]!)
  if (polygon.length < 3) return undefined
  const overlap = polygonAreaAndCenter(polygon)
  return overlap.area < 1e-12 ? undefined : overlap
}
