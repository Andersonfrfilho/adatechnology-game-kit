import type { MeshData, PartKind, Vec3, Placement, PlantMesh, PlantSpec, GenerateOptions } from '../types'
import type { Lot } from '../lot'
import { extractPlant, hideLotPlant } from '../lot'
import { generate } from '../generate'
import type { ThreeNS, VegetationMaterials } from './types'
import { createVegetationMaterials } from './materials'
import { materialKeyForPart, resolveMaterialIds, type MaterialIds } from '../destruction'
import type { Condition } from '../types'

import type { BufferGeometry as Geo } from 'three'
type Obj = InstanceType<ThreeNS['Object3D']>

const PART_ORDER: PartKind[] = ['wood', 'foliage', 'flowers', 'fruit', 'spines']

/** MeshData -> BufferGeometry with attributes position, normal, color, sway. */
export function toBufferGeometry(THREE: ThreeNS, mesh: MeshData): Geo {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3))
  g.setAttribute('sway', new THREE.BufferAttribute(mesh.sway, 1))
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

function inflate(g: Geo, m: number): void {
  // wind and bend move vertices a little outside the static bounds: keep culling safe
  if (g.boundingSphere) g.boundingSphere.radius += m
}

export interface DestructionOptions {
  /** override any destruction material id (merged over the materials' own mapping, then DEFAULT_MATERIAL_IDS) */
  materialIds?: Partial<MaterialIds>
}
export interface PlantObjectOptions extends DestructionOptions {
  /**
   * Build one child Mesh per `plant.pieces` entry instead of one per part. Each child is positioned at the piece pivot (so it can
   * fall / rotate about it), carries `userData.destructionPart = { id, kind, parent, material, materialKey }` (wood pieces add `radius`, `length`, `axis`, `base`) and
   * `userData.destructionMaterial`. Default false.
   */
  separable?: boolean
}

function idsFor(mats: VegetationMaterials, o?: DestructionOptions): MaterialIds {
  return resolveMaterialIds({ ...(mats.materialIds ?? {}), ...(o?.materialIds ?? {}) })
}

function meshFor(THREE: ThreeNS, data: MeshData, material: unknown, ids?: MaterialIds, condition?: Condition): InstanceType<ThreeNS['Mesh']> {
  const geo = toBufferGeometry(THREE, data)
  inflate(geo, 0.4)
  const mesh = new THREE.Mesh(geo, material as InstanceType<ThreeNS['Material']>)
  mesh.name = data.kind
  mesh.userData.damageable = { material: data.material }
  if (ids) mesh.userData.destructionMaterial = ids[materialKeyForPart(data.kind, data.material, condition)]
  return mesh
}

/** Copy the triangles of one index range into their own compact MeshData, moved by -origin. */
export function slicePiece(mesh: MeshData, indexStart: number, indexCount: number, origin: Vec3): MeshData {
  const remap = new Map<number, number>()
  const order: number[] = []
  const indices = new Uint32Array(indexCount)
  for (let i = 0; i < indexCount; i++) {
    const v = mesh.indices[indexStart + i]
    let n = remap.get(v)
    if (n === undefined) {
      n = order.length
      remap.set(v, n)
      order.push(v)
    }
    indices[i] = n
  }
  const positions = new Float32Array(order.length * 3)
  const normals = new Float32Array(order.length * 3)
  const colors = new Float32Array(order.length * 3)
  const sway = new Float32Array(order.length)
  for (let i = 0; i < order.length; i++) {
    const v = order[i]
    positions[i * 3] = mesh.positions[v * 3] - origin[0]
    positions[i * 3 + 1] = mesh.positions[v * 3 + 1] - origin[1]
    positions[i * 3 + 2] = mesh.positions[v * 3 + 2] - origin[2]
    normals.set(mesh.normals.subarray(v * 3, v * 3 + 3), i * 3)
    colors.set(mesh.colors.subarray(v * 3, v * 3 + 3), i * 3)
    sway[i] = mesh.sway[v]
  }
  return { positions, normals, colors, sway, indices, triangleCount: indexCount / 3, kind: mesh.kind, material: mesh.material }
}

/** One Mesh per part. userData: collider, bendable, thorny, species, bounds. */
export function createPlantObject(THREE: ThreeNS, plant: PlantMesh, materials?: VegetationMaterials, options: PlantObjectOptions = {}): InstanceType<ThreeNS['Group']> {
  const mats = materials ?? createVegetationMaterials(THREE)
  const ids = idsFor(mats, options)
  const g = new THREE.Group()
  g.name = plant.species
  if (options.separable) {
    for (const pc of plant.pieces) {
      const src = plant.parts[pc.part]
      if (!src) continue
      const data = slicePiece(src, pc.indexStart, pc.indexCount, pc.pivot)
      const mesh = meshFor(THREE, data, mats[pc.part])
      mesh.name = pc.id
      mesh.position.set(pc.pivot[0], pc.pivot[1], pc.pivot[2])
      const id = ids[pc.material]
      mesh.userData.destructionMaterial = id
      mesh.userData.destructionPart = { id: pc.id, kind: pc.kind, parent: pc.parent, material: id, materialKey: pc.material, ...(pc.radius === undefined ? {} : { radius: pc.radius, length: pc.length, axis: pc.axis, base: pc.base }) }
      g.add(mesh)
    }
    g.userData = { collider: plant.collider, bendable: plant.bendable, thorny: plant.thorny, species: plant.species, bounds: plant.bounds, pieces: plant.pieces, separable: true }
    return g
  }
  for (const kind of PART_ORDER) {
    const data = plant.parts[kind]
    if (!data) continue
    g.add(meshFor(THREE, data, mats[kind], ids, plant.condition))
  }
  g.userData = { collider: plant.collider, bendable: plant.bendable, thorny: plant.thorny, species: plant.species, bounds: plant.bounds, damageable: { material: plant.parts.wood?.material ?? 'foliage' }, destructionMaterial: ids[materialKeyForPart(plant.parts.wood ? 'wood' : 'foliage', plant.parts.wood?.material ?? 'foliage', plant.condition)] }
  return g
}

