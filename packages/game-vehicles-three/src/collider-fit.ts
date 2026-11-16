import type { DrawnCollider } from '@adatechnology/game-contracts'
import { fitOrientedBox, fitOrientedBoxes, hugs } from '@adatechnology/game-shapes'
import type { OrientedBox } from '@adatechnology/game-shapes'

/** A box fits a drawn piece when each of its eight corners has a vertex within this (m): the same rule as the fixed things of `game-destruction-three`. */
const FIT = 0.01
/** The thinnest half (m) a drawn plane (a sheet with no thickness) is held by. */
const MIN_HALF = 0.005
/** A drawn piece with more triangles than this is held by a coarser mesh: the cars draw tens of thousands of triangles to take cuts, and an engine collides with a surface, not with a tessellation. */
const COARSEN_ABOVE = 60
/** The cell (m) the vertices of a coarsened piece are merged in. */
export const COARSE_CELL = 0.008
/** A coarsened piece with fewer triangles than this is not worth the loss: the piece keeps all of its own. */
const COARSE_MIN_TRIANGLES = 12
const IDENTITY_AXES = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const CELL_BIAS = 4096
const CELL_SPAN = 8192

/** A drawn piece in the making: the triangles of its meshes in the vehicle's frame. */
export interface Soup {
  readonly vertices: number[]
  readonly indices: number[]
  /** Where each vertex of a source (one mesh as placed: two meshes may share a geometry) went in `vertices`, so a vertex the triangles share is kept once. */
  readonly placed: Map<object, Map<number, number>>
}

export const soupOf = (): Soup => ({ vertices: [], indices: [], placed: new Map() })

/** Adds one triangle of a mesh (`source` names it, its `positions`, the three vertex numbers) to the soup, moved by `matrix` (column-major, as three.js holds it). */
export const addTriangle = (soup: Soup, source: object, positions: ArrayLike<number>, corners: readonly [number, number, number], matrix: ArrayLike<number>): void => {
  let placed = soup.placed.get(source)
  if (!placed) soup.placed.set(source, (placed = new Map()))
  for (const corner of corners) {
    let at = placed.get(corner)
    if (at === undefined) {
      const x = positions[corner * 3] as number, y = positions[corner * 3 + 1] as number, z = positions[corner * 3 + 2] as number
      at = soup.vertices.length / 3
      placed.set(corner, at)
      soup.vertices.push(
        matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
        matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
        matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
      )
    }
    soup.indices.push(at)
  }
}

const cellKey = (x: number, y: number, z: number, cell: number): number =>
  ((Math.floor(x / cell) + CELL_BIAS) * CELL_SPAN + (Math.floor(y / cell) + CELL_BIAS)) * CELL_SPAN + (Math.floor(z / cell) + CELL_BIAS)

/**
 * The soup with the vertices of each `COARSE_CELL` cube merged into the drawn vertex nearest their mean, so the collision surface starts on the drawn one and no triangle
 * can leave it by more than a cell; triangles that collapsed or repeat are left out.
 */
const coarsen = (soup: Soup): Soup => {
  const count = soup.vertices.length / 3
  const cells = new Map<number, number>()
  const sums: number[] = []
  const counts: number[] = []
  const to = new Uint32Array(count)
  for (let i = 0; i < count; i++) {
    const x = soup.vertices[i * 3] as number, y = soup.vertices[i * 3 + 1] as number, z = soup.vertices[i * 3 + 2] as number
    const key = cellKey(x, y, z, COARSE_CELL)
    let at = cells.get(key)
    if (at === undefined) {
      at = counts.length
      cells.set(key, at)
      counts.push(0)
      sums.push(0, 0, 0)
    }
    to[i] = at
    counts[at] = (counts[at] as number) + 1
    sums[at * 3] = (sums[at * 3] as number) + x
    sums[at * 3 + 1] = (sums[at * 3 + 1] as number) + y
    sums[at * 3 + 2] = (sums[at * 3 + 2] as number) + z
  }
  const best = new Float64Array(counts.length).fill(Infinity)
  const vertices = new Array<number>(counts.length * 3).fill(0)
  for (let i = 0; i < count; i++) {
    const at = to[i] as number
    const n = counts[at] as number
    const x = soup.vertices[i * 3] as number, y = soup.vertices[i * 3 + 1] as number, z = soup.vertices[i * 3 + 2] as number
    const d = (x - (sums[at * 3] as number) / n) ** 2 + (y - (sums[at * 3 + 1] as number) / n) ** 2 + (z - (sums[at * 3 + 2] as number) / n) ** 2
    if (d >= (best[at] as number)) continue
    best[at] = d
    vertices[at * 3] = x
    vertices[at * 3 + 1] = y
    vertices[at * 3 + 2] = z
  }
  const indices: number[] = []
  const seen = new Set<number>()
  const stride = counts.length
  for (let i = 0; i + 2 < soup.indices.length; i += 3) {
    const a = to[soup.indices[i] as number] as number, b = to[soup.indices[i + 1] as number] as number, c = to[soup.indices[i + 2] as number] as number
    if (a === b || b === c || a === c) continue
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c)
    const key = (lo * stride + (a + b + c - lo - hi)) * stride + hi
    if (seen.has(key)) continue
    seen.add(key)
    indices.push(a, b, c)
  }
  return { vertices, indices, placed: new Map() }
}

