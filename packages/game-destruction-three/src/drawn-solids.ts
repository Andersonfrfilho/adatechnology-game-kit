import type * as THREE_NS from 'three'

import type { StaticSolid } from './engine-statics'
import type { MeshVis } from './internal'
import { fitOrientedBox, hugs } from '@adatechnology/game-shapes'
import type { OrientedBox } from '@adatechnology/game-shapes'
import type { Visuals } from './visual'

/** A box fits a drawn part when each of its eight corners has a vertex within this (m): a box drawn is a box held, a cylinder or a chamfered post is not. */
const FIT = 0.01
/** A box holds a part only when the part's own triangles lie in each of its faces and cover at least this share of the face (a raised panel leaves its edge short, a frame leaves most of it open): a door frame (two posts and a lintel) has a box's eight corners and none of its faces. */
const FILL = 0.5
/** The thinnest half (m) a drawn plane (a sheet with no thickness) is held by. */
const MIN_HALF = 0.005
/** A part whose every side is under this (m) is collapsed to a point (hidden by its host): nothing is drawn there. */
const COLLAPSED = 0.002
/** A face of a box under this area (m²) is a plane's edge: it has nothing to cover. */
const MIN_FACE = 1e-6

type Points = ArrayLike<number>

/** What was made of a part and what it was made from: the same source at the same versions is the same vertices, so nothing is measured (or read) twice. */
interface Made {
  readonly matrix: readonly number[]
  readonly from: number
  readonly to: number
  /** The positions' source (`Visuals.positionsOf`) by number, so a source replaced is not kept alive by what was made of it. */
  readonly source: number
  readonly version: number
  readonly shapeVersion: number
  readonly solids: StaticSolid[]
}

const made = new WeakMap<MeshVis, Made>()
const sourceIds = new WeakMap<object, number>()
let lastSourceId = 0
const sourceIdOf = (source: object): number => {
  let id = sourceIds.get(source)
  if (id === undefined) {
    id = ++lastSourceId
    sourceIds.set(source, id)
  }
  return id
}
/** The triangles of each range of a merged mesh, by the index buffer they were found in (one pass over the buffer for all the parts of the host). */
const triangles = new WeakMap<object, Map<number, number[]>>()

/** What a part costs besides its vertices (in vertices) to measure from scratch. */
const PART_COST = 24

