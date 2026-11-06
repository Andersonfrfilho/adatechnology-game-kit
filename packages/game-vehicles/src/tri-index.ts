/** Boxes of the triangles of a geometry, grouped in blocks, so a region query visits the few triangles near it instead of every one. */
import type { Box3, BufferAttribute, BufferGeometry, Intersection, InterleavedBufferAttribute, Material, Matrix4, Mesh, Object3D, Ray, Raycaster, Sphere, THREE_NS, Vector3 } from './three-types'

type Three = typeof THREE_NS

export const TRI_BLOCK = 32

export type TriIndex = {
  position: BufferAttribute | InterleavedBufferAttribute
  positionVersion: number
  index: BufferAttribute | null
  indexVersion: number
  triangles: number
  /** min x, y, z and max x, y, z of each triangle (exact: the same values the vertices hold) */
  boxes: Float64Array
  /** the same for each block of `TRI_BLOCK` triangles */
  blocks: Float64Array
  builtBlocks: number
}

const cache = new WeakMap<object, TriIndex>()

function trianglesOf(geo: BufferGeometry): number {
  return Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3)
}
function supports(geo: BufferGeometry): boolean {
  const pos = geo.attributes && geo.attributes.position
  return !!pos && !(pos as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute && pos.itemSize === 3
}
function isCurrent(geo: BufferGeometry, ti: TriIndex): boolean {
  const pos = geo.attributes.position
  return (
    ti.position === pos &&
    ti.positionVersion === (pos as BufferAttribute).version &&
    ti.index === (geo.index || null) &&
    ti.indexVersion === (geo.index ? geo.index.version : 0) &&
    ti.triangles === trianglesOf(geo)
  )
}
function blockCount(triangles: number): number {
  return Math.ceil(triangles / TRI_BLOCK)
}
function boxBlock(ti: TriIndex, block: number): void {
  const B = ti.boxes
  const t0 = block * TRI_BLOCK
  const t1 = Math.min(ti.triangles, t0 + TRI_BLOCK)
  const o = block * 6
  for (let k = 0; k < 3; k++) {
    ti.blocks[o + k] = Infinity
    ti.blocks[o + 3 + k] = -Infinity
  }
  for (let t = t0; t < t1; t++) {
    const j = t * 6
    for (let k = 0; k < 3; k++) {
      if (B[j + k]! < ti.blocks[o + k]!) ti.blocks[o + k] = B[j + k]!
      if (B[j + 3 + k]! > ti.blocks[o + 3 + k]!) ti.blocks[o + 3 + k] = B[j + 3 + k]!
    }
  }
}
function boxTriangle(geo: BufferGeometry, ti: TriIndex, t: number): void {
  const P = geo.attributes.position.array
  const ix = geo.index ? geo.index.array : null
  const a = (ix ? ix[t * 3] : t * 3) * 3
  const b = (ix ? ix[t * 3 + 1] : t * 3 + 1) * 3
  const c = (ix ? ix[t * 3 + 2] : t * 3 + 2) * 3
  const j = t * 6
  for (let k = 0; k < 3; k++) {
    ti.boxes[j + k] = Math.min(P[a + k], P[b + k], P[c + k])
    ti.boxes[j + 3 + k] = Math.max(P[a + k], P[b + k], P[c + k])
  }
}
function advance(geo: BufferGeometry, ti: TriIndex, deadline: number): boolean {
  const total = blockCount(ti.triangles)
  while (ti.builtBlocks < total) {
    const block = ti.builtBlocks
    const t1 = Math.min(ti.triangles, (block + 1) * TRI_BLOCK)
    for (let t = block * TRI_BLOCK; t < t1; t++) boxTriangle(geo, ti, t)
    boxBlock(ti, block)
    ti.builtBlocks++
    if (deadline !== Infinity && performance.now() >= deadline) break
  }
  return ti.builtBlocks === total
}
function start(geo: BufferGeometry, store: WeakMap<object, TriIndex> = cache): TriIndex {
  const pos = geo.attributes.position
  const triangles = trianglesOf(geo)
  const ti: TriIndex = {
    position: pos,
    positionVersion: (pos as BufferAttribute).version,
    index: geo.index || null,
    indexVersion: geo.index ? geo.index.version : 0,
    triangles,
    boxes: new Float64Array(triangles * 6),
    blocks: new Float64Array(blockCount(triangles) * 6),
    builtBlocks: 0,
  }
  store.set(geo, ti)
  return ti
}

/** The index of a geometry (built now if it is not there or the positions changed), or undefined for a layout it does not cover. */
export function triIndexOf(geo: BufferGeometry): TriIndex | undefined {
  if (!supports(geo)) return undefined
  let ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti)) ti = start(geo)
  advance(geo, ti, Infinity)
  return ti
}

