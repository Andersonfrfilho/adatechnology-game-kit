import { colorHex } from '@adatechnology/game-shapes'
import type { MaterialHint, ShapeBuffers, ShapeLevel, ShapePart, ShapePoint } from '@adatechnology/game-shapes'
import type * as THREE_NS from 'three'

import { toGeometry } from './geometry'
import type { Three } from './geometry'

/** A `MeshStandardMaterial` per material id from the schema's hints (vertex colours on unless the hint says otherwise). */
export function createMaterials(THREE: Three, hints: Readonly<Record<string, MaterialHint>> = {}, ids: Iterable<string> = []): Record<string, THREE_NS.Material> {
  const out: Record<string, THREE_NS.Material> = {}
  const all = new Set([...Object.keys(hints), ...ids])
  for (const id of all) {
    const hint = hints[id] ?? {}
    const parameters: THREE_NS.MeshStandardMaterialParameters = { vertexColors: hint.vertexColors ?? true }
    if (hint.color !== undefined) parameters.color = colorHex(hint.color)
    if (hint.roughness !== undefined) parameters.roughness = hint.roughness
    if (hint.metalness !== undefined) parameters.metalness = hint.metalness
    if (hint.opacity !== undefined) parameters.opacity = hint.opacity
    if (hint.transparent !== undefined) parameters.transparent = hint.transparent
    if (hint.emissive !== undefined) parameters.emissive = colorHex(hint.emissive)
    if (hint.emissiveIntensity !== undefined) parameters.emissiveIntensity = hint.emissiveIntensity
    if (hint.flatShading !== undefined) parameters.flatShading = hint.flatShading
    if (hint.depthWrite !== undefined) parameters.depthWrite = hint.depthWrite
    if (hint.side !== undefined) parameters.side = hint.side === 'double' ? THREE.DoubleSide : hint.side === 'back' ? THREE.BackSide : THREE.FrontSide
    const material = new THREE.MeshStandardMaterial(parameters)
    material.name = id
    out[id] = material
  }
  return out
}

export interface ToObjectOptions {
  /** Materials by id; missing ids get one from the schema hints (`createMaterials`). */
  readonly materials?: Readonly<Record<string, THREE_NS.Material>>
  /** The material of one draw (wins over `materials`): per material id and part (`null` for the static body). */
  readonly materialFor?: (material: string, part: string | null) => THREE_NS.Material | undefined
  /** Cast and receive shadows (default true). */
  readonly shadows?: boolean
  /** Copy the arrays into the attributes (default true; false shares them, read-only). */
  readonly copy?: boolean
  /** Name of the root. */
  readonly name?: string
}

export interface ShapeObject {
  /** A `Group`, or a `LOD` when the shape has levels or a cull distance. */
  readonly object: THREE_NS.Object3D
  /** The level 0 group (the root itself without LOD). */
  readonly near: THREE_NS.Group
  /** Part groups of level 0 by id, at their pivots; animate these. */
  readonly parts: Record<string, THREE_NS.Group>
  readonly meshes: THREE_NS.Mesh[]
  readonly instanced: THREE_NS.InstancedMesh[]
  readonly points: readonly ShapePoint[]
  readonly materials: Record<string, THREE_NS.Material>
}

function placePart(THREE: Three, group: THREE_NS.Group, part: ShapePart): void {
  if (part.matrix && part.position === undefined && part.rotation === undefined && part.scale === undefined && part.heading === undefined) {
    new THREE.Matrix4().fromArray(part.matrix as number[]).decompose(group.position, group.quaternion, group.scale)
    return
  }
  if (part.position) group.position.set(part.position[0], part.position[1], part.position[2])
  if (part.heading !== undefined) group.rotation.y = part.heading
  else if (part.rotation) group.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2], part.rotationOrder ?? 'XYZ')
  if (part.scale !== undefined) {
    if (typeof part.scale === 'number') group.scale.setScalar(part.scale)
    else group.scale.set(part.scale[0], part.scale[1], part.scale[2])
  }
  group.updateMatrix()
}