/** The axes (three rows of 3) of a box turned by the quaternion. */
const axesOf = ([x, y, z, w]: readonly [number, number, number, number]): number[] => [
  1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
  2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
  2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
]

/** The box with its sides on the points: the fitted box is at least 2 cm thick, a drawn sheet is not, and no collider reaches 1 cm past what is drawn. */
const tightened = (points: readonly number[], box: OrientedBox): OrientedBox => {
  const axes = axesOf(box.rotation)
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const t = (points[i] as number) * (axes[k * 3] as number) + (points[i + 1] as number) * (axes[k * 3 + 1] as number) + (points[i + 2] as number) * (axes[k * 3 + 2] as number)
      if (t < low[k]!) low[k] = t
      if (t > high[k]!) high[k] = t
    }
  }
  const mid = [0, 1, 2].map((k) => (low[k]! + high[k]!) / 2)
  const center = [0, 1, 2].map((k) => mid[0]! * (axes[k] as number) + mid[1]! * (axes[3 + k] as number) + mid[2]! * (axes[6 + k] as number)) as [number, number, number]
  const half = [0, 1, 2].map((k) => Math.max(MIN_HALF, (high[k]! - low[k]!) / 2)) as [number, number, number]
  return { center, half, rotation: box.rotation }
}

/** Whether the SDK fit (`fitOrientedBoxes`, which reads the surface between the vertices) holds the drawing in one box: a box with a vertex at each corner can still be mostly air inside (a ring, a frame, an X). */
const isOneBox = (soup: Soup): boolean => fitOrientedBoxes(soup.vertices, soup.indices).length <= 1

/** The box that holds the soup: axis-aligned in the frame where that fits, else along its principal axes where that fits, else the triangles with the box around them. */
export const colliderOf = (id: string, key: string, soup: Soup): DrawnCollider | null => {
  const points = soup.vertices
  if (points.length < 9) return null
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = points[i + k] as number
      if (v < low[k]!) low[k] = v
      if (v > high[k]!) high[k] = v
    }
  }
  const center: [number, number, number] = [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2]
  const half: [number, number, number] = [(high[0]! - low[0]!) / 2, (high[1]! - low[1]!) / 2, (high[2]! - low[2]!) / 2]
  const held = half.map((h) => Math.max(MIN_HALF, h)) as [number, number, number]
  if (hugs(points, { center, half, axes: IDENTITY_AXES, tolerance: [FIT, FIT, FIT] }) && isOneBox(soup)) return { id, key, center, half: held, rotation: [0, 0, 0, 1] }
  const turned = fitOrientedBox(points)
  if (turned && hugs(points, { center: turned.center, half: turned.half, axes: axesOf(turned.rotation), tolerance: [FIT, FIT, FIT] }) && isOneBox(soup)) return { id, key, ...tightened(points, turned) }
  const coarse = soup.indices.length / 3 > COARSEN_ABOVE ? coarsen(soup) : soup
  const kept = coarse.indices.length >= COARSE_MIN_TRIANGLES * 3 ? coarse : soup
  return { id, key, center, half: held, rotation: [0, 0, 0, 1], mesh: { vertices: new Float32Array(kept.vertices), indices: new Uint32Array(kept.indices) } }
}