/** Builds the index of a geometry a slice at a time; true once it is complete and current. */
export function warmTriIndex(geo: BufferGeometry, deadline: number): boolean {
  if (!supports(geo)) return true
  let ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti)) ti = start(geo)
  return advance(geo, ti, deadline)
}

/** Keeps the index of the result of a cut: `boxes` are the boxes of its triangles in order. */
export function storeTriIndex(geo: BufferGeometry, boxes: Float64Array): void {
  const ti = start(geo)
  ti.boxes = boxes
  const total = blockCount(ti.triangles)
  for (let b = 0; b < total; b++) boxBlock(ti, b)
  ti.builtBlocks = total
}

/** Before moving vertices of a non-indexed geometry: its index when it is complete and current (pass it to `touchTriIndex` after). */
export function liveTriIndex(geo: BufferGeometry): TriIndex | undefined {
  if (geo.index || !supports(geo)) return undefined
  const ti = cache.get(geo)
  return ti && isCurrent(geo, ti) && ti.builtBlocks === blockCount(ti.triangles) ? ti : undefined
}

/** After moving `vertices` of a non-indexed geometry and flagging its positions: only their triangles are measured again. */
export function touchTriIndex(geo: BufferGeometry, ti: TriIndex, vertices: number[]): void {
  if (ti.positionVersion + 1 !== (geo.attributes.position as BufferAttribute).version) return
  const blocks = new Set<number>()
  for (const v of vertices) {
    const t = Math.floor(v / 3)
    if (t >= ti.triangles) continue
    boxTriangle(geo, ti, t)
    blocks.add(Math.floor(t / TRI_BLOCK))
  }
  blocks.forEach((b) => boxBlock(ti, b))
  ti.positionVersion = (geo.attributes.position as BufferAttribute).version
}

/** The box of every vertex of a non-indexed geometry from its complete, current index (one pass over the blocks); undefined when it cannot be taken from there. */
export function boundsFromIndex(geo: BufferGeometry): { box: Float64Array; version: number } | undefined {
  if (geo.index || !supports(geo)) return undefined
  const ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti) || ti.builtBlocks !== blockCount(ti.triangles) || !ti.triangles || geo.attributes.position.count !== ti.triangles * 3) return undefined
  const box = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
  for (let b = 0, n = blockCount(ti.triangles); b < n; b++)
    for (let k = 0; k < 3; k++) {
      box[k] = Math.min(box[k]!, ti.blocks[b * 6 + k]!)
      box[3 + k] = Math.max(box[3 + k]!, ti.blocks[b * 6 + 3 + k]!)
    }
  return { box, version: ti.positionVersion }
}

/**
 * The rays keep their own indexes: an index in the shared cache changes the path the cut, the dent and the bounds take (`liveTriIndex`,
 * `boundsFromIndex`), and a ray must not change what the vehicle looks like.
 */
const rayCache = new WeakMap<object, TriIndex>()
function rayIndexOf(geo: BufferGeometry): TriIndex | undefined {
  const shared = cache.get(geo)
  if (shared && isCurrent(geo, shared) && shared.builtBlocks === blockCount(shared.triangles)) return shared
  let ti = rayCache.get(geo)
  if (!ti || !isCurrent(geo, ti)) ti = start(geo, rayCache)
  advance(geo, ti, Infinity)
  return ti
}

/** One hit of `raycastIndexed`: the fields of a three.js intersection the vehicle code reads. */
export type IndexedHit = {
  distance: number
  point: Vector3
  object: Object3D
  face: { a: number; b: number; c: number; normal: Vector3; materialIndex: number }
  faceIndex: number
}

/** Slack on a block's box, metres: a hit on its very edge is not lost to rounding. */
const BLOCK_SLACK = 1e-6

type RayScratch = { inverse: Matrix4; local: Ray; box: Box3; a: Vector3; b: Vector3; c: Vector3; point: Vector3; world: Vector3; sphere: Sphere }
const scratch = new WeakMap<object, RayScratch>()
function scratchOf(THREE: Three): RayScratch {
  let s = scratch.get(THREE)
  if (!s) {
    s = {
      inverse: new THREE.Matrix4(),
      local: new THREE.Ray(),
      box: new THREE.Box3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      point: new THREE.Vector3(),
      world: new THREE.Vector3(),
      sphere: new THREE.Sphere(),
    }
    scratch.set(THREE, s)
  }
  return s
}

/** The meshes `Mesh.raycast` of three.js would answer the same way as the index: its own raycast, one material, positions only, no skin or morph. */
function indexable(THREE: Three, object: Object3D): boolean {
  const mesh = object as Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean; isBatchedMesh?: boolean }
  const geo = mesh.geometry
  // a mesh with a raycast of its own (a decal that rays pass through) answers for itself
  if (mesh.raycast !== THREE.Mesh.prototype.raycast) return false
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh || !geo || !geo.isBufferGeometry) return false
  if (!mesh.material || Array.isArray(mesh.material)) return false
  if (geo.morphAttributes && geo.morphAttributes.position && geo.morphAttributes.position.length) return false
  return supports(geo)
}

