import type * as THREE_NS from 'three'

type TriangleBoxes = {
  array: ArrayLike<number>
  positionVersion: number
  indexArray: ArrayLike<number> | null
  indexVersion: number
  count: number
  boxes: Float32Array
}

/** Padding of the segment's box in the mesh's space, for the rounding of carrying it there. */
const SEGMENT_PADDING = 1e-6

/**
 * Raycasts a mesh against a short segment without visiting every triangle: it keeps the box of each triangle until the mesh is written again, hands the triangles whose box meets the
 * segment to the mesh's own `raycast` (through a stand-in that shares its vertex buffers, material and matrix), and gives back the same hits as `mesh.raycast` would. A mesh the stand-in
 * cannot copy faithfully (skinned, morphed, several materials, an own `raycast`) goes to `mesh.raycast` itself.
 */
export class MeshRayProbe {
  private readonly cache = new WeakMap<THREE_NS.BufferGeometry, TriangleBoxes>()
  private readonly stand: THREE_NS.Mesh
  private readonly inverse: THREE_NS.Matrix4
  private readonly from: THREE_NS.Vector3
  private readonly to: THREE_NS.Vector3
  private candidates = new Uint32Array(64)
  private candidateIndex: THREE_NS.BufferAttribute
  private triangles = new Uint32Array(64)

  constructor(private readonly THREE: typeof THREE_NS) {
    this.stand = new THREE.Mesh(new THREE.BufferGeometry())
    this.stand.matrixAutoUpdate = false
    this.inverse = new THREE.Matrix4()
    this.from = new THREE.Vector3()
    this.to = new THREE.Vector3()
    this.candidateIndex = new THREE.BufferAttribute(this.candidates, 1)
  }

  raycast(mesh: THREE_NS.Mesh, raycaster: THREE_NS.Raycaster, hits: THREE_NS.Intersection[]): void {
    const geometry = mesh.geometry
    const position = geometry.attributes.position as THREE_NS.BufferAttribute | undefined
    if (!this.canStandIn(mesh) || !position || !Number.isFinite(raycaster.far)) {
      mesh.raycast(raycaster, hits)
      return
    }
    const triangleBoxes = this.boxesOf(geometry, position)
    const found = this.collect(mesh, raycaster, triangleBoxes)
    if (found === 0) return
    const stand = this.stand
    const standGeometry = stand.geometry
    standGeometry.setIndex(this.candidateIndex)
    standGeometry.setDrawRange(0, found * 3)
    for (const name of ['position', 'normal', 'uv', 'uv1'] as const) {
      const attribute = geometry.attributes[name]
      if (attribute) standGeometry.setAttribute(name, attribute)
      else standGeometry.deleteAttribute(name)
    }
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere()
    standGeometry.boundingSphere = geometry.boundingSphere
    standGeometry.boundingBox = geometry.boundingBox
    stand.material = mesh.material
    stand.matrixWorld.copy(mesh.matrixWorld)
    const first = hits.length
    stand.raycast(raycaster, hits)
    for (let i = first; i < hits.length; i++) {
      const hit = hits[i]!
      hit.object = mesh
      hit.faceIndex = this.triangles[hit.faceIndex ?? 0]!
    }
  }

