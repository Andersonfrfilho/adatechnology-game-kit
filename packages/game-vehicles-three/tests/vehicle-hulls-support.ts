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
export const drawnTriangles = (root: THREE.Object3D, frame: THREE.Object3D): Triangles => {
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const matrix = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const out: number[] = []
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!isDrawn(mesh)) return
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

/** The faces of the hulls (the ones of `parts`, or all) as triangles. */
export const hullTriangles = (hulls: readonly VehicleHull[]): Triangles => {
  const out: number[] = []
  for (const hull of hulls) {
    const faces = convexFaces(hull.points)
    if (!faces) continue
    for (const face of faces) for (const corner of face) out.push(hull.points[corner * 3]!, hull.points[corner * 3 + 1]!, hull.points[corner * 3 + 2]!)
  }
  return Float32Array.from(out)
}

/** The depth (along the ray direction, from the near side) of the nearest triangle at each cell of a plane across the direction; NaN where there is none. */
export interface DepthMap {
  readonly width: number
  readonly height: number
  readonly depth: Float32Array
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
export const depthMap = (triangles: Triangles, frame: RayFrame): DepthMap => {
  const depth = new Float32Array(frame.width * frame.height).fill(NaN)
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
        if (!(q >= depth[at]!)) depth[at] = q
      }
    }
  }
  return { width: frame.width, height: frame.height, depth }
}

export interface RayCounts {
  /** Rays of the 5 cm grid that hit the drawn shell. */
  drawn: number
  /** Of those, the ones whose nearest hull hit is between `inside` before the drawn point and `outside` after it (H3). */
  covered: number
  /** Rays where a hull is met more than `outside` before the drawn point (H2). */
  standingOut: number
  /** Rays that miss the drawn shell and every ray within 1 cm of them also does, and still meet a hull (H4). */
  phantom: number
  /** The worst the hull stands out, m. */
  worstOut: number
}

/** H2, H3 and H4 for one direction: the rays are the cells every `STRIDE` along the grid; a hull may stand out `outside` in front of the drawn surface and be `inside` behind it. */
export const compareRays = (drawn: DepthMap, hull: DepthMap, outside: number, inside: number): RayCounts => {
  const counts: RayCounts = { drawn: 0, covered: 0, standingOut: 0, phantom: 0, worstOut: 0 }
  const slack = Math.round(0.01 / FINE)
  for (let j = Math.floor(STRIDE / 2); j < drawn.height; j += STRIDE) {
    for (let i = Math.floor(STRIDE / 2); i < drawn.width; i += STRIDE) {
      const at = j * drawn.width + i
      const d = drawn.depth[at]!, h = hull.depth[at]!
      if (Number.isNaN(d)) {
        if (Number.isNaN(h)) continue
        let near = false
        for (let dj = -slack; dj <= slack && !near; dj++) {
          for (let di = -slack; di <= slack && !near; di++) {
            const jj = j + dj, ii = i + di
            if (jj >= 0 && jj < drawn.height && ii >= 0 && ii < drawn.width && !Number.isNaN(drawn.depth[jj * drawn.width + ii]!)) near = true
          }
        }
        if (!near) counts.phantom++
        continue
      }
      counts.drawn++
      if (!Number.isNaN(h) && h >= d - outside && h <= d + inside) counts.covered++
      if (!Number.isNaN(h) && h < d - outside) {
        counts.standingOut++
        counts.worstOut = Math.max(counts.worstOut, d - h)
      }
    }
  }
  return counts
}

/** Parts that are a solid block: one hull whole, its volume held by H5. */
export const SOLID_CHECKED: ReadonlySet<string> = new Set(['rim', 'tyre', 'battery', 'fuel_tank', 'engine', 'gearbox', 'oil_pan', 'alternator', 'radiator'])

/** Whether every edge of the triangles is shared by exactly two (vertices welded at 0.1 mm): only then the signed volume is a volume. */
const isClosed = (triangles: Triangles): boolean => {
  const key = (i: number): string => `${Math.round(triangles[i]! * 1e4)},${Math.round(triangles[i + 1]! * 1e4)},${Math.round(triangles[i + 2]! * 1e4)}`
  const edges = new Map<string, number>()
  for (let t = 0; t < triangles.length; t += 9) {
    const corners = [key(t), key(t + 3), key(t + 6)]
    for (let k = 0; k < 3; k++) {
      const a = corners[k]!, b = corners[(k + 1) % 3]!
      if (a === b) continue
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`
      edges.set(edge, (edges.get(edge) ?? 0) + 1)
    }
  }
  for (const count of edges.values()) if (count !== 2) return false
  return true
}

/** The volume (m3) and the area (m2) of a closed set of triangles, or null when it is not closed. */
export const solidOf = (triangles: Triangles): { volume: number; area: number } | null => {
  if (triangles.length === 0 || !isClosed(triangles)) return null
  let volume = 0
  let area = 0
  for (let t = 0; t < triangles.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [triangles[t]!, triangles[t + 1]!, triangles[t + 2]!, triangles[t + 3]!, triangles[t + 4]!, triangles[t + 5]!, triangles[t + 6]!, triangles[t + 7]!, triangles[t + 8]!]
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)
    area += Math.hypot((by - ay) * (cz - az) - (bz - az) * (cy - ay), (bz - az) * (cx - ax) - (bx - ax) * (cz - az), (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2
  }
  return { volume: Math.abs(volume) / 6, area }
}
