import { convexFaces, hullVolume, reducePoints } from './hull-geometry'
import type { HullSoup } from './vehicle-hulls'

/** A protrusion is thin when both of the two smaller sides of its box are at most this (m). */
export const THIN_SECTION = 0.08
/** A thin part sticks out of the body when its box passes the body's box by more than this (m). */
export const PROTRUSION_REACH = 0.03
/** A thin part has a hull of at most this volume (m3): a rod, a stalk, a blade. */
export const THIN_VOLUME = 2e-4
/** The bulk of a piece along a direction is found in this many bins. */
const BULK_BINS = 256
/** The tail of a piece along a direction is the triangles past the point that holds this share of the piece's area, by `PROTRUSION_REACH`. */
export const BULK_SHARE = 0.99
/** A piece shorter than this (m) along its longest side is not divided again. */
export const MIN_DIVISIBLE = 0.05

/** A cut across one axis; the two halves it makes are cut again by `lo` and `hi`, or are leaves when those are null. */
export interface CutNode {
  readonly axis: 0 | 1 | 2
  readonly at: number
  lo: CutNode | null
  hi: CutNode | null
}

/** The triangles (by number) of a soup as a soup of their own, vertices kept once. */
export const subSoup = (soup: HullSoup, triangles: readonly number[]): HullSoup => {
  const moved = new Map<number, number>()
  const vertices: number[] = []
  const indices: number[] = []
  for (const t of triangles) {
    for (let k = 0; k < 3; k++) {
      const v = soup.indices[t * 3 + k]!
      let at = moved.get(v)
      if (at === undefined) {
        at = vertices.length / 3
        moved.set(v, at)
        vertices.push(soup.vertices[v * 3]!, soup.vertices[v * 3 + 1]!, soup.vertices[v * 3 + 2]!)
      }
      indices.push(at)
    }
  }
  return { vertices, indices }
}

/** Vertices closer than this (m) are one: a mesh that repeats a corner for each face is still one surface. */
const WELD = 1e-4

/** The triangles of the soup by connected part (a corner in common, welded at `WELD`), each list in triangle order, the lists by their first triangle. */
export const componentsOf = (soup: HullSoup): number[][] => {
  const welded = new Map<number, number>()
  const weldOf = (v: number): number => {
    const key = ((Math.round(soup.vertices[v * 3]! / WELD) * 73856093) ^ (Math.round(soup.vertices[v * 3 + 1]! / WELD) * 19349663) ^ (Math.round(soup.vertices[v * 3 + 2]! / WELD) * 83492791)) >>> 0
    let id = welded.get(key)
    if (id === undefined) welded.set(key, (id = welded.size))
    return id
  }
  const parent: number[] = []
  const rootOf = (v: number): number => {
    let root = v
    while (parent[root] !== root) root = parent[root]!
    for (let node = v; parent[node] !== root; ) [node, parent[node]] = [parent[node]!, root]
    return root
  }
  const corners: number[] = []
  for (let i = 0; i < soup.indices.length; i++) {
    const id = weldOf(soup.indices[i]!)
    while (parent.length <= id) parent.push(parent.length)
    corners.push(id)
  }
  for (let t = 0; t < corners.length; t += 3) {
    parent[rootOf(corners[t + 1]!)] = rootOf(corners[t]!)
    parent[rootOf(corners[t + 2]!)] = rootOf(corners[t]!)
  }
  const groups = new Map<number, number[]>()
  for (let t = 0; t < corners.length / 3; t++) {
    const root = rootOf(corners[t * 3]!)
    const list = groups.get(root)
    if (list) list.push(t)
    else groups.set(root, [t])
  }
  return [...groups.values()]
}

type Box = { readonly low: [number, number, number]; readonly high: [number, number, number] }

const boxOf = (soup: HullSoup): Box => {
  const low: [number, number, number] = [Infinity, Infinity, Infinity]
  const high: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < soup.vertices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const value = soup.vertices[i + k]!
      if (value < low[k]!) low[k] = value
      if (value > high[k]!) high[k] = value
    }
  }
  return { low, high }
}

