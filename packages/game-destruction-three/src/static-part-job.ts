import { fitOrientedBox, hugs } from '@adatechnology/game-shapes'
import type { OrientedBox } from '@adatechnology/game-shapes'

import { isRoundSolid } from './built-solids'
import type { BuiltSolid } from './built-solids'
import type { StaticSolid } from './engine-statics'

/** A box fits a drawn part when each of its eight corners has a vertex within this (m): a box drawn is a box held, a cylinder or a chamfered post is not. */
const FIT = 0.01
/** A box holds a part only when the part's own triangles lie in each of its faces and cover at least this share of the face (a raised panel leaves its edge short, a frame leaves most of it open): a door frame (two posts and a lintel) has a box's eight corners and none of its faces. */
const FILL = 0.5
/** A box holds a part only when the part's triangles enclose at least this share of the box: boards round the air (a kennel, a crate, a cabinet drawn as one part) have a box's corners and cover its faces, and what is inside them is not theirs. */
const SOLID = 0.5
/** The thinnest half (m) a drawn plane (a sheet with no thickness) is held by. */
const MIN_HALF = 0.005
/** A part whose every side is under this (m) is collapsed to a point (hidden by its host): nothing is drawn there. */
const COLLAPSED = 0.002
/** A face of a box under this area (m²) is a plane's edge: it has nothing to cover. */
const MIN_FACE = 1e-6

type Points = ArrayLike<number>

/**
 * One fixed drawn part to measure (`measureStaticPart`): plain arrays, so it crosses to a worker (`destruction.static-colliders`). The main thread reads the vertices,
 * the triangles and the mesh's world matrix (with three's own `decompose` of it); the measuring is here.
 */
export interface StaticPartJob {
  /** The part's vertices in the mesh's frame, three numbers each, with what another drawing collapses there already collapsed. */
  readonly points: Float64Array
  /** The mesh's world matrix (16 numbers, column major). */
  readonly matrix: Float64Array
  /** The world matrix decomposed (three's `Matrix4.decompose`): position, quaternion (x, y, z, w) and scale. */
  readonly position: readonly [number, number, number]
  readonly quaternion: readonly [number, number, number, number]
  readonly scale: readonly [number, number, number]
  /** The triangles of the part as vertex numbers of the host (three each), `from` its first vertex. */
  readonly found: Uint32Array
  readonly from: number
  /** The solids the mesh was built from (`builtSolidsOf`), in the mesh's frame: with them the part is those boxes, and nothing is measured. */
  readonly solids?: readonly BuiltSolid[]
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** The axes (three rows of 3) of a box turned by the quaternion. */
const axesOfQuat = (x: number, y: number, z: number, w: number): number[] => [
  1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
  2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
  2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
]

/** The point turned by the unit quaternion, in the very operations of three's `Vector3.applyQuaternion` (r160), so the numbers are the same bits. */
const turn = (vx: number, vy: number, vz: number, q: readonly [number, number, number, number]): [number, number, number] => {
  const [qx, qy, qz, qw] = q
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)
  return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx]
}

/**
 * What a fixed drawn part collides as, in world space, for an engine: one box turned as drawn where a box fits it (every corner has a vertex within `FIT`, its
 * triangles cover its faces and enclose `SOLID` of it), else the box turned to fit the world vertices where that one fits, else the triangles as drawn (`mesh`, static only). A part collapsed to
 * a point is nothing (`CLAUDE.md` §12). A pure function of the job: the worker and the main thread give the same bits (`staticCollidersKind`).
 */