/**
 * The three objects of a shape: one mesh per batch (`static:<material>` or `part:<id>`, `userData.material`, `userData.part`), part groups at their
 * pivots, an `InstancedMesh` per instanced batch, and a `LOD` (levels at their distances, nothing from `cullDistance`) when there are levels.
 */
export function toObject3D(THREE: Three, buffers: ShapeBuffers, options: ToObjectOptions = {}): ShapeObject {
  const shadows = options.shadows !== false
  const ids = new Set<string>()
  for (const level of buffers.levels) {
    for (const b of level.batches) ids.add(b.material)
    for (const b of level.instanced) ids.add(b.material)
  }
  const made = createMaterials(THREE, buffers.materials, [...ids].filter((id) => !options.materials?.[id]))
  const materials: Record<string, THREE_NS.Material> = { ...made, ...(options.materials ?? {}) }
  const materialOf = (id: string, part: string | null): THREE_NS.Material => options.materialFor?.(id, part) ?? (materials[id] as THREE_NS.Material)
  const meshes: THREE_NS.Mesh[] = []
  const instanced: THREE_NS.InstancedMesh[] = []

  const build = (level: ShapeLevel, withParts: boolean): { group: THREE_NS.Group; parts: Record<string, THREE_NS.Group> } => {
    const group = new THREE.Group()
    group.name = options.name ?? buffers.name ?? 'shape'
    const parts: Record<string, THREE_NS.Group> = {}
    if (withParts) {
      for (const part of buffers.parts) {
        const g = new THREE.Group()
        g.name = `part:${part.id}`
        g.userData.part = part.id
        placePart(THREE, g, part)
        parts[part.id] = g
      }
    }
    const into = (part: string | null): THREE_NS.Object3D => (part !== null && parts[part]) || group
    for (const batch of level.batches) {
      const mesh = new THREE.Mesh(toGeometry(THREE, batch, { copy: options.copy !== false }), materialOf(batch.material, batch.part))
      mesh.geometry.computeBoundingSphere()
      mesh.geometry.computeBoundingBox()
      mesh.name = batch.part === null ? `static:${batch.material}` : `part:${batch.part}`
      if (batch.part !== null) mesh.userData.part = batch.part
      mesh.userData.material = batch.material
      if (batch.ranges.length) mesh.userData.ranges = batch.ranges
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      into(batch.part).add(mesh)
      meshes.push(mesh)
    }
    for (const batch of level.instanced) {
      const mesh = new THREE.InstancedMesh(toGeometry(THREE, batch.geometry, { copy: options.copy !== false }), materialOf(batch.material, batch.part), batch.count)
      mesh.instanceMatrix.array.set(batch.matrices)
      mesh.instanceMatrix.needsUpdate = true
      if (batch.colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(batch.colors.slice(), 3)
      mesh.name = `instanced:${batch.name ?? batch.material}`
      mesh.userData.material = batch.material
      if (batch.part !== null) mesh.userData.part = batch.part
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      mesh.computeBoundingSphere()
      into(batch.part).add(mesh)
      instanced.push(mesh)
    }
    for (const part of Object.values(parts)) group.add(part)
    return { group, parts }
  }

  const levels = buffers.levels
  const first = build(levels[0] ?? { distance: 0, detail: 1, batches: [], instanced: [] }, true)
  let object: THREE_NS.Object3D = first.group
  if (levels.length > 1 || buffers.cullDistance !== undefined) {
    const lod = new THREE.LOD()
    lod.name = first.group.name
    lod.addLevel(first.group, 0)
    for (const level of levels.slice(1)) lod.addLevel(build(level, false).group, level.distance)
    if (buffers.cullDistance !== undefined) lod.addLevel(new THREE.Group(), buffers.cullDistance)
    object = lod
  }
  object.userData.points = buffers.points
  return { object, near: first.group, parts: first.parts, meshes, instanced, points: buffers.points, materials }
}
