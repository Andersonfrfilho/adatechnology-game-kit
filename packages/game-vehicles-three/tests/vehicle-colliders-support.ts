import { readdirSync } from 'node:fs'

import { buildVehicleItem, createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'
import { expect } from 'vitest'
import { vehicleColliders } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createVehicleKit({ THREE, document: fakeDocument })
installFleet(kit)

/** The surface check of the whole fleet is run by this many files (vehicle-colliders-surface-<n>.test.ts), so CI can shard it: vitest shards by file. */
export const SURFACE_PARTS = 12
const surfaceFiles = readdirSync(new URL('.', import.meta.url)).filter((name) => /^vehicle-colliders-surface-\d+\.test\.ts$/.test(name))
if (surfaceFiles.length !== SURFACE_PARTS) throw new Error(`SURFACE_PARTS is ${SURFACE_PARTS} but there are ${surfaceFiles.length} vehicle-colliders-surface-<n>.test.ts files: a part of the fleet would go unchecked`)

/** The ids of part `part` (0-based) of the fleet, dealt round-robin so a new model lands in a part of its own. */
export const surfacePartIds = (part: number): string[] => fleetVehicleIds.filter((_, index) => index % SURFACE_PARTS === part)

/** What the piece may reach past its own mesh (m). */
export const REACH = 0.01
/** A sheet with no thickness is held by a box 5 mm thicker on each side. */
export const MIN_PLANE = 0.005
export const SAMPLE = 3000
/** How far collision geometry may be from the drawn surface (m). */
export const SURFACE = 0.01

export type Points = number[]

export const isDrawn = (mesh: THREE.Mesh): boolean => {
  if (!mesh.isMesh || !mesh.geometry || mesh.userData.ghost || mesh.userData.helper || !mesh.geometry.getAttribute('position')) return false
  for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (node.visible === false) return false
  return true
}

/** The vertices of the meshes under `objects` in the frame, as x y z triples (every `step`-th vertex). */
export const pointsOf = (objects: readonly THREE.Object3D[], frame: THREE.Object3D, skip: ReadonlySet<THREE.Mesh>, step = 1): { points: Points; meshes: Set<THREE.Mesh> } => {
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const points: Points = []
  const meshes = new Set<THREE.Mesh>()
  const v = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  for (const object of objects) {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (skip.has(mesh) || !isDrawn(mesh)) return
      meshes.add(mesh)
      mesh.updateWorldMatrix(true, false)
      matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i += step) {
        v.fromBufferAttribute(position, i).applyMatrix4(matrix)
        points.push(v.x, v.y, v.z)
      }
    })
  }
  return { points, meshes }
}

export const boundsOf = (points: Points): THREE.Box3 => {
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < points.length; i += 3) box.expandByPoint(v.set(points[i] as number, points[i + 1] as number, points[i + 2] as number))
  return box
}

export type Piece = ReturnType<typeof vehicleColliders>[number]

export const cornersOf = (piece: Piece): THREE.Vector3[] => {
  const q = new THREE.Quaternion(...piece.rotation)
  const out: THREE.Vector3[] = []
  for (let c = 0; c < 8; c++) {
    out.push(new THREE.Vector3((c & 1 ? 1 : -1) * piece.half[0], (c & 2 ? 1 : -1) * piece.half[1], (c & 4 ? 1 : -1) * piece.half[2]).applyQuaternion(q).add(new THREE.Vector3(...piece.center)))
  }
  return out
}

/** The distance from the point to the nearest of the points (x y z triples). */
export const nearest = (point: THREE.Vector3, points: Points): number => {
  let best = Infinity
  for (let i = 0; i < points.length; i += 3) {
    const d = Math.hypot(point.x - (points[i] as number), point.y - (points[i + 1] as number), point.z - (points[i + 2] as number))
    if (d < best) best = d
  }
  return best
}

export const isInside = (piece: Piece, x: number, y: number, z: number, slack: number): boolean => {
  const local = new THREE.Vector3(x - piece.center[0], y - piece.center[1], z - piece.center[2]).applyQuaternion(new THREE.Quaternion(...piece.rotation).invert())
  return Math.abs(local.x) <= piece.half[0] + slack && Math.abs(local.y) <= piece.half[1] + slack && Math.abs(local.z) <= piece.half[2] + slack
}


