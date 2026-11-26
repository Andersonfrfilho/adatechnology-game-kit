import * as THREE from 'three'

import { convexFaces } from '../src'
import type { VehicleHull } from '../src'
import { isDrawn } from './vehicle-colliders-support'

/** The 26 directions of the cube around a point (design 10.3, H3), unit length. */
export const RAY_DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<readonly [number, number, number]> = []
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (x === 0 && y === 0 && z === 0) continue
    const length = Math.hypot(x, y, z)
    out.push([x / length, y / length, z / length])
  }
  return out
})()

/** The rays of the check are on a grid of this side (m) (H3); a finer grid of `FINE` is what the depths are measured on, so the 1 cm of slack of H2 and H4 has something to be read from. */
export const RAY_GRID = 0.05
export const FINE = 0.01
const STRIDE = Math.round(RAY_GRID / FINE)

/** Triangles as nine numbers each. */
export type Triangles = Float32Array

/** The triangles of every drawn mesh under `root`, in the frame. */
export const drawnTriangles = (root: THREE.Object3D, frame: THREE.Object3D, skip: ReadonlySet<THREE.Object3D> = new Set()): Triangles => {
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const matrix = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const out: number[] = []
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!isDrawn(mesh)) return
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (skip.has(node)) return
    mesh.updateWorldMatrix(true, false)
    matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = Math.floor((index ? index.count : position.count) / 3)
    for (let t = 0; t < count; t++) {
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(matrix)
        out.push(v.x, v.y, v.z)
      }
    }
  })
  return Float32Array.from(out)
}

/** The faces of the hulls as triangles, and for each triangle the number of the part (`partNumbers`, by id) its hull belongs to. */
export const hullTriangles = (hulls: readonly VehicleHull[], partNumbers: ReadonlyMap<string, number>): { triangles: Triangles; owners: Int32Array } => {
  const out: number[] = []
  const owners: number[] = []
  for (const hull of hulls) {
    const faces = convexFaces(hull.points)
    if (!faces) continue
    for (const face of faces) {
      for (const corner of face) out.push(hull.points[corner * 3]!, hull.points[corner * 3 + 1]!, hull.points[corner * 3 + 2]!)
      owners.push(partNumbers.get(hull.id) ?? -1)
    }
  }
  return { triangles: Float32Array.from(out), owners: Int32Array.from(owners) }
}

/** The depth (along the ray direction, from the near side) of the nearest triangle at each cell of a plane across the direction; NaN where there is none. */
export interface DepthMap {
  readonly width: number
  readonly height: number
  readonly depth: Float32Array
  /** The set a cell's nearest triangle belongs to (`owners`, one number per triangle), -1 where there is none; only when `owners` was given. */
  readonly owner: Int32Array | null
}

export interface RayFrame {
  readonly direction: readonly [number, number, number]
  readonly u: readonly [number, number, number]
  readonly v: readonly [number, number, number]
  /** Corner of the grid in the plane's coordinates. */
  readonly originU: number
  readonly originV: number
  readonly width: number
  readonly height: number
}

const dot = (a: readonly number[], x: number, y: number, z: number): number => a[0]! * x + a[1]! * y + a[2]! * z

/** A plane across the direction that holds every triangle of both sets, divided in cells of `FINE`. */
export const frameFor = (direction: readonly [number, number, number], sets: readonly Triangles[]): RayFrame => {
  const axis: readonly [number, number, number] = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  const norm = (a: [number, number, number]): [number, number, number] => {
    const l = Math.hypot(...a)
    return [a[0] / l, a[1] / l, a[2] / l]
  }
  const u = norm(cross(direction, axis))
  const v = norm(cross(direction, u))
  let lowU = Infinity, highU = -Infinity, lowV = Infinity, highV = -Infinity
  for (const triangles of sets) {
    for (let i = 0; i < triangles.length; i += 3) {
      const a = dot(u, triangles[i]!, triangles[i + 1]!, triangles[i + 2]!), b = dot(v, triangles[i]!, triangles[i + 1]!, triangles[i + 2]!)
      if (a < lowU) lowU = a
      if (a > highU) highU = a
      if (b < lowV) lowV = b
      if (b > highV) highV = b
    }
  }
  const originU = Math.floor(lowU / RAY_GRID) * RAY_GRID - RAY_GRID
  const originV = Math.floor(lowV / RAY_GRID) * RAY_GRID - RAY_GRID
  return { direction, u, v, originU, originV, width: Math.ceil((highU - originU) / FINE) + STRIDE, height: Math.ceil((highV - originV) / FINE) + STRIDE }
}

