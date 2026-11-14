import { buildVehicleItem, createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { vehicleColliders } from '../src'
import { fakeDocument } from './fake-dom'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const kit = createVehicleKit({ THREE, document: fakeDocument })
installFleet(kit)

/** What the piece may reach past its own mesh (m). */
const REACH = 0.01
const SAMPLE = 3000

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
        for (const corner of cornersOf(piece)) expect(nearest(corner, reference), `${id}: ${piece.id} corner is air`).toBeLessThanOrEqual(REACH * Math.sqrt(3) + 1e-6)
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
    expect(mirrors.length).toBe(2)
    const body = vehicle.model.parts.filter((part) => /^(roof|underbody|pillar_a_left)$/.test(part.id)).map((part) => pieces.find((piece) => piece.id === part.id)).filter((piece) => piece !== undefined) as Piece[]
    expect(body.length).toBeGreaterThan(0)
    const outermost = (piece: Piece): number => Math.max(...cornersOf(piece).map((corner) => Math.abs(corner.x)))
    for (const mirror of mirrors) for (const piece of body) expect(outermost(piece)).toBeLessThan(outermost(mirror))
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
    expect(after.length).toBe(before.length - 1)
    dispose()
  }, 60000)
})
