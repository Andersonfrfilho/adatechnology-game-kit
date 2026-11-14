import type * as THREE_NS from 'three'

import type { StaticSolid } from './engine-statics'
import type { MeshVis } from './internal'
import { fitOrientedBox } from './oriented-boxes'
import type { OrientedBox } from './oriented-boxes'
import type { Visuals } from './visual'

/** A box fits a drawn part when each of its eight corners has a vertex within this (m): a box drawn is a box held, a cylinder or a chamfered post is not. */
const FIT = 0.01
/** The thinnest half (m) a drawn plane (a sheet with no thickness) is held by. */
const MIN_HALF = 0.005
/** A part whose every side is under this (m) is collapsed to a point (hidden by its host): nothing is drawn there. */
const COLLAPSED = 0.002

type Points = ArrayLike<number>

/** What was made of a part and what it was made from: the same numbers again are the same solids, so nothing is measured twice. */
interface Made {
  readonly matrix: readonly number[]
  readonly from: number
  readonly to: number
  readonly sum: number
  readonly spread: number
  readonly solids: StaticSolid[]
}

const made = new WeakMap<MeshVis, Made>()
/** The triangles of each range of a merged mesh, by the index buffer they were found in (one pass over the buffer for all the parts of the host). */
const triangles = new WeakMap<object, Map<number, number[]>>()

/**
 * Whether each corner of the box (centre, half sizes, axes as three rows of 3) has a point within `tolerance` on every axis. A side thinner than its tolerance is a plane
 * (a sheet with no thickness): its two sides are the same corners.
 */
const hugs = (points: Points, box: { readonly center: readonly number[]; readonly half: readonly number[]; readonly axes: readonly number[]; readonly tolerance: readonly number[] }): boolean => {
  const found = new Uint8Array(8)
  const a = box.axes
  let flat = 0
  for (let k = 0; k < 3; k++) if (box.half[k] <= box.tolerance[k]) flat |= 1 << k
  for (let i = 0; i < points.length; i += 3) {
    const dx = points[i] - box.center[0], dy = points[i + 1] - box.center[1], dz = points[i + 2] - box.center[2]
    let corner = 0
    let near = true
    for (let k = 0; k < 3 && near; k++) {
      const t = dx * a[k * 3] + dy * a[k * 3 + 1] + dz * a[k * 3 + 2]
      if (Math.abs(Math.abs(t) - box.half[k]) > box.tolerance[k]) near = false
      else if (t >= 0) corner |= 1 << k
    }
    if (!near) continue
    corner &= ~flat
    for (let s = flat; ; s = (s - 1) & flat) {
      found[corner | s] = 1
      if (s === 0) break
    }
  }
  for (let c = 0; c < 8; c++) if (!found[c]) return false
  return true
}

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

/** The part's vertices out of the mesh's positions, and the numbers that say they are the same as last time. */
const readPoints = (array: Points, from: number, to: number): { points: Float64Array; sum: number; spread: number } => {
  const points = new Float64Array((to - from) * 3)
  let sum = 0
  let spread = 0
  for (let i = 0; i < points.length; i += 3) {
    const x = array[from * 3 + i], y = array[from * 3 + i + 1], z = array[from * 3 + i + 2]
    points[i] = x
    points[i + 1] = y
    points[i + 2] = z
    const s = x + 3 * y + 7 * z
    sum += s
    spread += s * s
  }
  return { points, sum, spread }
}

/**
 * What a fixed drawn part collides as, in world space, for an engine: one box turned as drawn where a box fits it (every corner has a vertex within `FIT`), else the
 * triangles as drawn (`mesh`, static only). A part drawn by a range of a merged mesh (a wall of the house) is its own vertices only. Nothing is drawn where a part is
 * collapsed to a point, so nothing is made there (`CLAUDE.md` §12). `key` names the part for the engine. The same part in the same place with the same vertices gives the very same list back.
 */
export const drawnSolidsOf = (THREE: typeof THREE_NS, visuals: Visuals, mv: MeshVis, key: string, budget: MeasureBudget): StaticSolid[] => {
  const local = visuals.positionsOf(mv)
  if (!local || local.to <= local.from) return []
  mv.mesh.updateWorldMatrix(true, false)
  const matrix = mv.mesh.matrixWorld.elements
  const { points, sum, spread } = readPoints(local.array, local.from, local.to)
  const known = made.get(mv)
  if (known && known.from === local.from && known.to === local.to && known.sum === sum && known.spread === spread && known.matrix.every((v, k) => v === matrix[k])) return known.solids
  // out of turns: what was made before stays (its body is kept), a part never made waits for the next call
  if (budget.left <= 0) {
    budget.incomplete = true
    return known?.solids ?? []
  }
  budget.left -= local.to - local.from + PART_COST
  const solids = solidsOfPoints(THREE, mv, points, matrix, local).map((solid) => ({ ...solid, key }))
  made.set(mv, { matrix: [...matrix], from: local.from, to: local.to, sum, spread, solids })
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
  if (hugs(points, { center: centre, half, axes: IDENTITY, tolerance: [FIT / s[0], FIT / s[1], FIT / s[2]] })) {
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
  if (turned && fitsTurned(world, turned)) return [turned]
  return [trimeshOf(mv, world, local)]
}

const fitsTurned = (world: Points, box: OrientedBox): boolean => hugs(world, { center: box.center, half: box.half, axes: axesOfQuat(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]), tolerance: [FIT, FIT, FIT] })

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

/** The triangles of the part in world space (its vertices and the triangles of the geometry that start in its range), with the box around them as the box of the solid. */
const trimeshOf = (mv: MeshVis, world: Float64Array, local: { readonly from: number; readonly to: number }): StaticSolid => {
  const found = mv.host
    ? trianglesOfRanges(mv, mv.host.sharers.filter((s) => s.range && !s.loose).map((s) => s.range as [number, number])).get(local.from) ?? []
    : trianglesOfRanges(mv, [[0, local.to]]).get(0) ?? []
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
