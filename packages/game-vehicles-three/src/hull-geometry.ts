/** Convex hull of a point set (incremental), the point reduction a hull is made from, and its volume: the plain geometry under `vehicle-hulls.ts`. */

/** A hull face: three point numbers, wound so the normal (right hand) points out of the hull. */
export type HullFace = readonly [number, number, number]

/** A point this close (m) to a face plane is on it. */
const PLANE_EPS = 1e-7
/** The 26 directions of the cube around a point: its corners, edge middles and face middles. */
const DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<readonly [number, number, number]> = []
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x !== 0 || y !== 0 || z !== 0) out.push([x, y, z])
  return out
})()

interface Face {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly nx: number
  readonly ny: number
  readonly nz: number
  readonly d: number
}

const faceOf = (p: ArrayLike<number>, a: number, b: number, c: number): Face => {
  const ux = p[b * 3]! - p[a * 3]!, uy = p[b * 3 + 1]! - p[a * 3 + 1]!, uz = p[b * 3 + 2]! - p[a * 3 + 2]!
  const wx = p[c * 3]! - p[a * 3]!, wy = p[c * 3 + 1]! - p[a * 3 + 1]!, wz = p[c * 3 + 2]! - p[a * 3 + 2]!
  let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
  const length = Math.hypot(nx, ny, nz) || 1
  nx /= length
  ny /= length
  nz /= length
  return { a, b, c, nx, ny, nz, d: nx * p[a * 3]! + ny * p[a * 3 + 1]! + nz * p[a * 3 + 2]! }
}

const sideOf = (face: Face, p: ArrayLike<number>, i: number): number => face.nx * p[i * 3]! + face.ny * p[i * 3 + 1]! + face.nz * p[i * 3 + 2]! - face.d

/** The four corners of a first tetrahedron: the extremes along x, then the farthest from the line, then from the plane. Null when the points lie on a plane or a line. */
const tetrahedronOf = (p: ArrayLike<number>, count: number): [number, number, number, number] | null => {
  let a = 0
  for (let i = 1; i < count; i++) if (p[i * 3]! < p[a * 3]!) a = i
  const farthest = (score: (i: number) => number): number => {
    let best = -1
    let bestScore = PLANE_EPS
    for (let i = 0; i < count; i++) {
      const s = score(i)
      if (s > bestScore) [best, bestScore] = [i, s]
    }
    return best
  }
  const b = farthest((i) => Math.hypot(p[i * 3]! - p[a * 3]!, p[i * 3 + 1]! - p[a * 3 + 1]!, p[i * 3 + 2]! - p[a * 3 + 2]!))
  if (b < 0) return null
  const ux = p[b * 3]! - p[a * 3]!, uy = p[b * 3 + 1]! - p[a * 3 + 1]!, uz = p[b * 3 + 2]! - p[a * 3 + 2]!
  const c = farthest((i) => {
    const wx = p[i * 3]! - p[a * 3]!, wy = p[i * 3 + 1]! - p[a * 3 + 1]!, wz = p[i * 3 + 2]! - p[a * 3 + 2]!
    return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / Math.hypot(ux, uy, uz)
  })
  if (c < 0) return null
  const base = faceOf(p, a, b, c)
  const d = farthest((i) => Math.abs(sideOf(base, p, i)))
  return d < 0 ? null : [a, b, c, d]
}

/** The faces of the convex hull of the points (x y z triples), wound outward; null when the points do not enclose a volume. */
export const convexFaces = (points: ArrayLike<number>): HullFace[] | null => {
  const count = Math.floor(points.length / 3)
  if (count < 4) return null
  const corners = tetrahedronOf(points, count)
  if (!corners) return null
  const [a, b, c, d] = corners
  const inside = [0, 1, 2].map((k) => (points[a * 3 + k]! + points[b * 3 + k]! + points[c * 3 + k]! + points[d * 3 + k]!) / 4) as [number, number, number]
  let faces: Face[] = []
  const add = (i: number, j: number, k: number): void => {
    const face = faceOf(points, i, j, k)
    const towardInside = face.nx * inside[0] + face.ny * inside[1] + face.nz * inside[2] - face.d
    faces.push(towardInside > 0 ? faceOf(points, i, k, j) : face)
  }
  add(a, b, c)
  add(a, b, d)
  add(a, c, d)
  add(b, c, d)
  for (let i = 0; i < count; i++) {
    if (i === a || i === b || i === c || i === d) continue
    const visible = faces.filter((face) => sideOf(face, points, i) > PLANE_EPS)
    if (visible.length === 0) continue
    const edges = new Map<number, [number, number]>()
    const key = (from: number, to: number): number => from * count + to
    for (const face of visible) for (const [from, to] of [[face.a, face.b], [face.b, face.c], [face.c, face.a]] as const) edges.set(key(from, to), [from, to])
    const kept = faces.filter((face) => !visible.includes(face))
    for (const [from, to] of edges.values()) {
      if (edges.has(key(to, from))) continue
      kept.push(faceOf(points, from, to, i))
    }
    faces = kept
  }
  return faces.map((face) => [face.a, face.b, face.c] as const)
}

/** The volume (m3) the faces enclose. */
export const hullVolume = (points: ArrayLike<number>, faces: readonly HullFace[]): number => {
  let sum = 0
  for (const [a, b, c] of faces) {
    const ax = points[a * 3]!, ay = points[a * 3 + 1]!, az = points[a * 3 + 2]!
    const bx = points[b * 3]!, by = points[b * 3 + 1]!, bz = points[b * 3 + 2]!
    const cx = points[c * 3]!, cy = points[c * 3 + 1]!, cz = points[c * 3 + 2]!
    sum += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)
  }
  return Math.abs(sum) / 6
}

/**
 * At most `max` of the points (x y z triples): the extreme of each of the 26 directions, then the point farthest from those taken, again and again. Always points of the input,
 * so a hull made of them never leaves what was drawn.
 */
export const reducePoints = (points: ArrayLike<number>, max: number): number[] => {
  const count = Math.floor(points.length / 3)
  const picked: number[] = []
  const taken = new Set<number>()
  const take = (i: number): void => {
    if (taken.has(i)) return
    taken.add(i)
    picked.push(i)
  }
  for (const [dx, dy, dz] of DIRECTIONS) {
    let best = 0
    let bestDot = -Infinity
    for (let i = 0; i < count; i++) {
      const dot = points[i * 3]! * dx + points[i * 3 + 1]! * dy + points[i * 3 + 2]! * dz
      if (dot > bestDot) [best, bestDot] = [i, dot]
    }
    take(best)
  }
  const away = new Float64Array(count).fill(Infinity)
  const refresh = (from: number): void => {
    for (let i = 0; i < count; i++) {
      const dist = (points[i * 3]! - points[from * 3]!) ** 2 + (points[i * 3 + 1]! - points[from * 3 + 1]!) ** 2 + (points[i * 3 + 2]! - points[from * 3 + 2]!) ** 2
      if (dist < away[i]!) away[i] = dist
    }
  }
  for (const i of picked) refresh(i)
  while (picked.length < Math.min(max, count)) {
    let far = -1
    let farDist = 0
    for (let i = 0; i < count; i++) if (away[i]! > farDist) [far, farDist] = [i, away[i]!]
    if (far < 0) break
    take(far)
    refresh(far)
  }
  return picked.slice(0, max).flatMap((i) => [points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!])
}