  private canStandIn(mesh: THREE_NS.Mesh): boolean {
    const geometry = mesh.geometry
    const position = geometry.attributes.position
    if (mesh.raycast !== this.THREE.Mesh.prototype.raycast || Array.isArray(mesh.material) || geometry.groups.length > 0) return false
    if ((mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh || mesh.morphTargetInfluences || geometry.morphAttributes.position) return false
    if (!position || (position as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) return false
    return geometry.drawRange.start % 3 === 0
  }

  /** The box of every triangle of the geometry, rebuilt when its vertex buffer or index was written since. */
  private boxesOf(geometry: THREE_NS.BufferGeometry, position: THREE_NS.BufferAttribute): TriangleBoxes {
    const index = geometry.index
    const count = Math.floor((index ? index.count : position.count) / 3)
    const seen = this.cache.get(geometry)
    if (seen && seen.array === position.array && seen.positionVersion === position.version && seen.indexArray === (index?.array ?? null) && seen.indexVersion === (index?.version ?? 0) && seen.count === count) return seen
    const boxes = seen && seen.boxes.length === count * 6 ? seen.boxes : new Float32Array(count * 6)
    const vertices = position.array
    const ids = index?.array
    for (let t = 0; t < count; t++) {
      const a = (ids ? ids[t * 3]! : t * 3) * 3
      const b = (ids ? ids[t * 3 + 1]! : t * 3 + 1) * 3
      const c = (ids ? ids[t * 3 + 2]! : t * 3 + 2) * 3
      for (let axis = 0; axis < 3; axis++) {
        const va = vertices[a + axis]!
        const vb = vertices[b + axis]!
        const vc = vertices[c + axis]!
        boxes[t * 6 + axis] = Math.min(va, vb, vc)
        boxes[t * 6 + 3 + axis] = Math.max(va, vb, vc)
      }
    }
    const built: TriangleBoxes = { array: position.array, positionVersion: position.version, indexArray: index?.array ?? null, indexVersion: index?.version ?? 0, count, boxes }
    this.cache.set(geometry, built)
    return built
  }

  /** Fills `candidates` with the vertex ids of the triangles whose box meets the ray's segment (in the mesh's space) and `triangles` with their numbers; returns how many. */
  private collect(mesh: THREE_NS.Mesh, raycaster: THREE_NS.Raycaster, { boxes, count }: TriangleBoxes): number {
    const geometry = mesh.geometry
    const ids = geometry.index?.array
    this.inverse.copy(mesh.matrixWorld).invert()
    const ray = raycaster.ray
    const from = this.from.copy(ray.origin).applyMatrix4(this.inverse)
    const to = this.to.copy(ray.direction).multiplyScalar(raycaster.far).add(ray.origin).applyMatrix4(this.inverse)
    const pad = SEGMENT_PADDING * (1 + Math.max(Math.abs(from.x), Math.abs(from.y), Math.abs(from.z), Math.abs(to.x), Math.abs(to.y), Math.abs(to.z)))
    const lowX = Math.min(from.x, to.x) - pad
    const lowY = Math.min(from.y, to.y) - pad
    const lowZ = Math.min(from.z, to.z) - pad
    const highX = Math.max(from.x, to.x) + pad
    const highY = Math.max(from.y, to.y) + pad
    const highZ = Math.max(from.z, to.z) + pad
    const first = Math.max(0, geometry.drawRange.start / 3)
    const last = Math.min(count, Math.ceil((geometry.drawRange.start + geometry.drawRange.count) / 3))
    let found = 0
    for (let t = first; t < last; t++) {
      const k = t * 6
      if (boxes[k + 3]! < lowX || boxes[k]! > highX || boxes[k + 4]! < lowY || boxes[k + 1]! > highY || boxes[k + 5]! < lowZ || boxes[k + 2]! > highZ) continue
      this.reserve(found + 1)
      for (let corner = 0; corner < 3; corner++) this.candidates[found * 3 + corner] = ids ? ids[t * 3 + corner]! : t * 3 + corner
      this.triangles[found++] = t
    }
    return found
  }

  private reserve(triangleCount: number): void {
    if (triangleCount * 3 <= this.candidates.length) return
    const size = Math.max(triangleCount * 3, this.candidates.length * 2)
    const grown = new Uint32Array(size)
    grown.set(this.candidates)
    this.candidates = grown
    const numbers = new Uint32Array(Math.ceil(size / 3))
    numbers.set(this.triangles)
    this.triangles = numbers
    this.candidateIndex = new this.THREE.BufferAttribute(this.candidates, 1)
  }
}