/** A merged lot: at most 3 meshes. userData: colliders, triangleCount. */
export function createLotObject(THREE: ThreeNS, lot: Lot, materials?: VegetationMaterials, options: DestructionOptions = {}): InstanceType<ThreeNS['Group']> {
  const mats = materials ?? createVegetationMaterials(THREE)
  const ids = idsFor(mats, options)
  const g = new THREE.Group()
  g.name = 'vegetation-lot'
  const { wood, foliage, flowers } = lot.meshes
  if (wood) g.add(meshFor(THREE, wood, mats.wood, ids, lot.condition))
  if (foliage) g.add(meshFor(THREE, foliage, mats.foliage, ids, lot.condition))
  if (flowers) g.add(meshFor(THREE, flowers, mats.flowers, ids, lot.condition))
  g.userData = { colliders: lot.colliders, triangleCount: lot.triangleCount, materialIds: ids }
  return g
}

/**
 * Swap one merged plant of a lot for its separable version: its triangles are hidden in the lot meshes (`lotObject` is the result
 * of createLotObject for `lot`) and a Group with one child per piece is returned, already placed (position, rotation.y, scale).
 * Add it to the scene yourself.
 */
export function separatePlantFromLot(THREE: ThreeNS, lot: Lot, lotObject: Obj, plantIndex: number, materials?: VegetationMaterials, options: DestructionOptions = {}): InstanceType<ThreeNS['Group']> {
  const { plant, placement } = extractPlant(lot, plantIndex)
  hideLotPlant(lot, plantIndex)
  lotObject.traverse((o) => {
    const geo = (o as InstanceType<ThreeNS['Mesh']>).geometry as Geo | undefined
    if (geo?.index) geo.index.needsUpdate = true
  })
  const obj = createPlantObject(THREE, plant, materials, { ...options, separable: true })
  obj.position.set(placement.x, 0, placement.z)
  obj.rotation.y = placement.ry
  obj.scale.setScalar(placement.scale)
  obj.userData.plantIndex = plantIndex
  return obj
}

/** InstancedMesh per part for many copies of one plant (grass, flowers, hedges). Wind phase varies per instance. */
export function createInstancedPlants(THREE: ThreeNS, plant: PlantMesh, placements: readonly Placement[], materials?: VegetationMaterials, options: PlantObjectOptions = {}): InstanceType<ThreeNS['Group']> {
  const mats = materials ?? createVegetationMaterials(THREE)
  const ids = idsFor(mats, options)
  const g = new THREE.Group()
  g.name = plant.species + '-instanced'
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const m4 = new THREE.Matrix4()
  for (const kind of PART_ORDER) {
    const data = plant.parts[kind]
    if (!data) continue
    const geo = toBufferGeometry(THREE, data)
    const im = new THREE.InstancedMesh(geo, mats[kind], Math.max(1, placements.length))
    im.count = placements.length
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]
      pos.set(p.x, 0, p.z)
      quat.setFromAxisAngle(up, p.ry)
      scl.setScalar(p.scale)
      m4.compose(pos, quat, scl)
      im.setMatrixAt(i, m4)
    }
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
    im.frustumCulled = false
    im.name = kind
    im.userData.damageable = { material: data.material }
    im.userData.destructionMaterial = ids[materialKeyForPart(data.kind, data.material, plant.condition)]
    g.add(im)
  }
  g.userData = { collider: plant.collider, bendable: plant.bendable, species: plant.species, count: placements.length }
  return g
}

export interface LodObjectOptions extends GenerateOptions {
  /** distances at which lod 0 / 1 / 2 start (default 0, 25, 60) */
  distances?: [number, number, number]
  materials?: VegetationMaterials
  species?: string
}

/** THREE.LOD with the three LODs of a plant. */
export function lodObject(THREE: ThreeNS, spec: PlantSpec, opts: LodObjectOptions = {}): InstanceType<ThreeNS['LOD']> {
  const mats = opts.materials ?? createVegetationMaterials(THREE)
  const d = opts.distances ?? [0, 25, 60]
  const lod = new THREE.LOD()
  for (const l of [0, 1, 2] as const) {
    const plant = generate(spec, { ...opts, lod: l })
    lod.addLevel(createPlantObject(THREE, plant, mats) as Obj, d[l])
  }
  lod.userData = { collider: generate(spec, { ...opts, lod: 2 }).collider }
  return lod
}