/** The drawn triangles of the meshes in the frame, in a grid of 2 cm cells (a triangle in every cell its box touches): the distance of a point to the drawn surface within 1 cm. */
export class Surface {
  /** Cell number to its place in `starts`; the triangles of cell `i` are `members[starts[i] .. starts[i + 1])`. */
  private readonly cellIndex = new Map<number, number>()
  private starts = new Int32Array(0)
  private members = new Int32Array(0)
  private triangles = new Float32Array(0)
  constructor(objects: readonly THREE.Object3D[], frame: THREE.Object3D, skip: ReadonlySet<THREE.Mesh>) {
    const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert()
    const matrix = new THREE.Matrix4()
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const flat: number[] = []
    const counts: number[] = []
    /** Every cell a point of the triangle lies in: a triangle whose box spans many cells is halved on its longest edge until each piece spans at most two per axis, so a long diagonal sliver does not claim the whole volume of its box. */
    const eachCell = (at: number, visit: (cell: number) => void): void => {
      const seen = new Set<number>()
      const walk = (a: number[], b: number[], c: number[], depth: number): void => {
        const lo = [0, 1, 2].map((k) => Math.floor(Math.min(a[k]!, b[k]!, c[k]!) / CELL))
        const hi = [0, 1, 2].map((k) => Math.floor(Math.max(a[k]!, b[k]!, c[k]!) / CELL))
        const small = hi[0]! - lo[0]! <= 1 && hi[1]! - lo[1]! <= 1 && hi[2]! - lo[2]! <= 1
        if (small || depth > 24) {
          for (let x = lo[0]!; x <= hi[0]!; x++) for (let y = lo[1]!; y <= hi[1]!; y++) for (let z = lo[2]!; z <= hi[2]!; z++) seen.add(cellOf(x, y, z))
          return
        }
        const ab = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!), bc = Math.hypot(b[0]! - c[0]!, b[1]! - c[1]!, b[2]! - c[2]!), ca = Math.hypot(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!)
        const mid = (p: number[], q: number[]): number[] => [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2, (p[2]! + q[2]!) / 2]
        if (ab >= bc && ab >= ca) { const m = mid(a, b); walk(a, m, c, depth + 1); walk(m, b, c, depth + 1) }
        else if (bc >= ca) { const m = mid(b, c); walk(a, b, m, depth + 1); walk(a, m, c, depth + 1) }
        else { const m = mid(c, a); walk(a, b, m, depth + 1); walk(m, b, c, depth + 1) }
      }
      const f = flat
      walk([f[at * 9]!, f[at * 9 + 1]!, f[at * 9 + 2]!], [f[at * 9 + 3]!, f[at * 9 + 4]!, f[at * 9 + 5]!], [f[at * 9 + 6]!, f[at * 9 + 7]!, f[at * 9 + 8]!], 0)
      seen.forEach(visit)
    }
    for (const object of objects) {
      object.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (skip.has(mesh) || !isDrawn(mesh)) return
        matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
        const position = mesh.geometry.getAttribute('position')
        const index = mesh.geometry.getIndex()
        const count = (index ? index.count : position.count) / 3
        for (let t = 0; t < count; t++) {
          for (let k = 0; k < 3; k++) v[k]!.fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(matrix)
          flat.push(v[0]!.x, v[0]!.y, v[0]!.z, v[1]!.x, v[1]!.y, v[1]!.z, v[2]!.x, v[2]!.y, v[2]!.z)
        }
      })
    }
    this.triangles = Float32Array.from(flat)
    const total = flat.length / 9
    for (let at = 0; at < total; at++) {
      eachCell(at, (cell) => {
        let i = this.cellIndex.get(cell)
        if (i === undefined) {
          i = counts.length
          this.cellIndex.set(cell, i)
          counts.push(0)
        }
        counts[i] = counts[i]! + 1
      })
    }
    this.starts = new Int32Array(counts.length + 1)
    for (let i = 0; i < counts.length; i++) this.starts[i + 1] = this.starts[i]! + counts[i]!
    this.members = new Int32Array(this.starts[counts.length]!)
    const filled = new Int32Array(counts.length)
    for (let at = 0; at < total; at++) {
      eachCell(at, (cell) => {
        const i = this.cellIndex.get(cell)!
        this.members[this.starts[i]! + filled[i]!++] = at
      })
    }
  }
  /** The distance to the nearest drawn triangle if it is within `limit` (at most one cell), else Infinity. */
  distance(x: number, y: number, z: number, limit: number): number {
    const triangle = new THREE.Triangle()
    const target = new THREE.Vector3()
    const point = new THREE.Vector3(x, y, z)
    let best = Infinity
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL)
    const t = this.triangles
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const cell = this.cellIndex.get(cellOf(cx + i, cy + j, cz + k))
      if (cell === undefined) continue
      for (let m = this.starts[cell]!; m < this.starts[cell + 1]!; m++) {
        const at = this.members[m]!
        triangle.a.set(t[at * 9]!, t[at * 9 + 1]!, t[at * 9 + 2]!)
        triangle.b.set(t[at * 9 + 3]!, t[at * 9 + 4]!, t[at * 9 + 5]!)
        triangle.c.set(t[at * 9 + 6]!, t[at * 9 + 7]!, t[at * 9 + 8]!)
        const d = triangle.closestPointToPoint(point, target).distanceTo(point)
        if (d < best) best = d
      }
    }
    return best <= limit ? best : Infinity
  }
}
const CELL = 0.02
const cellOf = (x: number, y: number, z: number): number => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)

