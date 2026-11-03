import type { Bone, BufferAttribute, BufferGeometry, Material, Matrix3, Matrix4, Mesh, Object3D, SkinnedMesh } from 'three'

import type { ThreeLib } from './three-lib'

/** The layer a batched mesh is moved to: no camera draws it, a raycaster that enables every layer still finds it. */
export const BATCHED_LAYER = 30

const MATRIX_EPSILON = 1e-6

export type StaticBatcherOptions = {
  /** Which meshes may be batched (default every shown mesh with one material and no instancing, skinning or morphing). */
  readonly include?: (mesh: Mesh) => boolean
  /** Milliseconds of merging per `update` (default all at once, in the call): batches are made a material at a time over the next frames. */
  readonly budgetMs?: number
  /**
   * The meshes move on their own (a body posed bone by bone): each batch is skinned to its meshes, so a mesh carries its part of the batch
   * wherever it goes, and only a new geometry, material, dent or hiding gives it its own draw back.
   */
  readonly followMeshes?: boolean
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
  /** Each batch mesh with the meshes merged into it (released ones included): what a caller needs to give a batch a flag its meshes carry. */
  batches(): ReadonlyArray<{ readonly mesh: Mesh; readonly sources: readonly Mesh[] }>
  /** Every mesh draws on its own again and the batches are disposed. */
  dispose(): void
}

type Source = {
  readonly mesh: Mesh
  readonly geometry: BufferGeometry
  readonly material: Material
  readonly version: number
  readonly local: Matrix4
  /** The mesh's world matrix when last seen unchanged: equal again, nothing moved and the local check is skipped. */
  readonly world: Matrix4
  readonly mask: number
  readonly batch: Batch
  readonly start: number
  readonly count: number
  released: boolean
}

type Batch = { readonly mesh: Mesh; live: number; readonly index: { array: ArrayLike<number> & { [n: number]: number }; needsUpdate: boolean } }

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
  const follow = options.followMeshes === true
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
  const pending = [...groups.values()].filter((meshes) => meshes.length >= 2)
  const mergeSome = (deadline: number): void => {
    while (pending.length > 0) {
      const meshes = pending.shift() as Mesh[]
      // a mesh that changed while it waited is left to draw on its own
      if (meshes.every((mesh) => isShown(mesh, root))) sources.push(...mergeGroup(THREE, { meshes, inverse: new THREE.Matrix4().copy(root.matrixWorld).invert(), group, follow }))
      if (performance.now() >= deadline) return
    }
  }
  if (options.budgetMs === undefined) mergeSome(Number.POSITIVE_INFINITY)
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
    // a batch whose meshes all draw on their own again is an empty draw: it leaves the screen
    if (--source.batch.live === 0) source.batch.mesh.visible = false
    released++
  }
  const hasChanged = (source: Source): boolean => {
    const { mesh } = source
    if (mesh.geometry !== source.geometry || mesh.material !== source.material || !isShown(mesh, root)) return true
    if ((mesh.geometry.attributes.position as BufferAttribute).version !== source.version) return true
    if (follow || sameMatrix(mesh.matrixWorld, source.world)) return false
    if (!sameMatrix(scratch.multiplyMatrices(inverse, mesh.matrixWorld), source.local)) return true
    // the whole object moved, the mesh did not move within it
    source.world.copy(mesh.matrixWorld)
    return false
  }

  return {
    group,
    update() {
      if (pending.length > 0) mergeSome(performance.now() + (options.budgetMs ?? Number.POSITIVE_INFINITY))
      const before = released
      inverse.copy(root.matrixWorld).invert()
      for (const source of sources) if (!source.released && hasChanged(source)) release(source)
      return released - before
    },
    stats: () => ({ batches: group.children.length, batched: sources.filter((source) => !source.released).length, released }),
    batches() {
      const byBatch = new Map<Mesh, Mesh[]>()
      for (const source of sources) byBatch.set(source.batch.mesh, [...(byBatch.get(source.batch.mesh) ?? []), source.mesh])
      return [...byBatch].map(([mesh, meshes]) => ({ mesh, sources: meshes }))
    },
    dispose() {
      for (const source of sources) if (!source.released) source.mesh.layers.mask = source.mask
      group.removeFromParent()
      for (const child of group.children) {
        ;(child as Mesh).geometry.dispose()
        ;(child as SkinnedMesh).skeleton?.dispose()
      }
    },
  }
}

