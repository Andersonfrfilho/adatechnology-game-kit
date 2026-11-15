import { buildVehicleItem, createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { createVehicleColliders, vehicleColliders } from '../src'
import { fakeDocument } from './fake-dom'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const kit = createVehicleKit({ THREE, document: fakeDocument })
installFleet(kit)

/** What the piece may reach past its own mesh (m). */
const REACH = 0.01
/** A sheet with no thickness is held by a box 5 mm thicker on each side. */
const MIN_PLANE = 0.005
const SAMPLE = 3000
/** How far collision geometry may be from the drawn surface (m). */
const SURFACE = 0.01

type Points = number[]

const isDrawn = (mesh: THREE.Mesh): boolean => {
  if (!mesh.isMesh || !mesh.geometry || mesh.userData.ghost || mesh.userData.helper || !mesh.geometry.getAttribute('position')) return false
  for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (node.visible === false) return false
  return true
}

/** The vertices of the meshes under `objects` in the frame, as x y z triples (every `step`-th vertex). */
const pointsOf = (objects: readonly THREE.Object3D[], frame: THREE.Object3D, skip: ReadonlySet<THREE.Mesh>, step = 1): { points: Points; meshes: Set<THREE.Mesh> } => {
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

const boundsOf = (points: Points): THREE.Box3 => {
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < points.length; i += 3) box.expandByPoint(v.set(points[i] as number, points[i + 1] as number, points[i + 2] as number))
  return box
}

type Piece = ReturnType<typeof vehicleColliders>[number]

const cornersOf = (piece: Piece): THREE.Vector3[] => {
  const q = new THREE.Quaternion(...piece.rotation)
  const out: THREE.Vector3[] = []
  for (let c = 0; c < 8; c++) {
    out.push(new THREE.Vector3((c & 1 ? 1 : -1) * piece.half[0], (c & 2 ? 1 : -1) * piece.half[1], (c & 4 ? 1 : -1) * piece.half[2]).applyQuaternion(q).add(new THREE.Vector3(...piece.center)))
  }
  return out
}

/** The distance from the point to the nearest of the points (x y z triples). */
const nearest = (point: THREE.Vector3, points: Points): number => {
  let best = Infinity
  for (let i = 0; i < points.length; i += 3) {
    const d = Math.hypot(point.x - (points[i] as number), point.y - (points[i + 1] as number), point.z - (points[i + 2] as number))
    if (d < best) best = d
  }
  return best
}

const isInside = (piece: Piece, x: number, y: number, z: number, slack: number): boolean => {
  const local = new THREE.Vector3(x - piece.center[0], y - piece.center[1], z - piece.center[2]).applyQuaternion(new THREE.Quaternion(...piece.rotation).invert())
  return Math.abs(local.x) <= piece.half[0] + slack && Math.abs(local.y) <= piece.half[1] + slack && Math.abs(local.z) <= piece.half[2] + slack
}


/** The drawn triangles of the meshes in the frame, in a grid of 2 cm cells (a triangle in every cell its box touches): the distance of a point to the drawn surface within 1 cm. */
class Surface {
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
    const eachCell = (at: number, visit: (cell: number) => void): void => {
      const lo = [0, 1, 2].map((k) => Math.floor(Math.min(flat[at * 9 + k]!, flat[at * 9 + 3 + k]!, flat[at * 9 + 6 + k]!) / CELL))
      const hi = [0, 1, 2].map((k) => Math.floor(Math.max(flat[at * 9 + k]!, flat[at * 9 + 3 + k]!, flat[at * 9 + 6 + k]!) / CELL))
      for (let x = lo[0]!; x <= hi[0]!; x++) for (let y = lo[1]!; y <= hi[1]!; y++) for (let z = lo[2]!; z <= hi[2]!; z++) visit(cellOf(x, y, z))
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

const build = (id: string): { vehicle: VehicleDestructible; frame: THREE.Object3D; dispose: () => void } => {
  const item = buildVehicleItem(kit, id)
  const vehicle = createVehicleDestructible(kit, item.vehicle, { id: 'check', frame: item.root })
  item.root.updateMatrixWorld(true)
  return { vehicle, frame: item.root, dispose: () => kit.dispose(item.vehicle) }
}

describe('the pieces a vehicle collides with, on the whole fleet', () => {
  it('has the 69 models', () => expect(fleetVehicleIds.length).toBe(69))

  it.each([...fleetVehicleIds])('%s: no box reaches past its own piece and every drawn piece is in a box', (id) => {
    const { vehicle, frame, dispose } = build(id)
    const pieces = vehicleColliders(THREE, vehicle, frame)
    expect(pieces.length).toBeGreaterThan(0)
    const partIds = new Set(vehicle.model.parts.map((part) => part.id))
    // the meshes each part draws on its own, tyre first (a rim's group holds the tyre too), then the shell: what no part owns
    const owned = new Set<THREE.Mesh>()
    const own = new Map<string, Points>()
    for (const part of vehicle.model.parts) {
      const { points, meshes } = pointsOf(vehicle.objectsOf(part.id), frame, owned)
      meshes.forEach((mesh) => owned.add(mesh))
      if (points.length) own.set(part.id, points)
    }
    const shell = pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, owned).points
    const everything = pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, new Set()).points
    let worst = 0
    for (const piece of pieces) {
      expect(partIds.has(piece.id), `${id}: piece ${piece.id} is a part`).toBe(true)
      const mine = own.get(piece.id)
      // a shell piece is held by triangles of the shell, an owned piece by the meshes of its part (which may also own triangles of the shell inside its box)
      const reference = mine ? [...mine, ...shell] : shell
      const bounds = boundsOf(reference).expandByScalar(REACH)
      for (const corner of cornersOf(piece)) {
        worst = Math.max(worst, bounds.distanceToPoint(corner))
        expect(bounds.containsPoint(corner), `${id}: ${piece.id} reaches past its mesh`).toBe(true)
      }
      if (!piece.mesh) {
        // a box is held only where each corner has a vertex of the piece within 1 cm on each axis of the box
        for (const corner of cornersOf(piece)) expect(nearest(corner, reference), `${id}: ${piece.id} corner is air`).toBeLessThanOrEqual((REACH + MIN_PLANE) * Math.sqrt(3) + 1e-6)
      }
    }
    // the union covers what is drawn: a sample of every drawn vertex lies in a piece, within the 2.5 cm a coarsened mesh may move
    const step = Math.max(1, Math.floor(everything.length / 3 / SAMPLE)) * 3
    let missed = 0
    let checked = 0
    for (let i = 0; i < everything.length; i += step) {
      checked++
      if (!pieces.some((piece) => isInside(piece, everything[i] as number, everything[i + 1] as number, everything[i + 2] as number, 0.03))) missed++
    }
    expect(missed, `${id}: ${missed} of ${checked} drawn vertices in no piece`).toBe(0)
    expect(worst).toBeLessThanOrEqual(0.0001)
    dispose()
  }, 120000)

  it('a mirror is a piece of its own and the cab does not reach out to it', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const pieces = vehicleColliders(THREE, vehicle, frame)
    const mirrors = pieces.filter((piece) => /^mirror_/.test(piece.id))
    expect(new Set(mirrors.map((piece) => piece.id))).toEqual(new Set(['mirror_left', 'mirror_right']))
    // the drawing without the mirrors: no other piece reaches past it, so a mirror never widens the cab or the body
    const mirrorMeshes = new Set<THREE.Mesh>()
    for (const mirror of ['mirror_left', 'mirror_right']) pointsOf(vehicle.objectsOf(mirror), frame, mirrorMeshes).meshes.forEach((mesh) => mirrorMeshes.add(mesh))
    const bounds = boundsOf(pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, mirrorMeshes).points).expandByScalar(REACH)
    for (const piece of pieces) {
      if (/^mirror_/.test(piece.id)) continue
      for (const corner of cornersOf(piece)) expect(bounds.containsPoint(corner), `${piece.id} reaches past the drawing without the mirrors`).toBe(true)
    }
    const outermost = (items: readonly Piece[]): number => Math.max(...items.flatMap((piece) => cornersOf(piece).map((corner) => Math.abs(corner.x))))
    expect(outermost(mirrors)).toBeGreaterThan(0)
    dispose()
  }, 60000)

  it('a part that came off has no piece, and the others stay', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const before = vehicleColliders(THREE, vehicle, frame)
    expect(before.some((piece) => piece.id === 'mirror_left')).toBe(true)
    for (let i = 0; i < 200 && vehicle.disassemble!('mirror_left~door_front_left', 'wrench', 0.2) < 1; i++) vehicle.update!(0.2)
    expect(vehicle.detachedParts()).toContain('mirror_left')
    const after = vehicleColliders(THREE, vehicle, frame)
    expect(after.some((piece) => piece.id === 'mirror_left')).toBe(false)
    expect(after.some((piece) => piece.id === 'mirror_right')).toBe(true)
    expect(after.length).toBeLessThan(before.length)
    expect(before.length - after.length).toBe(before.filter((piece) => piece.id === 'mirror_left').length)
    dispose()
  }, 60000)
  it.each([...fleetVehicleIds])('%s: every collision vertex and triangle of every piece lies within 1 cm of its own drawn surface', (id) => {
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
  }, 240000)

  it('after the first build, a hit on one part costs a few milliseconds of collider work, and only the pieces it touched are made again', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const first = colliders.pieces()
    const again = colliders.pieces()
    expect(again.length).toBe(first.length)
    // nothing changed: the very same pieces
    expect(again.every((piece) => first.includes(piece))).toBe(true)
    const times: number[] = []
    let remade = 0
    let before = again
    for (const [part, direction] of [['door_front_left', [0, 0, -1]], ['door_rear_right', [0, 0, 1]], ['fender_front_left', [0, 0, -1]], ['hood', [0, -1, 0]], ['bumper_front', [-1, 0, 0]], ['roof', [0, -1, 0]], ['lid', [0, -1, 0]], ['door_front_right', [0, 0, 1]]] as const) {
      vehicle.hit({ type: 'ballistic', point: vehicle.partWorldCenter(part), direction: [...direction], energy: 1500, caliber: 9 })
      vehicle.update!(0.1)
      const t0 = performance.now()
      const after = colliders.pieces()
      times.push(performance.now() - t0)
      remade += after.filter((piece) => !before.includes(piece)).length
      before = after
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]!
    console.log(`collider work after a hit, ms: ${times.map((t) => t.toFixed(2)).join(' ')}; median ${median.toFixed(2)}; pieces ${first.length}, remade in total ${remade}`)
    expect(median).toBeLessThanOrEqual(10)
    expect(remade).toBeLessThan(first.length)
    // a blunt 20 kJ blow dents panels over the whole side: many more pieces move, and it is a rare event, so it is only reported
    vehicle.hit({ type: 'blunt', point: vehicle.partWorldCenter('door_front_left'), direction: [0, 0, -1], energy: 20000, radius: 0.3 })
    vehicle.update!(0.1)
    const t1 = performance.now()
    const blow = colliders.pieces()
    console.log(`collider work after a blunt 20 kJ blow, ms: ${(performance.now() - t1).toFixed(2)}; pieces remade ${blow.filter((piece) => !before.includes(piece)).length}`)
    dispose()
  }, 60000)

  it('a crumple moves the pieces with the drawing', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const before = colliders.pieces()
    vehicle.crumple(vehicle.partWorldCenter('bumper_front'), [-1, 0, 0], 0.3)
    const after = colliders.pieces()
    const moved = after.filter((piece) => !before.includes(piece))
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.length).toBeLessThan(before.length)
    dispose()
  }, 60000)

  it('a budget fills the pieces in over several calls and ends with the same ones', () => {
    const { vehicle, frame, dispose } = build('compact_hatch')
    const whole = vehicleColliders(THREE, vehicle, frame)
    const colliders = createVehicleColliders(THREE, vehicle, frame, { budget: 20000 })
    let calls = 0
    let pieces = colliders.pieces()
    calls++
    expect(colliders.isPending()).toBe(true)
    expect(pieces.length).toBeLessThan(whole.length)
    while (colliders.isPending() && calls < 100) {
      pieces = colliders.pieces()
      calls++
    }
    expect(colliders.isPending()).toBe(false)
    expect(calls).toBeGreaterThan(2)
    expect(pieces.map((piece) => piece.key).sort()).toEqual(whole.map((piece) => piece.key).sort())
    dispose()
  }, 60000)
})