/** How many vertices may be measured from scratch in one call (a part whose numbers did not change is not measured at all); `incomplete` is set when a part had to wait. */
export interface MeasureBudget {
  left: number
  incomplete: boolean
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** The axes (three rows of 3) of a box turned by the quaternion. */
const axesOfQuat = (x: number, y: number, z: number, w: number): number[] => [
  1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
  2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
  2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
]

/** The part's vertices out of the mesh's positions. */
const readPoints = (array: Points, from: number, to: number): Float64Array => {
  const points = new Float64Array((to - from) * 3)
  for (let i = 0; i < points.length; i++) points[i] = array[from * 3 + i]
  return points
}

/**
 * What a fixed drawn part collides as, in world space, for an engine: one box turned as drawn where a box fits it (every corner has a vertex within `FIT`), else the
 * triangles as drawn (`mesh`, static only). A part drawn by a range of a merged mesh (a wall of the house) is its own vertices only. Nothing is drawn where a part is
 * collapsed to a point, so nothing is made there (`CLAUDE.md` §12). `key` names the part for the engine. The same part in the same place with the same vertices gives the very same list back,
 * told by the versions of its positions (every write counts), not by reading them: a part that did not change costs no pass over its vertices.
 */
export const drawnSolidsOf = (THREE: typeof THREE_NS, visuals: Visuals, mv: MeshVis, key: string, budget: MeasureBudget): StaticSolid[] => {
  const local = visuals.positionsOf(mv)
  if (!local || local.to <= local.from) return []
  mv.mesh.updateWorldMatrix(true, false)
  const matrix = mv.mesh.matrixWorld.elements
  const source = sourceIdOf(local.source)
  const known = made.get(mv)
  if (
    known &&
    known.source === source &&
    known.version === local.version &&
    known.shapeVersion === mv.shapeVersion &&
    known.from === local.from &&
    known.to === local.to &&
    known.matrix.every((v, k) => v === matrix[k])
  )
    return known.solids
  // out of turns: what was made before stays (its body is kept), a part never made waits for the next call
  if (budget.left <= 0) {
    budget.incomplete = true
    return known?.solids ?? []
  }
  budget.left -= local.to - local.from + PART_COST
  const solids = solidsOfPoints(THREE, mv, readPoints(local.array, local.from, local.to), matrix, local).map((solid) => ({ ...solid, key }))
  made.set(mv, { matrix: [...matrix], from: local.from, to: local.to, source, version: local.version, shapeVersion: mv.shapeVersion, solids })
  return solids
}

const solidsOfPoints = (THREE: typeof THREE_NS, mv: MeshVis, points: Float64Array, matrix: readonly number[], local: { readonly from: number; readonly to: number }): StaticSolid[] => {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  mv.mesh.matrixWorld.decompose(pos, quat, scale)
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = points[i + k]
      if (v < low[k]) low[k] = v
      if (v > high[k]) high[k] = v
    }
  }
  const size = [high[0] - low[0], high[1] - low[1], high[2] - low[2]]
  const s = [Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)]
  if (Math.max(size[0] * s[0], size[1] * s[1], size[2] * s[2]) < COLLAPSED) return []
  const centre = [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2]
  const half = [size[0] / 2, size[1] / 2, size[2] / 2]
  // the box of the geometry in its own frame, turned by the mesh: the drawn box of a wall, a table top, a beam
  const straight = { center: centre, half, axes: IDENTITY, tolerance: [FIT / s[0], FIT / s[1], FIT / s[2]] }
  const found = trianglesOfPart(mv, local)
  if (hugs(points, straight) && fillsFaces(points, found, local.from, straight)) {
    const c = new THREE.Vector3(centre[0] * scale.x, centre[1] * scale.y, centre[2] * scale.z).applyQuaternion(quat).add(pos)
    return [{ center: [c.x, c.y, c.z], half: [Math.max(MIN_HALF, half[0] * s[0]), Math.max(MIN_HALF, half[1] * s[1]), Math.max(MIN_HALF, half[2] * s[2])], rotation: [quat.x, quat.y, quat.z, quat.w] }]
  }
  const world = new Float64Array(points.length)
  const e = matrix
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], y = points[i + 1], z = points[i + 2]
    world[i] = e[0] * x + e[4] * y + e[8] * z + e[12]
    world[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
    world[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
  }
  const turned = fitOrientedBox(world as unknown as number[])
  if (turned && fitsTurned(world, turned) && fillsFaces(world, found, local.from, turnedBox(turned))) return [turned]
  return [trimeshOf(mv, world, local, found)]
}

type FitBox = { readonly center: readonly number[]; readonly half: readonly number[]; readonly axes: readonly number[]; readonly tolerance: readonly number[] }

const turnedBox = (box: OrientedBox): FitBox => ({ center: box.center, half: box.half, axes: axesOfQuat(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]), tolerance: [FIT, FIT, FIT] })

const fitsTurned = (world: Points, box: OrientedBox): boolean => hugs(world, turnedBox(box))

/** The area of the triangle a, b, c (box frame, three numbers each). */
const areaOf = (a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>): number => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
}

