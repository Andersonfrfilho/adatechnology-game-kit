import type * as THREE_NS from 'three'
import type { DrawnCollider } from '@adatechnology/game-contracts'
import { fitOrientedBox, hugs } from '@adatechnology/game-shapes'
import type { PartDef, VehicleDestructible } from '@adatechnology/game-vehicles'

/** A box fits a drawn piece when each of its eight corners has a vertex within this (m): the same rule as the fixed things of `game-destruction-three`. */
const FIT = 0.01
/** The thinnest half (m) a drawn plane (a sheet with no thickness) is held by. */
const MIN_HALF = 0.005
/** A drawn piece with more triangles than this is held by a coarser mesh: the cars draw up to 50 000 triangles a panel to take cuts, and an engine collides with a surface, not with a tessellation. */
const COARSEN_ABOVE = 1500
/** The cell (m) the vertices of a coarsened piece are merged in: the surface moves by at most half of it, and the box of the piece stays the one of the drawn vertices. */
const COARSE_CELL = 0.05
const IDENTITY_AXES = [1, 0, 0, 0, 1, 0, 0, 0, 1]
/** Statuses of a part that is not on the vehicle any more. */
const GONE: ReadonlySet<string> = new Set(['broken', 'melted', 'ashes'])
/** The parts of the body shell: what is drawn by the vehicle's merged meshes (skin, glass, pillars, a shut door) belongs to the smallest of these whose box holds it. */
const SHELL_ROLES: ReadonlySet<string> = new Set(['panel', 'fender', 'roof', 'frame', 'glass', 'pillar', 'door', 'lid', 'hood', 'bumper'])

type Three = typeof THREE_NS

/** A drawn piece in the making: the triangles of its meshes in the vehicle's frame. */
interface Soup {
  readonly vertices: number[]
  readonly indices: number[]
  /** Where each vertex of a source mesh went in `vertices`, so a vertex the triangles share is kept once. */
  readonly placed: Map<ArrayLike<number>, Map<number, number>>
}

const soupOf = (): Soup => ({ vertices: [], indices: [], placed: new Map() })