/** Copies `attribute` into `target` at `offset` vertices: positions through `matrix`, normals through its normal matrix, the rest as they are. */
function copyAttribute(name: string, attribute: BufferAttribute, target: Float32Array, offset: number, matrix: Matrix4, normalMatrix: Matrix3): void {
  const size = attribute.itemSize
  const source = attribute.array as ArrayLike<number>
  const flat = !(attribute as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute && source.length === attribute.count * size
  if (name !== 'position' && name !== 'normal') {
    if (flat) target.set(source as Float32Array, offset * size)
    else for (let at = 0; at < attribute.count; at++) for (let k = 0; k < size; k++) target[(offset + at) * size + k] = attribute.getComponent(at, k)
    return
  }
  const e = (name === 'position' ? matrix : normalMatrix).elements
  const isNormal = name === 'normal'
  for (let at = 0; at < attribute.count; at++) {
    const x = attribute.getX(at)
    const y = attribute.getY(at)
    const z = attribute.getZ(at)
    const out = (offset + at) * 3
    if (isNormal) {
      const nx = e[0]! * x + e[3]! * y + e[6]! * z
      const ny = e[1]! * x + e[4]! * y + e[7]! * z
      const nz = e[2]! * x + e[5]! * y + e[8]! * z
      const length = Math.hypot(nx, ny, nz) || 1
      target[out] = nx / length
      target[out + 1] = ny / length
      target[out + 2] = nz / length
    } else {
      target[out] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!
      target[out + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!
      target[out + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!
    }
  }
}

type MergeGroupParams = { readonly meshes: readonly Mesh[]; readonly inverse: Matrix4; readonly group: Object3D; readonly follow: boolean }

/** A skinned batch whose bone `n` is mesh `n` itself (no inverse, no bind offset): every vertex lands where its own mesh puts it. */
function skinnedBatch(THREE: ThreeLib, merged: BufferGeometry, material: Material, meshes: readonly Mesh[]): Mesh {
  const vertices = (merged.attributes.position as BufferAttribute).count
  const skinIndex = new Uint16Array(vertices * 4)
  const skinWeight = new Float32Array(vertices * 4)
  let at = 0
  meshes.forEach((mesh, bone) => {
    for (let k = 0; k < (mesh.geometry.attributes.position as BufferAttribute).count; k++, at++) {
      skinIndex[at * 4] = bone
      skinWeight[at * 4] = 1
    }
  })
  merged.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
  merged.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
  const mesh = new THREE.SkinnedMesh(merged, material)
  const identities = meshes.map(() => new THREE.Matrix4())
  mesh.bind(new THREE.Skeleton(meshes as unknown as Bone[], identities), new THREE.Matrix4())
  // the parts move apart as the body is posed: the rest-pose bounds would cull the moved ones
  mesh.frustumCulled = false
  return mesh
}

function mergeGroup(THREE: ThreeLib, { meshes, inverse: rootInverse, group, follow }: MergeGroupParams): Source[] {
  const identity = new THREE.Matrix4()
  const inverse = follow ? identity : rootInverse
  const first = meshes[0] as Mesh
  const names = ATTRIBUTES.filter((name) => first.geometry.attributes[name] !== undefined)
  const pieces = meshes.map((mesh) => {
    const local = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const vertices = (mesh.geometry.attributes.position as BufferAttribute).count
    const indexCount = mesh.geometry.index ? mesh.geometry.index.count : vertices
    return { mesh, local, vertices, indexCount }
  })
  const totalVertices = pieces.reduce((sum, piece) => sum + piece.vertices, 0)
  const totalIndices = pieces.reduce((sum, piece) => sum + piece.indexCount, 0)
  const merged = new THREE.BufferGeometry()
  const normalMatrix = new THREE.Matrix3()
  for (const name of names) {
    const size = first.geometry.attributes[name]!.itemSize
    const array = new Float32Array(totalVertices * size)
    let offset = 0
    for (const piece of pieces) {
      const matrix = follow ? identity : piece.local
      copyAttribute(name, piece.mesh.geometry.attributes[name] as BufferAttribute, array, offset, matrix, normalMatrix.getNormalMatrix(matrix))
      offset += piece.vertices
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, size))
  }
  const indexArray = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices)
  const indexAttribute = new THREE.BufferAttribute(indexArray, 1)
  merged.setIndex(indexAttribute)
  const mesh = follow ? skinnedBatch(THREE, merged, first.material as Material, meshes) : new THREE.Mesh(merged, first.material)
  mesh.name = `batch:${(first.material as Material).name || (first.material as Material).type}`
  mesh.castShadow = first.castShadow
  mesh.receiveShadow = first.receiveShadow
  mesh.raycast = () => undefined
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  group.add(mesh)
  const batch: Batch = { mesh, live: pieces.length, index: indexAttribute as unknown as Batch['index'] }
  const sources: Source[] = []
  let vertexOffset = 0
  let indexOffset = 0
  for (const piece of pieces) {
    const index = piece.mesh.geometry.index
    if (index) for (let at = 0; at < piece.indexCount; at++) indexArray[indexOffset + at] = index.getX(at) + vertexOffset
    else for (let at = 0; at < piece.indexCount; at++) indexArray[indexOffset + at] = at + vertexOffset
    sources.push({
      mesh: piece.mesh,
      geometry: piece.mesh.geometry,
      material: piece.mesh.material as Material,
      version: (piece.mesh.geometry.attributes.position as BufferAttribute).version,
      local: piece.local,
      world: piece.mesh.matrixWorld.clone(),
      mask: piece.mesh.layers.mask,
      batch,
      start: indexOffset,
      count: piece.indexCount,
      released: false,
    })
    piece.mesh.layers.set(BATCHED_LAYER)
    vertexOffset += piece.vertices
    indexOffset += piece.indexCount
  }
  return sources
}