export function measureStaticPart(job: StaticPartJob): StaticSolid[] {
  const { points, matrix, position: pos, quaternion: quat, scale, found, from } = job
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
  const s = [Math.abs(scale[0]), Math.abs(scale[1]), Math.abs(scale[2])]
  if (Math.max(size[0] * s[0], size[1] * s[1], size[2] * s[2]) < COLLAPSED) return []
  // what the builder drew, box by box (spec 019): the part is that, turned and put where the mesh is
  if (job.solids && job.solids.length > 0) return job.solids.map((solid) => builtSolidIn(solid, pos, quat, scale))
  const centre = [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2]
  const half = [size[0] / 2, size[1] / 2, size[2] / 2]
  // the box of the geometry in its own frame, turned by the mesh: the drawn box of a wall, a table top, a beam
  const straight = { center: centre, half, axes: IDENTITY, tolerance: [FIT / s[0], FIT / s[1], FIT / s[2]] }
  if (hugs(points, straight) && fillsFaces(points, found, from, straight) && fillsVolume(points, found, from, straight)) {
    const [cx, cy, cz] = turn(centre[0] * scale[0], centre[1] * scale[1], centre[2] * scale[2], quat)
    return [{ center: [cx + pos[0], cy + pos[1], cz + pos[2]], half: [Math.max(MIN_HALF, half[0] * s[0]), Math.max(MIN_HALF, half[1] * s[1]), Math.max(MIN_HALF, half[2] * s[2])], rotation: [quat[0], quat[1], quat[2], quat[3]] }]
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
  if (turned && fitsTurned(world, turned) && fillsFaces(world, found, from, turnedBox(turned)) && fillsVolume(world, found, from, turnedBox(turned))) return [turned]
  return [trimeshOf(world, from, found)]
}

/** A solid of the mesh (its frame) as a box of the world: carried by the mesh's place, turn and scale. A turned solid keeps its shape under one scale only, so the mean of the three stands for a mesh scaled unevenly. */
const builtSolidIn = (solid: BuiltSolid, pos: readonly number[], quat: readonly [number, number, number, number], scale: readonly number[]): StaticSolid => {
  const [cx, cy, cz] = turn(solid.center[0] * scale[0], solid.center[1] * scale[1], solid.center[2] * scale[2], quat)
  const [ax, ay, az, aw] = quat
  const [bx, by, bz, bw] = solid.rotation
  const turned = Math.abs(bw) < 1 - 1e-9
  const even = (Math.abs(scale[0]) + Math.abs(scale[1]) + Math.abs(scale[2])) / 3
  const s = turned ? [even, even, even] : [Math.abs(scale[0]), Math.abs(scale[1]), Math.abs(scale[2])]
  return {
    ...(isRoundSolid(solid) && Math.abs(s[0] - s[2]) <= 1e-9 ? { round: true as const } : {}),
    center: [cx + pos[0], cy + pos[1], cz + pos[2]],
    half: [Math.max(MIN_HALF, solid.half[0] * s[0]), Math.max(MIN_HALF, solid.half[1] * s[1]), Math.max(MIN_HALF, solid.half[2] * s[2])],
    // the mesh's turn, then the solid's own
    rotation: [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz],
  }
}

/** The buffers of a measured part to transfer back (the triangles of a trimesh). */
export const staticSolidsTransfer = (solids: readonly StaticSolid[]): ArrayBuffer[] => {
  const out: ArrayBuffer[] = []
  for (const solid of solids) if (solid.mesh) out.push(solid.mesh.vertices.buffer as ArrayBuffer, solid.mesh.indices.buffer as ArrayBuffer)
  return out
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
const fillsFaces = (points: Points, found: ArrayLike<number>, from: number, box: FitBox): boolean => {
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

/**
 * Whether the part's triangles enclose at least `SOLID` of the box (the volume they close about the box's centre, whichever way the mesh is wound): a hollow thing covers the
 * faces of the box around it and holds only its boards. A sheet with no thickness encloses nothing and neither does its box: it is held as before.
 */
const fillsVolume = (points: Points, found: ArrayLike<number>, from: number, box: FitBox): boolean => {
  if (found.length === 0) return true
  const whole = 8 * box.half[0] * box.half[1] * box.half[2]
  if (!(whole > 0)) return true
  const [cx, cy, cz] = box.center
  let six = 0
  for (let i = 0; i + 2 < found.length; i += 3) {
    const a = (found[i] - from) * 3, b = (found[i + 1] - from) * 3, c = (found[i + 2] - from) * 3
    const ax = points[a] - cx, ay = points[a + 1] - cy, az = points[a + 2] - cz
    const bx = points[b] - cx, by = points[b + 1] - cy, bz = points[b + 2] - cz
    const dx = points[c] - cx, dy = points[c + 1] - cy, dz = points[c + 2] - cz
    six += ax * (by * dz - bz * dy) + ay * (bz * dx - bx * dz) + az * (bx * dy - by * dx)
  }
  return Math.abs(six) / 6 >= whole * SOLID
}

/** The triangles of the part in world space (its vertices and the triangles of the geometry that start in its range), with the box around them as the box of the solid. */
const trimeshOf = (world: Float64Array, from: number, found: ArrayLike<number>): StaticSolid => {
  const indices = new Uint32Array(found.length)
  for (let i = 0; i < found.length; i++) indices[i] = found[i] - from
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
