// The merge game-props3d shipped before it moved here (copied as it was), the reference of the bit-for-bit test.
import type * as THREE_NS from 'three'

const ATTRIBUTES = ['position', 'normal', 'uv'] as const

const isVisible = (object: THREE_NS.Object3D): boolean => {
  for (let node: THREE_NS.Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

/** A copy of the geometry with the matrix baked in, not indexed, keeping only what every model has (position, normal, uv), so that any two of them can be joined. */
const bake = (THREE: typeof THREE_NS, mesh: THREE_NS.Mesh, matrix: THREE_NS.Matrix4): THREE_NS.BufferGeometry => {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  const baked = new THREE.BufferGeometry()
  const count = source.getAttribute('position').count
  for (const name of ATTRIBUTES) {
    const attribute = source.getAttribute(name)
    baked.setAttribute(name, attribute ?? new THREE.BufferAttribute(new Float32Array(count * (name === 'uv' ? 2 : 3)), name === 'uv' ? 2 : 3))
  }
  source.dispose()
  return baked.applyMatrix4(matrix)
}

/** One non-indexed geometry out of several, in order (the port of `mergeGeometries` of three/addons for the three attributes above). */
const join = (THREE: typeof THREE_NS, geometries: readonly THREE_NS.BufferGeometry[]): THREE_NS.BufferGeometry => {
  const merged = new THREE.BufferGeometry()
  for (const name of ATTRIBUTES) {
    const size = (geometries[0]?.getAttribute(name) as THREE_NS.BufferAttribute).itemSize
    const total = geometries.reduce((sum, geometry) => sum + geometry.getAttribute(name).count, 0)
    const array = new Float32Array(total * size)
    let offset = 0
    for (const geometry of geometries) {
      array.set(geometry.getAttribute(name).array, offset)
      offset += geometry.getAttribute(name).count * size
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, size))
  }
  return merged
}

/**
 * Every visible mesh under `root` (whose world matrix must be up to date), baked into the space of `space` and joined by material: one mesh per material, no shadow cast.
 * Weapons lying on a counter are never animated, so the hundreds of meshes of a model cost one draw call per material instead.
 */
export function mergeByMaterial(THREE: typeof THREE_NS, root: THREE_NS.Object3D, space: THREE_NS.Object3D): THREE_NS.Mesh[] {
  const toSpace = space.matrixWorld.clone().invert()
  const byMaterial = new Map<THREE_NS.Material, THREE_NS.BufferGeometry[]>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material) || !isVisible(mesh)) return
    const list = byMaterial.get(mesh.material) ?? []
    list.push(bake(THREE, mesh, new THREE.Matrix4().multiplyMatrices(toSpace, mesh.matrixWorld)))
    byMaterial.set(mesh.material, list)
  })
  return [...byMaterial].map(([material, geometries]) => {
    const merged = new THREE.Mesh(join(THREE, geometries), material)
    for (const geometry of geometries) geometry.dispose()
    merged.castShadow = false
    merged.receiveShadow = true
    return merged
  })
}