/** What a ray along the direction meets first, at the centre of every cell. */
export const depthMap = (triangles: Triangles, frame: RayFrame, owners?: ArrayLike<number>): DepthMap => {
  const depth = new Float32Array(frame.width * frame.height).fill(NaN)
  const owner = owners ? new Int32Array(frame.width * frame.height).fill(-1) : null
  for (let t = 0; t < triangles.length; t += 9) {
    const pa: number[] = [], pb: number[] = [], pq: number[] = []
    for (let k = 0; k < 3; k++) {
      const x = triangles[t + k * 3]!, y = triangles[t + k * 3 + 1]!, z = triangles[t + k * 3 + 2]!
      pa.push(dot(frame.u, x, y, z))
      pb.push(dot(frame.v, x, y, z))
      pq.push(dot(frame.direction, x, y, z))
    }
    const lowA = Math.min(pa[0]!, pa[1]!, pa[2]!), highA = Math.max(pa[0]!, pa[1]!, pa[2]!)
    const lowB = Math.min(pb[0]!, pb[1]!, pb[2]!), highB = Math.max(pb[0]!, pb[1]!, pb[2]!)
    const cellA0 = Math.max(0, Math.floor((lowA - frame.originU) / FINE - 0.5)), cellA1 = Math.min(frame.width - 1, Math.ceil((highA - frame.originU) / FINE - 0.5))
    const cellB0 = Math.max(0, Math.floor((lowB - frame.originV) / FINE - 0.5)), cellB1 = Math.min(frame.height - 1, Math.ceil((highB - frame.originV) / FINE - 0.5))
    const area = (pa[1]! - pa[0]!) * (pb[2]! - pb[0]!) - (pa[2]! - pa[0]!) * (pb[1]! - pb[0]!)
    if (Math.abs(area) < 1e-12) continue
    for (let j = cellB0; j <= cellB1; j++) {
      const b = frame.originV + (j + 0.5) * FINE
      for (let i = cellA0; i <= cellA1; i++) {
        const a = frame.originU + (i + 0.5) * FINE
        const w1 = ((a - pa[0]!) * (pb[2]! - pb[0]!) - (pa[2]! - pa[0]!) * (b - pb[0]!)) / area
        const w2 = ((pa[1]! - pa[0]!) * (b - pb[0]!) - (a - pa[0]!) * (pb[1]! - pb[0]!)) / area
        const w0 = 1 - w1 - w2
        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue
        const q = w0 * pq[0]! + w1 * pq[1]! + w2 * pq[2]!
        const at = j * frame.width + i
        if (!(q >= depth[at]!)) {
          depth[at] = q
          if (owner) owner[at] = owners![t / 9]!
        }
      }
    }
  }
  return { width: frame.width, height: frame.height, depth, owner }
}

/** The ball of K3 to K5 (m): the first touch of a ball of this radius on the depth map is where a thing the size of a fist stops. */
export const BALL = 0.1
/** K3: a ball that touches a hull has the drawn surface within its radius plus this (m). */
export const REACH_EXTRA = 0.03
/** K4: a hull is ahead of the drawn surface when a ball meets it this much (m) before the drawn one. */
export const AHEAD = 0.03
/** K5: a hull is behind the drawn surface when a ball meets it this much (m) after the drawn one, or never. */
export const BEHIND = 0.05