const volumeOf = (soup: HullSoup): number => {
  const points = reducePoints(soup.vertices, 64)
  const faces = convexFaces(points)
  return faces ? hullVolume(points, faces) : 0
}

/** The directions a tail is looked for along: the six of the axes. */
const AXES: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]

/** The triangles whose centre is more than `PROTRUSION_REACH` past the bulk (`BULK_SHARE` of the area) of the piece, along any of the six axis directions. */
const tailOf = (soup: HullSoup): number[] => {
  const count = soup.indices.length / 3
  const areas: number[] = []
  const centres: number[][] = []
  for (let t = 0; t < count; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => soup.indices[t * 3 + k]! * 3) as [number, number, number]
    const v = soup.vertices
    const ux = v[b]! - v[a]!, uy = v[b + 1]! - v[a + 1]!, uz = v[b + 2]! - v[a + 2]!, wx = v[c]! - v[a]!, wy = v[c + 1]! - v[a + 1]!, wz = v[c + 2]! - v[a + 2]!
    areas.push(Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx))
    centres.push([(v[a]! + v[b]! + v[c]!) / 3, (v[a + 1]! + v[b + 1]! + v[c + 1]!) / 3, (v[a + 2]! + v[b + 2]! + v[c + 2]!) / 3])
  }
  const total = areas.reduce((sum, area) => sum + area, 0)
  const tail = new Set<number>()
  for (const [axis, sign] of AXES) {
    const values = centres.map((centre) => sign * centre[axis]!)
    const low = Math.min(...values), step = (Math.max(...values) - low) / BULK_BINS || 1
    const area = new Float64Array(BULK_BINS + 1)
    values.forEach((value, t) => { area[Math.floor((value - low) / step)]! += areas[t]! })
    let reached = 0, bin = 0
    while (bin < BULK_BINS && reached + area[bin]! < total * BULK_SHARE) reached += area[bin++]!
    const bulk = low + (bin + 1) * step
    for (let t = 0; t < count; t++) if (values[t]! > bulk + PROTRUSION_REACH) tail.add(t)
  }
  return [...tail].sort((p, q) => p - q)
}

/** A thin part that sticks out of a piece: its triangles (by number in the piece's soup), the soup of them, and its name in a piece (the number of its first triangle). */
export interface Protrusion {
  readonly id: number
  readonly triangles: readonly number[]
  readonly soup: HullSoup
}

/**
 * Thin parts that may be taken off a piece (antenna, wiper, handle on a stalk, step): parts that stick out of it and have a hull of at most `THIN_VOLUME`. A part sticks out when it is a
 * connected part (corners welded at `WELD`) of its own that is thin (both smaller sides of its box at most `THIN_SECTION`) and passes the box of what is not thin by `PROTRUSION_REACH`;
 * or, welded to the body, when its triangles are the tail of the piece (`tailOf`).
 */
export const protrusionsOf = (soup: HullSoup): Protrusion[] => {
  const taken = new Set<number>()
  const out: Protrusion[] = []
  const add = (triangles: readonly number[], from: HullSoup): void => {
    out.push({ id: triangles[0]!, triangles, soup: from })
    for (const t of triangles) taken.add(t)
  }
  const tail = tailOf(soup)
  if (tail.length > 0) {
    for (const group of componentsOf(subSoup(soup, tail))) {
      const triangles = group.map((t) => tail[t]!)
      const part = subSoup(soup, triangles)
      if (volumeOf(part) <= THIN_VOLUME) add(triangles, part)
    }
  }
  const parts = componentsOf(soup)
  if (parts.length < 2) return out
  const soups = parts.map((triangles) => subSoup(soup, triangles))
  const boxes = soups.map(boxOf)
  const isThin = boxes.map((box) => box.high.map((high, k) => high - box.low[k]!).sort((a, b) => a - b)[1]! <= THIN_SECTION)
  const thick = soups.filter((_, i) => !isThin[i])
  if (thick.length === 0) return out
  const bodyBox = boxOf({ vertices: thick.flatMap((part) => part.vertices), indices: [] })
  parts.forEach((triangles, i) => {
    if (!isThin[i] || triangles.some((t) => taken.has(t))) return
    const box = boxes[i]!
    if ([0, 1, 2].some((k) => box.high[k]! > bodyBox.high[k]! + PROTRUSION_REACH || box.low[k]! < bodyBox.low[k]! - PROTRUSION_REACH)) add(triangles, soups[i]!)
  })
  return out
}

