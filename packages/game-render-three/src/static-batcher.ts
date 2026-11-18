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
  /**
   * What tells materials apart for batching (default each material by itself, its `uuid`). Meshes whose materials give the same key are drawn in one batch with the
   * first one's material, so a key must be the same only for materials that draw the same (copies of one material with equal settings).
   */
  readonly materialKey?: (material: Material) => string
  /** Called with each batch as it is made and the meshes it draws (to mark where it comes from, for one). */
  readonly onBatch?: (batch: Mesh, meshes: readonly Mesh[]) => void
  /**
   * Batches only the shadow: the meshes keep drawing on their own in the camera's pass and stop casting while batched, and each batch is drawn
   * only into the shadow maps (positions only, one batch per side the depth pass draws, whatever the material). A mesh whose shadow needs its
   * own material (a cut-out map, clipping planes, displacement, a custom depth material, wireframe) is left casting on its own. A mesh that
   * changes casts its own shadow again, of its new shape, the frame it changes.
   */
  readonly shadowOnly?: boolean
  /**
   * The most vertices one batch holds (default unbounded; 65535 with `shadowOnly`): a larger group is split, in the order of the tree, so each
   * batch is merged within one `update` of a budget and is culled by the shadow camera by its own part of the object.
   */
  readonly maxVertices?: number
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
  /** The mesh's world matrix when last seen unchanged: equal again, nothing moved and the local check is skipped. */
  readonly world: Matrix4
  readonly mask: number
  /** `shadowOnly`: whether the mesh cast before it was batched. */
  readonly castShadow: boolean
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

const signatureOf = (mesh: Mesh, materialKey: (material: Material) => string, shadowOnly: boolean): string => {
  if (shadowOnly) return shadowSideKey(mesh.material as Material)
  const { attributes } = mesh.geometry
  const present = ATTRIBUTES.filter((name) => attributes[name] !== undefined).map((name) => `${name}${attributes[name]!.itemSize}`)
  return `${materialKey(mesh.material as Material)}|${present.join(',')}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`
}

const uuidOf = (material: Material): string => material.uuid

type DepthLike = Material & { map?: unknown; alphaMap?: unknown; displacementMap?: unknown; displacementScale?: number; wireframe?: boolean }

/** The depth pass draws this mesh with the light's plain depth material: nothing of its material but the side changes its shadow (WebGLShadowMap's `getDepthMaterial`). */
const castsPlainShadow = (mesh: Mesh): boolean => {
  const material = mesh.material as DepthLike
  const custom = mesh as Mesh & { customDepthMaterial?: Material; customDistanceMaterial?: Material }
  if (!mesh.castShadow || !material.visible || custom.customDepthMaterial || custom.customDistanceMaterial) return false
  if (material.wireframe === true || (material.clippingPlanes?.length ?? 0) > 0) return false
  if (material.displacementMap && material.displacementScale !== 0) return false
  return !(material.alphaTest > 0 && (material.map || material.alphaMap))
}

/** The sides the depth pass draws a material with: batches of the shadow are made one per pair. */
const shadowSideKey = (material: Material): string => `${material.side}|${material.shadowSide ?? ''}`

const sameMatrix = (a: Matrix4, b: Matrix4): boolean => a.elements.every((value, index) => Math.abs(value - (b.elements[index] as number)) < MATRIX_EPSILON)

/**
 * Draws the still, undamaged meshes of an object (a vehicle, a piece of furniture) as one batch per material, and gives each mesh its own draw
 * back the moment it changes. The meshes stay where they are: what hits, dents or cuts them works on them as before, they only leave the
 * camera's layer while batched.
 */