const offsetsOf = (radius: number): ReadonlyArray<readonly [number, number, number]> => {
  const cells = Math.round(radius / FINE)
  const out: Array<readonly [number, number, number]> = []
  for (let dj = -cells; dj <= cells; dj++) {
    for (let di = -cells; di <= cells; di++) {
      const d2 = (di * di + dj * dj) * FINE * FINE
      if (d2 <= radius * radius) out.push([di, dj, Math.sqrt(radius * radius - d2)])
    }
  }
  return out
}
const BALL_CELLS = offsetsOf(BALL)
const REACH_CELLS = offsetsOf(BALL + REACH_EXTRA)

/** Where the centre of a ball of `BALL` is when it first touches the map coming along the ray at the cell (depth of the centre); NaN when it touches nothing. */
export const ballCentre = (map: DepthMap, i: number, j: number): number => {
  let best = Infinity
  for (const [di, dj, rise] of BALL_CELLS) {
    const ii = i + di, jj = j + dj
    if (ii < 0 || jj < 0 || ii >= map.width || jj >= map.height) continue
    const d = map.depth[jj * map.width + ii]!
    if (Number.isNaN(d)) continue
    if (d - rise < best) best = d - rise
  }
  return best === Infinity ? NaN : best
}

/** Whether the map has a surface within `BALL + REACH_EXTRA` of the point at the cell and depth. */
const hasSurfaceWithin = (map: DepthMap, i: number, j: number, depth: number): boolean => {
  for (const [di, dj, reach] of REACH_CELLS) {
    const ii = i + di, jj = j + dj
    if (ii < 0 || jj < 0 || ii >= map.width || jj >= map.height) continue
    const d = map.depth[jj * map.width + ii]!
    if (!Number.isNaN(d) && Math.abs(d - depth) <= reach) return true
  }
  return false
}

export interface BallCounts {
  /** Balls on the 5 cm grid that touch the drawn shell. */
  drawn: number
  /** K3: the ball meets a hull first and there is no drawn surface within its radius plus `REACH_EXTRA` of where it stops. */
  floating: number
  /** K4: the ball meets a hull more than `AHEAD` before the drawn shell; the hull of each is named in `aheadByOwner`. */
  ahead: number
  /** K5: the ball meets a hull more than `BEHIND` after the drawn shell, or no hull. */
  behind: number
  readonly aheadByOwner: Map<number, number>
  readonly floatingByOwner: Map<number, number>
}

/** K3, K4 and K5 for one direction: balls on a grid of `RAY_GRID` come along the ray onto the drawn map and onto the hull map. */
export const compareBalls = (drawn: DepthMap, hull: DepthMap): BallCounts => {
  const counts: BallCounts = { drawn: 0, floating: 0, ahead: 0, behind: 0, aheadByOwner: new Map(), floatingByOwner: new Map() }
  for (let j = Math.floor(STRIDE / 2); j < drawn.height; j += STRIDE) {
    for (let i = Math.floor(STRIDE / 2); i < drawn.width; i += STRIDE) {
      const d = ballCentre(drawn, i, j)
      const h = ballCentre(hull, i, j)
      if (!Number.isNaN(d)) {
        counts.drawn++
        if (Number.isNaN(h) || h > d + BEHIND) counts.behind++
      }
      if (Number.isNaN(h) || (!Number.isNaN(d) && h >= d)) continue
      const owner = hull.owner?.[j * hull.width + i] ?? -1
      if (!hasSurfaceWithin(drawn, i, j, h)) {
        counts.floating++
        counts.floatingByOwner.set(owner, (counts.floatingByOwner.get(owner) ?? 0) + 1)
      }
      if (!Number.isNaN(d) && h < d - AHEAD) {
        counts.ahead++
        counts.aheadByOwner.set(owner, (counts.aheadByOwner.get(owner) ?? 0) + 1)
      }
    }
  }
  return counts
}