function raycastMesh(THREE: Three, raycaster: Raycaster, mesh: Mesh, out: IndexedHit[]): void {
  const geo = mesh.geometry
  const s = scratchOf(THREE)
  if (geo.boundingSphere === null) geo.computeBoundingSphere()
  s.sphere.copy(geo.boundingSphere!).applyMatrix4(mesh.matrixWorld)
  if (!raycaster.ray.intersectsSphere(s.sphere)) return
  const ti = rayIndexOf(geo)
  if (!ti) return
  s.inverse.copy(mesh.matrixWorld).invert()
  s.local.copy(raycaster.ray).applyMatrix4(s.inverse)
  const material = mesh.material as Material
  const back = material.side === THREE.BackSide
  const cull = material.side === THREE.FrontSide
  const P = geo.attributes.position
  const ix = geo.index
  const count = ix ? ix.count : P.count
  const first = Math.max(0, geo.drawRange.start)
  const last = Math.min(count, geo.drawRange.start + geo.drawRange.count)
  const t0 = Math.ceil(first / 3)
  const t1 = Math.floor(last / 3)
  const B = ti.boxes
  const K = ti.blocks
  for (let blk = Math.floor(t0 / TRI_BLOCK); blk * TRI_BLOCK < t1; blk++) {
    const o = blk * 6
    s.box.min.set(K[o]! - BLOCK_SLACK, K[o + 1]! - BLOCK_SLACK, K[o + 2]! - BLOCK_SLACK)
    s.box.max.set(K[o + 3]! + BLOCK_SLACK, K[o + 4]! + BLOCK_SLACK, K[o + 5]! + BLOCK_SLACK)
    if (!s.local.intersectsBox(s.box)) continue
    const end = Math.min(t1, (blk + 1) * TRI_BLOCK)
    for (let t = Math.max(t0, blk * TRI_BLOCK); t < end; t++) {
      const j = t * 6
      s.box.min.set(B[j]! - BLOCK_SLACK, B[j + 1]! - BLOCK_SLACK, B[j + 2]! - BLOCK_SLACK)
      s.box.max.set(B[j + 3]! + BLOCK_SLACK, B[j + 4]! + BLOCK_SLACK, B[j + 5]! + BLOCK_SLACK)
      if (!s.local.intersectsBox(s.box)) continue
      const a = ix ? ix.getX(t * 3) : t * 3
      const b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1
      const c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2
      s.a.fromBufferAttribute(P, a)
      s.b.fromBufferAttribute(P, b)
      s.c.fromBufferAttribute(P, c)
      // the same triangle test and order as Mesh.raycast of three.js
      const hit = back ? s.local.intersectTriangle(s.c, s.b, s.a, true, s.point) : s.local.intersectTriangle(s.a, s.b, s.c, cull, s.point)
      if (hit === null) continue
      s.world.copy(s.point).applyMatrix4(mesh.matrixWorld)
      const distance = raycaster.ray.origin.distanceTo(s.world)
      if (distance < raycaster.near || distance > raycaster.far) continue
      const normal = new THREE.Vector3()
      THREE.Triangle.getNormal(s.a, s.b, s.c, normal)
      out.push({ distance, point: s.world.clone(), object: mesh, face: { a, b, c, normal, materialIndex: 0 }, faceIndex: Math.floor(t) })
    }
  }
}

function collect(THREE: Three, raycaster: Raycaster, object: Object3D, recursive: boolean, out: IndexedHit[]): void {
  if (object.layers.test(raycaster.layers)) {
    if (indexable(THREE, object)) raycastMesh(THREE, raycaster, object as Mesh, out)
    // three.js adds its own intersections (a sprite's has no face)
    else object.raycast(raycaster, out as unknown as Intersection[])
  }
  if (recursive) for (const child of object.children) collect(THREE, raycaster, child, true, out)
}

/**
 * `raycaster.intersectObjects(objects, recursive)` of three.js, answered through the triangle index of each mesh: the ray visits the blocks and
 * triangles whose box it crosses instead of every triangle of a heavy body, with the same triangle test, so the hits are the same.
 * Meshes the index does not cover (skinned, morphed, several materials) and other objects go through their own `raycast`.
 */
export function raycastIndexed(THREE: Three, raycaster: Raycaster, objects: readonly Object3D[], recursive = false): IndexedHit[] {
  const out: IndexedHit[] = []
  for (const object of objects) collect(THREE, raycaster, object, recursive, out)
  out.sort((x, y) => x.distance - y.distance)
  return out
}
