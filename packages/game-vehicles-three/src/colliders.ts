import type * as THREE_NS from 'three'
import type { DrawnCollider } from '@adatechnology/game-contracts'
import type { PartDef, VehicleDestructible } from '@adatechnology/game-vehicles'

import { addTriangle, colliderOf, soupOf } from './collider-fit'
import type { Soup } from './collider-fit'
import { hullOf } from './vehicle-hulls'

/** The parts of the body shell: what is drawn by the vehicle's merged meshes (skin, glass, pillars, a shut door) belongs to the smallest of these whose box holds it. */
const SHELL_ROLES: ReadonlySet<string> = new Set(['panel', 'fender', 'roof', 'frame', 'glass', 'pillar', 'door', 'lid', 'hood', 'bumper'])
/** Statuses of a part that is not on the vehicle any more. */
const GONE: ReadonlySet<string> = new Set(['broken', 'melted', 'ashes'])
/** Parts that are a solid block, not a thin shell: one hull each, whole (design 10.1). */
const SOLID_ROLES: ReadonlySet<string> = new Set(['light', 'mirror', 'engine', 'radiator', 'fuel_tank', 'oil_pan', 'battery', 'alternator', 'gearbox', 'steering', 'hitch'])
/** The wheel and what hangs on it belong to the vehicle constraint, not to the chassis compound: no hull of theirs. */
const WHEEL_ROLES: ReadonlySet<string> = new Set(['rim', 'tyre', 'brakes', 'shocks'])
/** A part's triangles are held in pieces by the cell (m) of the vehicle their centre is in: a dent in one panel makes again the pieces it touched, not the whole panel. */
/** The cross product (twice the area, m2) a triangle needs to be drawn at all. */
const MIN_AREA = 1e-9
const CHUNK = Number(process.env.CHUNK ?? 0.8)
const CELL_BIAS = 512
const CELL_SPAN = 1024
const PART_SPAN = 2 ** 30
/** Triangles of work a call may do (placing triangles in pieces, gathering a piece); what is left waits for the next call. */
const DEFAULT_BUDGET = Infinity

type Three = typeof THREE_NS

export interface VehicleCollidersOptions {
  /** Triangles of work per `pieces()` call: a vehicle that spawns fills in over several calls. Default all at once. */
  readonly budget?: number
  /** Keeps what `hulls()` needs (the triangles of each piece); off by default, the pieces alone need none of it. */
  readonly hulls?: boolean
}

/** A convex hull of drawn vertices (at most 64), in the frame `pieces()` answers in: `id` is the part it belongs to, `key` names it across calls. */
export interface VehicleHull {
  readonly id: string
  readonly key: string
  readonly points: Float32Array
}

export interface VehicleColliders {
  /** The pieces now: only what changed since the last call is made again. */
  pieces(): DrawnCollider[]
  /** Pieces are still to be made (the budget ran out): call `pieces()` again. */
  isPending(): boolean
  /** The convex hulls of what is drawn (design 10.1): one hull of the drawn vertices of each piece (part x cell of 0.8 m), a solid part one hull whole, the wheels none; only the pieces a dent touched are made again. Needs `options.hulls`. */
  hulls(): VehicleHull[]
  /** The drawn vertices (x y z triples, the frame of `pieces()`) a hull of the last `hulls()` call was made from; empty for a hull that is not one of them. */
  drawnPointsOf(hull: VehicleHull): number[]
}

/** One drawn mesh as the cache knows it: where each of its triangles went, and what it looked like when it was last read. */
interface MeshEntry {
  readonly geometry: THREE_NS.BufferGeometry
  readonly owner: string | null
  readonly positions: ArrayLike<number>
  readonly indexArray: ArrayLike<number> | undefined
  readonly triangles: number
  /** The mesh in the frame (column-major) as it was read. */
  matrix: number[]
  version: number
  snapshot: Float32Array
  /** The piece (key) of each triangle; filled by `assigned` triangles, then `chunks` says which triangles each piece has. */
  readonly pieceOf: Float64Array
  assigned: number
  readonly chunks: Map<number, number[]>
}