/** Adds one triangle of a mesh (its `positions`, the three vertex numbers) to the soup, moved by `matrix` (column-major, as three.js holds it). */
const addTriangle = (soup: Soup, positions: ArrayLike<number>, corners: readonly [number, number, number], matrix: ArrayLike<number>): void => {
  let placed = soup.placed.get(positions)
  if (!placed) soup.placed.set(positions, (placed = new Map()))
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

/** The soup with the vertices of each `cell` merged into their mean, and the triangles that collapsed or repeat left out. */
const coarsen = (soup: Soup, cell: number): Soup => {
  const cells = new Map<string, number>()
  const sums: number[] = []
  const counts: number[] = []
  const to = new Uint32Array(soup.vertices.length / 3)
  for (let i = 0; i < to.length; i++) {
    const x = soup.vertices[i * 3] as number, y = soup.vertices[i * 3 + 1] as number, z = soup.vertices[i * 3 + 2] as number
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
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
  const vertices = sums.map((sum, k) => sum / (counts[Math.floor(k / 3)] as number))
  const indices: number[] = []
  const seen = new Set<string>()
  for (let i = 0; i + 2 < soup.indices.length; i += 3) {
    const a = to[soup.indices[i] as number] as number, b = to[soup.indices[i + 1] as number] as number, c = to[soup.indices[i + 2] as number] as number
    if (a === b || b === c || a === c) continue
    const key = [a, b, c].sort((p, q) => p - q).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    indices.push(a, b, c)
  }
  return { vertices, indices, placed: new Map() }
}

/** The box that holds the soup: axis-aligned in the frame where that fits, else along its principal axes where that fits, else the triangles with the box around them. */
const colliderOf = (id: string, soup: Soup): DrawnCollider | null => {
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
  if (hugs(points, { center, half, axes: IDENTITY_AXES, tolerance: [FIT, FIT, FIT] })) return { id, center, half: half.map((h) => Math.max(MIN_HALF, h)) as [number, number, number], rotation: [0, 0, 0, 1] }
  const turned = fitOrientedBox(points)
  if (turned && hugs(points, { center: turned.center, half: turned.half, axes: axesOf(turned.rotation), tolerance: [FIT, FIT, FIT] })) return { id, ...turned }
  const held = soup.indices.length / 3 > COARSEN_ABOVE ? coarsen(soup, COARSE_CELL) : soup
  const kept = held.indices.length >= 36 ? held : soup
  return { id, center, half: half.map((h) => Math.max(MIN_HALF, h)) as [number, number, number], rotation: [0, 0, 0, 1], mesh: { vertices: new Float32Array(kept.vertices), indices: new Uint32Array(kept.indices) } }
}

/** The axes (three rows of 3) of a box turned by the quaternion. */
const axesOf = ([x, y, z, w]: readonly [number, number, number, number]): number[] => [
  1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
  2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
  2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
]

const isDrawn = (mesh: THREE_NS.Mesh): boolean => {
  if (!mesh.isMesh || !mesh.geometry || mesh.userData.ghost || mesh.userData.helper) return false
  if (!mesh.geometry.getAttribute('position')) return false
  for (let node: THREE_NS.Object3D | null = mesh; node; node = node.parent) if (node.visible === false) return false
  return true
}

/** The part of the shell whose box holds the point (vehicle space), the smallest first; the hub when none does. */
const shellPartAt = (shell: readonly PartDef[], hub: string, x: number, y: number, z: number): string => {
  let best = hub
  let bestVolume = Infinity
  for (const part of shell) {
    const { center, size } = part.box
    if (Math.abs(x - center[0]) > size[0] / 2 || Math.abs(y - center[1]) > size[1] / 2 || Math.abs(z - center[2]) > size[2] / 2) continue
    const volume = size[0] * size[1] * size[2]
    if (volume < bestVolume) [best, bestVolume] = [part.id, volume]
  }
  return best
}

/**
 * What a vehicle collides with in an engine, as it is drawn: one piece per part that has a mesh of its own (a door, the hood, the lid, a bumper, a wheel, a tyre, a lamp, a
 * mirror), and the rest of what is drawn (the body's merged meshes, the glass, the interior) split by the part of the shell that holds each triangle. Each piece is the
 * box along the drawn vertices where that fits within 1 cm, else its triangles with the box around them. In the frame `describe()` answers in; the same drawing gives the same
 * pieces. A part that broke or came off has none; a mirror is its own piece and never widens the cab.
 */
export const vehicleColliders = (THREE: Three, vehicle: VehicleDestructible, frame: THREE_NS.Object3D): DrawnCollider[] => {
  frame.updateWorldMatrix(true, true)
  const root = vehicle.vehicle.vehicle as THREE_NS.Object3D
  root.updateWorldMatrix(true, true)
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const toVehicle = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const state = new Map(vehicle.state().parts.map((part) => [part.id, part]))
  const isGone = (id: string): boolean => {
    const part = state.get(id)
    return part !== undefined && (GONE.has(part.status) || part.group !== 0)
  }
  const soups = new Map<string, Soup>()
  const soupFor = (id: string): Soup => {
    let soup = soups.get(id)
    if (!soup) soups.set(id, (soup = soupOf()))
    return soup
  }
  const owned = new Set<THREE_NS.Mesh>()
  const matrix = new THREE.Matrix4()
  for (const part of vehicle.model.parts) {
    for (const object of vehicle.objectsOf(part.id)) {
      object.traverse((node) => {
        const mesh = node as THREE_NS.Mesh
        if (owned.has(mesh)) return
        owned.add(mesh)
        if (isGone(part.id) || !isDrawn(mesh)) return
        mesh.updateWorldMatrix(true, false)
        matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
        addMesh(soupFor(part.id), mesh, matrix.elements)
      })
    }
  }
  const shell = vehicle.model.parts.filter((part) => SHELL_ROLES.has(part.role))
  const toShell = new THREE.Matrix4()
  const centroid = new THREE.Vector3()
  const isShown = new Map(vehicle.model.parts.map((part) => [part.id, part.visual]))
  root.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    if (owned.has(mesh) || !isDrawn(mesh)) return
    mesh.updateWorldMatrix(true, false)
    matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
    toShell.multiplyMatrices(toVehicle, mesh.matrixWorld)
    const positions = mesh.geometry.getAttribute('position').array
    const index = mesh.geometry.getIndex()?.array
    const count = index ? index.length : positions.length / 3
    for (let i = 0; i + 2 < count; i += 3) {
      const corners: [number, number, number] = index ? [index[i] as number, index[i + 1] as number, index[i + 2] as number] : [i, i + 1, i + 2]
      const [a, b, c] = corners
      centroid.set(
        ((positions[a * 3] as number) + (positions[b * 3] as number) + (positions[c * 3] as number)) / 3,
        ((positions[a * 3 + 1] as number) + (positions[b * 3 + 1] as number) + (positions[c * 3 + 1] as number)) / 3,
        ((positions[a * 3 + 2] as number) + (positions[b * 3 + 2] as number) + (positions[c * 3 + 2] as number)) / 3,
      ).applyMatrix4(toShell)
      const id = shellPartAt(shell, vehicle.model.hub, centroid.x, centroid.y, centroid.z)
      if (isGone(id) && isShown.get(id)) continue
      addTriangle(soupFor(id), positions, corners, matrix.elements)
    }
  })
  const out: DrawnCollider[] = []
  for (const [id, soup] of soups) {
    const collider = colliderOf(id, soup)
    if (collider) out.push(collider)
  }
  return out
}

const addMesh = (soup: Soup, mesh: THREE_NS.Mesh, matrix: ArrayLike<number>): void => {
  const positions = mesh.geometry.getAttribute('position').array
  const index = mesh.geometry.getIndex()?.array
  const count = index ? index.length : positions.length / 3
  for (let i = 0; i + 2 < count; i += 3) addTriangle(soup, positions, index ? [index[i] as number, index[i + 1] as number, index[i + 2] as number] : [i, i + 1, i + 2], matrix)
}