/** Whether the part's triangles (`found`: vertex numbers of the host, `from` the first of the part) cover each face of the box that has an area: what a box that fits holds is the part, not the air in it. */
const fillsFaces = (points: Points, found: readonly number[], from: number, box: FitBox): boolean => {
  if (found.length === 0) return true
  const covered = [0, 0, 0, 0, 0, 0]
  const frame = [new Float64Array(3), new Float64Array(3), new Float64Array(3)]
  const a = box.axes
  for (let i = 0; i + 2 < found.length; i += 3) {
    for (let v = 0; v < 3; v++) {
      const at = (found[i + v] - from) * 3
      const dx = points[at] - box.center[0], dy = points[at + 1] - box.center[1], dz = points[at + 2] - box.center[2]
      for (let k = 0; k < 3; k++) frame[v][k] = dx * a[k * 3] + dy * a[k * 3 + 1] + dz * a[k * 3 + 2]
    }
    let area = -1
    for (let k = 0; k < 3; k++) for (let side = 0; side < 2; side++) {
      const face = side ? box.half[k] : -box.half[k]
      if (Math.abs(frame[0][k] - face) > box.tolerance[k] || Math.abs(frame[1][k] - face) > box.tolerance[k] || Math.abs(frame[2][k] - face) > box.tolerance[k]) continue
      if (area < 0) area = areaOf(frame[0], frame[1], frame[2])
      covered[k * 2 + side] += area
    }
  }
  for (let k = 0; k < 3; k++) {
    const area = 4 * box.half[(k + 1) % 3] * box.half[(k + 2) % 3]
    if (area < MIN_FACE) continue
    if (covered[k * 2] < area * FILL || covered[k * 2 + 1] < area * FILL) return false
  }
  return true
}

/** The triangles of each range of the host's index buffer, found in one pass for all of them (the parts of a merged mesh are many, its buffer is one). */
const trianglesOfRanges = (mv: MeshVis, ranges: ReadonlyArray<readonly [number, number]>): Map<number, number[]> => {
  const index = mv.mesh.geometry.getIndex()
  const key = (index?.array ?? mv.mesh.geometry) as object
  const known = triangles.get(key)
  if (known) return known
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const owner = (vertex: number): number => {
    let lo = 0
    let hi = sorted.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (vertex < sorted[mid][0]) hi = mid - 1
      else if (vertex >= sorted[mid][1]) lo = mid + 1
      else return sorted[mid][0]
    }
    return -1
  }
  const out = new Map<number, number[]>()
  const array = index?.array
  const count = index ? index.count : (mv.mesh.geometry.getAttribute('position')?.count ?? 0)
  for (let i = 0; i + 2 < count; i += 3) {
    const a = array ? array[i] : i
    const from = owner(a)
    if (from < 0) continue
    let list = out.get(from)
    if (!list) {
      list = []
      out.set(from, list)
    }
    if (array) list.push(a, array[i + 1], array[i + 2])
    else list.push(i, i + 1, i + 2)
  }
  triangles.set(key, out)
  return out
}

/** The triangles that start in the part's range of its host, as vertex numbers of the host (three each). */
const trianglesOfPart = (mv: MeshVis, local: { readonly from: number; readonly to: number }): number[] =>
  mv.host
    ? trianglesOfRanges(mv, mv.host.sharers.filter((s) => s.range && !s.loose).map((s) => s.range as [number, number])).get(local.from) ?? []
    : trianglesOfRanges(mv, [[0, local.to]]).get(0) ?? []

/** The triangles of the part in world space (its vertices and the triangles of the geometry that start in its range), with the box around them as the box of the solid. */
const trimeshOf = (mv: MeshVis, world: Float64Array, local: { readonly from: number; readonly to: number }, found: readonly number[]): StaticSolid => {
  const indices = new Uint32Array(found.length)
  for (let i = 0; i < found.length; i++) indices[i] = found[i] - local.from
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < world.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], world[i + k])
      hi[k] = Math.max(hi[k], world[i + k])
    }
  }
  return {
    center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
    half: [Math.max(MIN_HALF, (hi[0] - lo[0]) / 2), Math.max(MIN_HALF, (hi[1] - lo[1]) / 2), Math.max(MIN_HALF, (hi[2] - lo[2]) / 2)],
    rotation: [0, 0, 0, 1],
    mesh: { vertices: new Float32Array(world), indices },
  }
}