/** A piece: the triangles of one part in one cell of the vehicle, from one or more meshes, and the collider made of them. */
interface Piece {
  readonly key: number
  readonly part: string
  readonly entries: Set<MeshEntry>
  dirty: boolean
  collider: DrawnCollider | null
  /** The triangles the collider was made from, kept when hulls are wanted; `version` counts how many times they were made. */
  soup: Soup | null
  version: number
  /** The hull of `soup` as of `version`, so a call that finds nothing changed hands back the same object. */
  hull: VehicleHull | null
  hullVersion: number
}

/**
 * Whether `mesh` is a drawn part of the vehicle under `stop` (`c.vehicle`): visibility walks only up to `stop` so `createVehicleLod` hiding the full group to draw the fused
 * copy (`vehicle-lite`) does not drop every collider and force a full rebuild when the car unfuses. Static-batch copies (`noSurfaceRay`) are skipped for the same reason as
 * `surfaceRay`: the parts they copy are already here.
 */
const isDrawn = (mesh: THREE_NS.Mesh, stop: THREE_NS.Object3D): boolean => {
  if (!mesh.isMesh || !mesh.geometry || mesh.userData.ghost || mesh.userData.helper) return false
  if (!mesh.geometry.getAttribute('position')) return false
  for (let node: THREE_NS.Object3D | null = mesh; node; node = node.parent) {
    if (node.visible === false || node.userData.noSurfaceRay) return false
    if (node === stop) break
  }
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

/** A triangle with a corner that is not a number, or with no area (two corners the same, three on a line), is not drawn: nothing to collide with. */
const isNotDrawn = (positions: ArrayLike<number>, [a, b, c]: readonly [number, number, number]): boolean => {
  const ux = (positions[b * 3] as number) - (positions[a * 3] as number), uy = (positions[b * 3 + 1] as number) - (positions[a * 3 + 1] as number), uz = (positions[b * 3 + 2] as number) - (positions[a * 3 + 2] as number)
  const wx = (positions[c * 3] as number) - (positions[a * 3] as number), wy = (positions[c * 3 + 1] as number) - (positions[a * 3 + 1] as number), wz = (positions[c * 3 + 2] as number) - (positions[a * 3 + 2] as number)
  const area = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx)
  return !(area > MIN_AREA)
}