export const build = (id: string): { vehicle: VehicleDestructible; frame: THREE.Object3D; dispose: () => void } => {
  const item = buildVehicleItem(kit, id)
  const vehicle = createVehicleDestructible(kit, item.vehicle, { id: 'check', frame: item.root })
  item.root.updateMatrixWorld(true)
  return { vehicle, frame: item.root, dispose: () => kit.dispose(item.vehicle) }
}

/** Every collision vertex and triangle of every piece of the model lies within 1 cm of its own drawn surface. */
export const checkSurface = (id: string): void => {
    const { vehicle, frame, dispose } = build(id)
    const pieces = vehicleColliders(THREE, vehicle, frame)
    const owned = new Set<THREE.Mesh>()
    const own = new Map<string, Surface>()
    for (const part of vehicle.model.parts) {
      const objects = vehicle.objectsOf(part.id)
      const surface = new Surface(objects, frame, owned)
      pointsOf(objects, frame, owned).meshes.forEach((mesh) => owned.add(mesh))
      own.set(part.id, surface)
    }
    const shell = new Surface([vehicle.vehicle.vehicle as THREE.Object3D], frame, owned)
    let worst = 0
    let checked = 0
    for (const piece of pieces) {
      if (!piece.mesh) continue
      const { vertices, indices } = piece.mesh
      const samples: number[] = []
      for (let i = 0; i < vertices.length; i += 3) samples.push(vertices[i]!, vertices[i + 1]!, vertices[i + 2]!)
      const triangles = indices.length / 3
      const stride = Math.max(1, Math.floor(triangles / 1500))
      for (let t = 0; t < triangles; t += stride) {
        const a = indices[t * 3]! * 3, b = indices[t * 3 + 1]! * 3, c = indices[t * 3 + 2]! * 3
        for (let k = 0; k < 3; k++) {
          samples.push((vertices[a + k]! + vertices[b + k]! + vertices[c + k]!) / 3)
        }
        for (const [p, q] of [[a, b], [b, c], [c, a]] as const) for (let k = 0; k < 3; k++) samples.push((vertices[p + k]! + vertices[q + k]!) / 2)
      }
      for (let i = 0; i < samples.length; i += 3) {
        const d = Math.min(own.get(piece.id)?.distance(samples[i]!, samples[i + 1]!, samples[i + 2]!, SURFACE) ?? Infinity, shell.distance(samples[i]!, samples[i + 1]!, samples[i + 2]!, SURFACE))
        checked++
        if (d === Infinity) worst = Infinity
        else worst = Math.max(worst, d)
        if (d === Infinity) expect.fail(`${id}: ${piece.id} has collision geometry more than 1 cm from its drawn surface at ${samples.slice(i, i + 3).map((n) => n.toFixed(3))} (${i < vertices.length ? "vertex" : "triangle point"}, piece of ${triangles} triangles)`)
      }
    }
    expect(checked).toBeGreaterThan(0)
    expect(worst).toBeLessThanOrEqual(SURFACE)
    dispose()
}
