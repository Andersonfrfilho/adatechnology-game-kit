import type { BufferAttribute, BufferGeometry, Material, Matrix4, Mesh, Object3D } from 'three'

import type { ThreeLib } from './three-lib'

/** The layer a batched mesh is moved to: no camera draws it, a raycaster that enables every layer still finds it. */
export const BATCHED_LAYER = 30

const MATRIX_EPSILON = 1e-6

export type StaticBatcherOptions = {
  /** Which meshes may be batched (default every shown mesh with one material and no instancing, skinning or morphing). */
  readonly include?: (mesh: Mesh) => boolean
}

export type StaticBatcherStats = { readonly batches: number; readonly batched: number; readonly released: number }

export type StaticBatcher = {
  /** The batch meshes, a child of the root. */
  readonly group: Object3D
  /**
   * Gives back to its own draw every batched mesh that changed since the batch was made (moved, dented, hidden, given another geometry or
   * material); returns how many it released. Call it once per frame, before the render.
   */
  update(): number
  stats(): StaticBatcherStats
  /** Every mesh draws on its own again and the batches are disposed. */
  dispose(): void
}

type Source = {
  readonly mesh: Mesh
  readonly geometry: BufferGeometry
  readonly material: Material
  readonly version: number
  readonly local: Matrix4
  readonly mask: number
  readonly batch: Batch
  readonly start: number
  readonly count: number
  released: boolean
}

type Batch = { readonly mesh: Mesh; readonly index: { array: ArrayLike<number> & { [n: number]: number }; needsUpdate: boolean } }

const ATTRIBUTES = ['position', 'normal', 'uv', 'color'] as const

/** Visible all the way up to `root`; a mesh no longer under it (its model was rebuilt) is not shown. */
const isShown = (object: Object3D, root: Object3D): boolean => {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node === root) return true
    if (!node.visible) return false
  }
  return false
}

const isBatchable = (mesh: Mesh): boolean => {
  const flags = mesh as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean }
  if (flags.isInstancedMesh === true || flags.isSkinnedMesh === true || Array.isArray(mesh.material)) return false
  const geometry = mesh.geometry
  return geometry.attributes.position !== undefined && Object.keys(geometry.morphAttributes).length === 0
}

const signatureOf = (mesh: Mesh): string => {
  const { attributes } = mesh.geometry
  const present = ATTRIBUTES.filter((name) => attributes[name] !== undefined).map((name) => `${name}${attributes[name]!.itemSize}`)
  return `${(mesh.material as Material).uuid}|${present.join(',')}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`
}

const sameMatrix = (a: Matrix4, b: Matrix4): boolean => a.elements.every((value, index) => Math.abs(value - (b.elements[index] as number)) < MATRIX_EPSILON)

/**
 * Draws the still, undamaged meshes of an object (a vehicle, a piece of furniture) as one batch per material, and gives each mesh its own draw
 * back the moment it changes. The meshes stay where they are: what hits, dents or cuts them works on them as before, they only leave the
 * camera's layer while batched.
 */
export function createStaticBatcher(THREE: ThreeLib, root: Object3D, options: StaticBatcherOptions = {}): StaticBatcher {
  const include = options.include ?? (() => true)
  root.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const groups = new Map<string, Mesh[]>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh || !isShown(mesh, root) || !isBatchable(mesh) || !include(mesh)) return
    const key = signatureOf(mesh)
    groups.set(key, [...(groups.get(key) ?? []), mesh])
  })
  const group = new THREE.Group()
  group.name = 'static-batches'
  const sources: Source[] = []
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue
    sources.push(...mergeGroup(THREE, meshes, inverse, group))
  }
  root.add(group)
  const scratch = new THREE.Matrix4()
  let released = 0

  const release = (source: Source): void => {
    source.released = true
    source.mesh.layers.mask = source.mask
    const { index } = source.batch
    const first = index.array[source.start] as number
    for (let at = source.start; at < source.start + source.count; at++) index.array[at] = first
    index.needsUpdate = true
    released++
  }
  const hasChanged = (source: Source): boolean => {
    const { mesh } = source
    if (mesh.geometry !== source.geometry || mesh.material !== source.material || !isShown(mesh, root)) return true
    if ((mesh.geometry.attributes.position as BufferAttribute).version !== source.version) return true
    inverse.copy(root.matrixWorld).invert()
    return !sameMatrix(scratch.multiplyMatrices(inverse, mesh.matrixWorld), source.local)
  }

  return {
    group,
    update() {
      const before = released
      for (const source of sources) if (!source.released && hasChanged(source)) release(source)
      return released - before
    },
    stats: () => ({ batches: group.children.length, batched: sources.filter((source) => !source.released).length, released }),
    dispose() {
      for (const source of sources) if (!source.released) source.mesh.layers.mask = source.mask
      group.removeFromParent()
      for (const child of group.children) (child as Mesh).geometry.dispose()
    },
  }
}

function mergeGroup(THREE: ThreeLib, meshes: readonly Mesh[], inverse: Matrix4, group: Object3D): Source[] {
  const first = meshes[0] as Mesh
  const names = ATTRIBUTES.filter((name) => first.geometry.attributes[name] !== undefined)
  const pieces = meshes.map((mesh) => {
    const local = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const geometry = mesh.geometry.clone().applyMatrix4(local)
    const vertices = geometry.attributes.position!.count
    const index = geometry.index ? Array.from(geometry.index.array as ArrayLike<number>) : Array.from({ length: vertices }, (_, at) => at)
    return { mesh, local, geometry, vertices, index }
  })
  const totalVertices = pieces.reduce((sum, piece) => sum + piece.vertices, 0)
  const totalIndices = pieces.reduce((sum, piece) => sum + piece.index.length, 0)
  const merged = new THREE.BufferGeometry()
  for (const name of names) {
    const size = first.geometry.attributes[name]!.itemSize
    const array = new Float32Array(totalVertices * size)
    let offset = 0
    for (const piece of pieces) {
      const attribute = piece.geometry.attributes[name] as BufferAttribute
      for (let at = 0; at < attribute.count; at++) for (let k = 0; k < size; k++) array[(offset + at) * size + k] = attribute.getComponent(at, k)
      offset += attribute.count
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, size))
  }
  const indexArray = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices)
  const indexAttribute = new THREE.BufferAttribute(indexArray, 1)
  merged.setIndex(indexAttribute)
  const mesh = new THREE.Mesh(merged, first.material)
  mesh.name = `batch:${(first.material as Material).name || (first.material as Material).type}`
  mesh.castShadow = first.castShadow
  mesh.receiveShadow = first.receiveShadow
  mesh.raycast = () => undefined
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  group.add(mesh)
  const batch: Batch = { mesh, index: indexAttribute as unknown as Batch['index'] }
  const sources: Source[] = []
  let vertexOffset = 0
  let indexOffset = 0
  for (const piece of pieces) {
    for (let at = 0; at < piece.index.length; at++) indexArray[indexOffset + at] = (piece.index[at] as number) + vertexOffset
    sources.push({
      mesh: piece.mesh,
      geometry: piece.mesh.geometry,
      material: piece.mesh.material as Material,
      version: (piece.mesh.geometry.attributes.position as BufferAttribute).version,
      local: piece.local,
      mask: piece.mesh.layers.mask,
      batch,
      start: indexOffset,
      count: piece.index.length,
      released: false,
    })
    piece.mesh.layers.set(BATCHED_LAYER)
    piece.geometry.dispose()
    vertexOffset += piece.vertices
    indexOffset += piece.index.length
  }
  return sources
}