const sameMatrix = (a: readonly number[], b: ArrayLike<number>): boolean => {
  for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * What a vehicle collides with in an engine, as it is drawn: one piece per part that has a mesh of its own (a door, the hood, the lid, a bumper, a wheel, a tyre, a lamp, a
 * mirror), and the rest of what is drawn (the body's merged meshes, the glass, the interior) split by the part of the shell that holds each triangle. A part's triangles are
 * held in pieces by the 40 cm cell of the vehicle they are in; each piece is the box along the drawn vertices where that fits within 1 cm, else its triangles (coarsened, every
 * vertex a drawn one) with the box around them. In the frame `describe()` answers in. A part that broke or came off has none; a mirror is its own piece and never widens the cab.
 *
 * Kept between calls: where each triangle went is worked out once per mesh, and a call finds what moved (a mesh that was posed, vertices a dent pushed) and makes again only
 * the pieces it touched.
 */
export const createVehicleColliders = (THREE: Three, vehicle: VehicleDestructible, frame: THREE_NS.Object3D, options: VehicleCollidersOptions = {}): VehicleColliders => {
  const entries = new Map<THREE_NS.Mesh, MeshEntry>()
  const pieces = new Map<number, Piece>()
  const partIndex = new Map(vehicle.model.parts.map((part, index) => [part.id, index]))
  const isShown = new Map(vehicle.model.parts.map((part) => [part.id, part.visual]))
  const isSolid = new Map(vehicle.model.parts.map((part) => [part.id, SOLID_ROLES.has(part.role)]))
  const isWheel = new Map(vehicle.model.parts.map((part) => [part.id, WHEEL_ROLES.has(part.role)]))
  const shell = vehicle.model.parts.filter((part) => SHELL_ROLES.has(part.role))
  const toFrame = new THREE.Matrix4()
  const toVehicle = new THREE.Matrix4()
  const toShell = new THREE.Matrix4()
  const placed = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  let pending = false
  let shown: Piece[] = []
  let hullSources = new Map<VehicleHull, readonly Piece[]>()
  const hullGroups = new Map<string, { readonly signature: string; readonly hulls: VehicleHull[] }>()

  const release = (entry: MeshEntry): void => {
    for (const key of entry.chunks.keys()) {
      const piece = pieces.get(key)
      if (!piece) continue
      piece.entries.delete(entry)
      piece.dirty = true
    }
  }

  const touch = (entry: MeshEntry, only?: Set<number>): void => {
    for (const key of entry.chunks.keys()) if (!only || only.has(key)) {
      const piece = pieces.get(key)
      if (piece) piece.dirty = true
    }
  }

  /** Places the next triangles of the mesh in the pieces of its parts; false when the budget ran out first. */
  const assign = (mesh: THREE_NS.Mesh, entry: MeshEntry, budget: { left: number }): boolean => {
    toShell.multiplyMatrices(toVehicle, mesh.matrixWorld)
    const positions = entry.positions
    const index = entry.indexArray
    const owner = entry.owner
    const e = toShell.elements
    for (; entry.assigned < entry.triangles && budget.left > 0; entry.assigned++, budget.left--) {
      const t = entry.assigned * 3
      const a = index ? (index[t] as number) : t, b = index ? (index[t + 1] as number) : t + 1, c = index ? (index[t + 2] as number) : t + 2
      placed.set(
        ((positions[a * 3] as number) + (positions[b * 3] as number) + (positions[c * 3] as number)) / 3,
        ((positions[a * 3 + 1] as number) + (positions[b * 3 + 1] as number) + (positions[c * 3 + 1] as number)) / 3,
        ((positions[a * 3 + 2] as number) + (positions[b * 3 + 2] as number) + (positions[c * 3 + 2] as number)) / 3,
      )
      const x = e[0]! * placed.x + e[4]! * placed.y + e[8]! * placed.z + e[12]!
      const y = e[1]! * placed.x + e[5]! * placed.y + e[9]! * placed.z + e[13]!
      const z = e[2]! * placed.x + e[6]! * placed.y + e[10]! * placed.z + e[14]!
      const part = owner ?? shellPartAt(shell, vehicle.model.hub, x, y, z)
      const cell = ((Math.floor(x / CHUNK) + CELL_BIAS) * CELL_SPAN + (Math.floor(y / CHUNK) + CELL_BIAS)) * CELL_SPAN + (Math.floor(z / CHUNK) + CELL_BIAS)
      entry.pieceOf[entry.assigned] = (partIndex.get(part) ?? 0) * PART_SPAN + cell
    }
    if (entry.assigned < entry.triangles) return false
    for (let t = 0; t < entry.triangles; t++) {
      const key = entry.pieceOf[t] as number
      let list = entry.chunks.get(key)
      if (!list) entry.chunks.set(key, (list = []))
      list.push(t)
    }
    for (const key of entry.chunks.keys()) {
      let piece = pieces.get(key)
      if (!piece) {
        const part = vehicle.model.parts[Math.floor(key / PART_SPAN)]!.id
        pieces.set(key, (piece = { key, part, entries: new Set(), dirty: true, collider: null, soup: null, version: 0, hull: null, hullVersion: -1 }))
      }
      piece.entries.add(entry)
      piece.dirty = true
    }
    entry.snapshot = new Float32Array(positions)
    return true
  }

  /** What a dent changed: the pieces holding a triangle with a vertex that moved. */
  const follow = (entry: MeshEntry, position: THREE_NS.BufferAttribute | THREE_NS.InterleavedBufferAttribute): void => {
    const array = entry.positions
    const moved = new Set<number>()
    const changed = new Uint8Array(array.length / 3)
    for (let i = 0; i < array.length; i++) {
      if (array[i] === entry.snapshot[i]) continue
      changed[Math.floor(i / 3)] = 1
      entry.snapshot[i] = array[i] as number
    }
    const index = entry.indexArray
    for (let t = 0; t < entry.triangles; t++) {
      const a = index ? (index[t * 3] as number) : t * 3, b = index ? (index[t * 3 + 1] as number) : t * 3 + 1, c = index ? (index[t * 3 + 2] as number) : t * 3 + 2
      if (changed[a] || changed[b] || changed[c]) moved.add(entry.pieceOf[t] as number)
    }
    entry.version = (position as THREE_NS.BufferAttribute).version
    touch(entry, moved)
  }

  const read = (mesh: THREE_NS.Mesh, owner: string | null, budget: { left: number }): void => {
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    const indexAttribute = geometry.getIndex()
    const triangles = Math.floor((indexAttribute ? indexAttribute.count : position.count) / 3)
    matrix.multiplyMatrices(toFrame, mesh.matrixWorld)
    let entry = entries.get(mesh)
    if (entry && (entry.geometry !== geometry || entry.owner !== owner || entry.positions !== position.array || entry.indexArray !== indexAttribute?.array || entry.triangles !== triangles)) {
      release(entry)
      entries.delete(mesh)
      entry = undefined
    }
    if (!entry) {
      entry = { geometry, owner, positions: position.array, indexArray: indexAttribute?.array, triangles, matrix: [...matrix.elements], version: (position as THREE_NS.BufferAttribute).version, snapshot: new Float32Array(0), pieceOf: new Float64Array(triangles), assigned: 0, chunks: new Map() }
      entries.set(mesh, entry)
    }
    if (entry.assigned < entry.triangles) {
      if (!assign(mesh, entry, budget)) pending = true
      return
    }
    if (!sameMatrix(entry.matrix, matrix.elements)) {
      entry.matrix = [...matrix.elements]
      touch(entry)
    }
    if ((position as THREE_NS.BufferAttribute).version !== entry.version) follow(entry, position)
  }

  const rebuild = (piece: Piece, budget: { left: number }): void => {
    const soup = soupOf()
    for (const entry of piece.entries) {
      for (const t of entry.chunks.get(piece.key) ?? []) {
        const index = entry.indexArray
        budget.left--
        const corners: [number, number, number] = index ? [index[t * 3] as number, index[t * 3 + 1] as number, index[t * 3 + 2] as number] : [t * 3, t * 3 + 1, t * 3 + 2]
        if (isNotDrawn(entry.positions, corners)) continue
        addTriangle(soup, entry, entry.positions, corners, entry.matrix)
      }
    }
    piece.collider = colliderOf(piece.part, `${piece.part}#${piece.key % PART_SPAN}`, soup)
    piece.soup = options.hulls ? soup : null
    piece.version++
    piece.dirty = false
  }

  const make = (): DrawnCollider[] => {
    // `vehicle.vehicle` is replaced on `reset()`: reading it each call follows the live vehicle instead of the disposed one
    const root = vehicle.vehicle.vehicle as THREE_NS.Object3D
    frame.updateWorldMatrix(true, true)
    root.updateWorldMatrix(true, true)
    toFrame.copy(frame.matrixWorld).invert()
    toVehicle.copy(root.matrixWorld).invert()
    const state = new Map(vehicle.state().parts.map((part) => [part.id, part]))
    const isGone = (id: string): boolean => {
      const part = state.get(id)
      return part !== undefined && (GONE.has(part.status) || part.group !== 0)
    }
    const budget = { left: options.budget ?? DEFAULT_BUDGET }
    pending = false
    const live = new Map<THREE_NS.Mesh, string | null>()
    const claimed = new Set<THREE_NS.Mesh>()
    for (const part of vehicle.model.parts) {
      for (const object of vehicle.objectsOf(part.id)) {
        object.traverse((node) => {
          const mesh = node as THREE_NS.Mesh
          if (claimed.has(mesh)) return
          claimed.add(mesh)
          if (!isGone(part.id) && isDrawn(mesh, root)) live.set(mesh, part.id)
        })
      }
    }
    root.traverse((node) => {
      const mesh = node as THREE_NS.Mesh
      if (!claimed.has(mesh) && isDrawn(mesh, root)) live.set(mesh, null)
    })
    for (const [mesh, entry] of entries) {
      if (live.has(mesh)) continue
      release(entry)
      entries.delete(mesh)
    }
    for (const [mesh, owner] of live) read(mesh, owner, budget)
    const out: DrawnCollider[] = []
    shown = []
    for (const [key, piece] of pieces) {
      if (piece.entries.size === 0) {
        pieces.delete(key)
        continue
      }
      if (piece.dirty) {
        if (budget.left <= 0) pending = true
        else rebuild(piece, budget)
      }
      if (piece.collider && !(isGone(piece.part) && isShown.get(piece.part))) {
        out.push(piece.collider)
        shown.push(piece)
      }
    }
    return out
  }

  /** The hull of one piece, made again only when the piece was. */
  const hullOfPiece = (piece: Piece): VehicleHull | null => {
    if (piece.hullVersion !== piece.version) {
      const points = hullOf(piece.soup!)
      piece.hull = points ? { id: piece.part, key: `${piece.part}#${piece.key % PART_SPAN}`, points: new Float32Array(points) } : null
      piece.hullVersion = piece.version
    }
    return piece.hull
  }

  /** The one hull of a solid part: its pieces' triangles together. */
  const hullOfSolid = (part: string, members: readonly Piece[]): VehicleHull[] => {
    const signature = members.map((piece) => `${piece.key}.${piece.version}`).join(',')
    let made = hullGroups.get(part)
    if (!made || made.signature !== signature) {
      const vertices: number[] = []
      const indices: number[] = []
      for (const piece of members) {
        const offset = vertices.length / 3
        for (const v of piece.soup!.vertices) vertices.push(v)
        for (const i of piece.soup!.indices) indices.push(i + offset)
      }
      const points = hullOf({ vertices, indices })
      made = { signature, hulls: points ? [{ id: part, key: part, points: new Float32Array(points) }] : [] }
      hullGroups.set(part, made)
    }
    return made.hulls
  }

  const hulls = (): VehicleHull[] => {
    if (!options.hulls) throw new Error('createVehicleColliders: hulls() needs options.hulls')
    make()
    hullSources = new Map()
    const out: VehicleHull[] = []
    const solids = new Map<string, Piece[]>()
    for (const piece of shown) {
      if (!piece.soup || isWheel.get(piece.part)) continue
      if (!isSolid.get(piece.part)) {
        const hull = hullOfPiece(piece)
        if (!hull) continue
        out.push(hull)
        hullSources.set(hull, [piece])
        continue
      }
      const list = solids.get(piece.part)
      if (list) list.push(piece)
      else solids.set(piece.part, [piece])
    }
    for (const id of hullGroups.keys()) if (!solids.has(id)) hullGroups.delete(id)
    for (const [part, members] of solids) {
      for (const hull of hullOfSolid(part, members)) {
        out.push(hull)
        hullSources.set(hull, members)
      }
    }
    return out
  }

  const drawnPointsOf = (hull: VehicleHull): number[] => (hullSources.get(hull) ?? []).flatMap((piece) => piece.soup?.vertices ?? [])

  return { pieces: make, isPending: () => pending, hulls, drawnPointsOf }
}

/** The pieces of a vehicle once, all at once (`createVehicleColliders` keeps them between calls). */
export const vehicleColliders = (THREE: Three, vehicle: VehicleDestructible, frame: THREE_NS.Object3D): DrawnCollider[] => createVehicleColliders(THREE, vehicle, frame).pieces()

/** The convex hulls of a vehicle once, all at once (`createVehicleColliders` with `hulls` keeps them between calls). */
export const vehicleHulls = (THREE: Three, vehicle: VehicleDestructible, frame: THREE_NS.Object3D): VehicleHull[] => createVehicleColliders(THREE, vehicle, frame, { hulls: true }).hulls()