export function createStaticBatcher(THREE: ThreeLib, root: Object3D, options: StaticBatcherOptions = {}): StaticBatcher {
  const include = options.include ?? (() => true)
  const shadowOnly = options.shadowOnly === true
  const follow = options.followMeshes === true && !shadowOnly
  root.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const materialKey = options.materialKey ?? uuidOf
  const groups = new Map<string, Mesh[]>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh || !isShown(mesh, root) || !isBatchable(mesh) || (shadowOnly && !castsPlainShadow(mesh)) || !include(mesh)) return
    const key = signatureOf(mesh, materialKey, shadowOnly)
    groups.set(key, [...(groups.get(key) ?? []), mesh])
  })
  const group = new THREE.Group()
  group.name = 'static-batches'
  const sources: Source[] = []
  const maxVertices = options.maxVertices ?? (shadowOnly ? 65535 : Number.POSITIVE_INFINITY)
  const chunks = (meshes: Mesh[]): Mesh[][] => {
    const out: Mesh[][] = [[]]
    let vertices = 0
    for (const mesh of meshes) {
      const count = (mesh.geometry.attributes.position as BufferAttribute).count
      if (vertices + count > maxVertices && (out[out.length - 1] as Mesh[]).length > 0) {
        out.push([])
        vertices = 0
      }
      ;(out[out.length - 1] as Mesh[]).push(mesh)
      vertices += count
    }
    return out
  }
  const pending = [...groups.entries()].flatMap(([key, meshes]) => chunks(meshes).map((chunk) => [key, chunk] as [string, Mesh[]])).filter(([, meshes]) => meshes.length >= 2)
  // the layers each waiting mesh had when grouped: one whose layers changed before its group is merged (another drawer took it) is not merged
  const groupedMasks = new Map<Mesh, number>()
  for (const [, meshes] of pending) for (const mesh of meshes) groupedMasks.set(mesh, mesh.layers.mask)
  /**
   * Still as it was grouped: shown, included, the same layers and the same signature (a material swapped or a colour attribute added since would be merged under the
   * group's material, or copied from an attribute the group does not have; with `shadowOnly`, a shadow that now needs its own material).
   */
  const isUnchanged = (mesh: Mesh, key: string): boolean =>
    isShown(mesh, root) && include(mesh) && isBatchable(mesh) && (!shadowOnly || castsPlainShadow(mesh)) && mesh.layers.mask === groupedMasks.get(mesh) && signatureOf(mesh, materialKey, shadowOnly) === key
  const mergeSome = (deadline: number): void => {
    while (pending.length > 0) {
      const [key, meshes] = pending.shift() as [string, Mesh[]]
      // a mesh that changed while it waited is left as it is; the rest of its group is merged
      const still = meshes.filter((mesh) => isUnchanged(mesh, key))
      for (const mesh of meshes) groupedMasks.delete(mesh)
      if (still.length >= 2) sources.push(...mergeGroup(THREE, { meshes: still, inverse: new THREE.Matrix4().copy(root.matrixWorld).invert(), group, follow, shadowOnly, onBatch: options.onBatch }))
      if (performance.now() >= deadline) return
    }
  }
  if (options.budgetMs === undefined) mergeSome(Number.POSITIVE_INFINITY)
  root.add(group)
  const scratch = new THREE.Matrix4()
  let released = 0

  const release = (source: Source): void => {
    source.released = true
    if (shadowOnly) source.mesh.castShadow = source.castShadow
    else source.mesh.layers.mask = source.mask
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
    dispose() {
      for (const source of sources) {
        if (source.released) continue
        if (shadowOnly) source.mesh.castShadow = source.castShadow
        else source.mesh.layers.mask = source.mask
      }
      pending.length = 0
      groupedMasks.clear()
      group.removeFromParent()
      for (const child of group.children) {
        ;(child as Mesh).geometry.dispose()
        if (shadowOnly) ((child as Mesh).material as Material).dispose()
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

type MergeGroupParams = {
  readonly meshes: readonly Mesh[]
  readonly inverse: Matrix4
  readonly group: Object3D
  readonly follow: boolean
  readonly shadowOnly: boolean
  readonly onBatch: StaticBatcherOptions['onBatch']
}

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

/**
 * A batch drawn only into the shadow maps. The camera's pass and the shadow pass both skip a mesh by the same tests (visible, layers, its
 * material's `visible`), so the batch is left in the camera's pass with an empty draw range (three returns before the draw call) and given its
 * whole range only around its own shadow draws.
 */
function shadowBatch(THREE: ThreeLib, merged: BufferGeometry, like: Material): Mesh {
  const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: like.side })
  material.shadowSide = like.shadowSide
  material.name = 'shadow-batch'
  const mesh = new THREE.Mesh(merged, material)
  merged.setDrawRange(0, -1)
  mesh.onBeforeShadow = () => merged.setDrawRange(0, Number.POSITIVE_INFINITY)
  mesh.onAfterShadow = () => merged.setDrawRange(0, -1)
  mesh.castShadow = true
  mesh.receiveShadow = false
  return mesh
}

function mergeGroup(THREE: ThreeLib, { meshes, inverse: rootInverse, group, follow, shadowOnly, onBatch }: MergeGroupParams): Source[] {
  const identity = new THREE.Matrix4()
  const inverse = follow ? identity : rootInverse
  const first = meshes[0] as Mesh
  // the depth pass reads positions only
  const names = shadowOnly ? (['position'] as const) : ATTRIBUTES.filter((name) => first.geometry.attributes[name] !== undefined)
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
  const mesh = shadowOnly ? shadowBatch(THREE, merged, first.material as Material) : follow ? skinnedBatch(THREE, merged, first.material as Material, meshes) : new THREE.Mesh(merged, first.material)
  mesh.name = shadowOnly ? `shadow-batch:${shadowSideKey(first.material as Material)}` : `batch:${(first.material as Material).name || (first.material as Material).type}`
  if (!shadowOnly) {
    mesh.castShadow = first.castShadow
    mesh.receiveShadow = first.receiveShadow
  }
  mesh.raycast = () => undefined
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  group.add(mesh)
  onBatch?.(mesh, meshes)
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
      castShadow: piece.mesh.castShadow,
      batch,
      start: indexOffset,
      count: piece.indexCount,
      released: false,
    })
    if (shadowOnly) piece.mesh.castShadow = false
    else piece.mesh.layers.set(BATCHED_LAYER)
    vertexOffset += piece.vertices
    indexOffset += piece.indexCount
  }
  return sources
}