/** The soup without the triangles of the protrusions. */
export const withoutProtrusions = (soup: HullSoup, protrusions: readonly Protrusion[]): HullSoup => {
  const gone = new Set(protrusions.flatMap((protrusion) => protrusion.triangles))
  return subSoup(soup, Array.from({ length: soup.indices.length / 3 }, (_, t) => t).filter((t) => !gone.has(t)))
}

/** Two soups as one. */
export const joined = (a: HullSoup, b: HullSoup): HullSoup => ({ vertices: [...a.vertices, ...b.vertices], indices: [...a.indices, ...b.indices.map((i) => i + a.vertices.length / 3)] })

/** The units of a piece when `taken` (the numbers of the protrusions the plan took off it) are the ones to take off: the body, named by `key`, then each protrusion, named by `key` and its number. */
export const unitsOf = (key: string, soup: HullSoup, taken: ReadonlySet<number> | undefined): Array<{ readonly key: string; readonly soup: HullSoup }> => {
  if (!taken || taken.size === 0) return [{ key, soup }]
  const off = protrusionsOf(soup).filter((protrusion) => taken.has(protrusion.id))
  if (off.length === 0) return [{ key, soup }]
  return [{ key, soup: withoutProtrusions(soup, off) }, ...off.map((protrusion) => ({ key: `${key}~${protrusion.id}`, soup: protrusion.soup }))]
}

/** The longest side of the box of the triangles' centres: its axis, and the middle of it (the centres, not the corners, so a spike does not carry the cut off the piece). */
export const longestSide = (soup: HullSoup): { readonly axis: 0 | 1 | 2; readonly at: number; readonly length: number } => {
  const centres: number[] = []
  for (let t = 0; t < soup.indices.length / 3; t++) {
    for (let k = 0; k < 3; k++) centres.push((soup.vertices[soup.indices[t * 3]! * 3 + k]! + soup.vertices[soup.indices[t * 3 + 1]! * 3 + k]! + soup.vertices[soup.indices[t * 3 + 2]! * 3 + k]!) / 3)
  }
  const { low, high } = boxOf({ vertices: centres, indices: [] })
  let axis: 0 | 1 | 2 = 0
  for (const k of [1, 2] as const) if (high[k]! - low[k]! > high[axis]! - low[axis]!) axis = k
  return { axis, at: (low[axis]! + high[axis]!) / 2, length: high[axis]! - low[axis]! }
}

/** The triangles whose centre is below the cut and the ones that are not, as two soups (a half with no triangle is null). */
export const cutSoup = (soup: HullSoup, axis: number, at: number): [HullSoup | null, HullSoup | null] => {
  const lo: number[] = []
  const hi: number[] = []
  for (let t = 0; t < soup.indices.length / 3; t++) {
    const centre = (soup.vertices[soup.indices[t * 3]! * 3 + axis]! + soup.vertices[soup.indices[t * 3 + 1]! * 3 + axis]! + soup.vertices[soup.indices[t * 3 + 2]! * 3 + axis]!) / 3
    ;(centre < at ? lo : hi).push(t)
  }
  return [lo.length ? subSoup(soup, lo) : null, hi.length ? subSoup(soup, hi) : null]
}

/** The leaves of a unit under its cuts (the same cuts as when the car was whole): the soup of each, named by the unit's key and the path of the cuts. */
export const leavesOf = (key: string, soup: HullSoup, node: CutNode | null, path = ''): Array<{ readonly key: string; readonly path: string; readonly soup: HullSoup }> => {
  if (!node) return [{ key: path ? `${key}:${path}` : key, path, soup }]
  const [lo, hi] = cutSoup(soup, node.axis, node.at)
  return [...(lo ? leavesOf(key, lo, node.lo, `${path}0`) : []), ...(hi ? leavesOf(key, hi, node.hi, `${path}1`) : [])]
}
