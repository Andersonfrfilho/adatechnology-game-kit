import { mergeTransformed } from '@adatechnology/game-shapes'
import type { TransformedPiece } from '@adatechnology/game-shapes'
import type * as THREE_NS from 'three'

import type { Three } from './geometry'

const isVisible = (object: THREE_NS.Object3D): boolean => {
  for (let node: THREE_NS.Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

/** A plain, non-interleaved, not normalised Float32 attribute: what the core merge reads directly. */
const plain = (attribute: THREE_NS.BufferAttribute | THREE_NS.InterleavedBufferAttribute | undefined): attribute is THREE_NS.BufferAttribute =>
  attribute !== undefined && !(attribute as THREE_NS.InterleavedBufferAttribute).isInterleavedBufferAttribute && attribute.array instanceof Float32Array && !attribute.normalized

/** Arrays of a geometry the core merge can take as they are; for anything else, the arrays three's own `toNonIndexed` makes (then not indexed). */
function piece(geometry: THREE_NS.BufferGeometry, matrix: THREE_NS.Matrix4): TransformedPiece {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const ok = plain(position) && (normal === undefined || plain(normal)) && (uv === undefined || plain(uv)) && position.itemSize === 3 && (uv === undefined || uv.itemSize === 2)
  if (ok) {
    return { positions: position.array, ...(normal ? { normals: normal.array } : {}), ...(uv ? { uvs: uv.array } : {}), indices: geometry.index ? geometry.index.array : null, matrix: matrix.elements }
  }
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  const read = (name: string, size: number): Float32Array | undefined => {
    const attribute = flat.getAttribute(name)
    if (!attribute) return undefined
    const out = new Float32Array(attribute.count * size)
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < size; c++) out[i * size + c] = c === 0 ? attribute.getX(i) : c === 1 ? attribute.getY(i) : attribute.getZ(i)
    return out
  }
  const positions = read('position', 3) as Float32Array
  const normals = read('normal', 3)
  const uvs = read('uv', 2)
  if (flat !== geometry) flat.dispose()
  return { positions, ...(normals ? { normals } : {}), ...(uvs ? { uvs } : {}), indices: null, matrix: matrix.elements }
}

/**
 * Every visible mesh under `root` (whose world matrix must be up to date), baked into the space of `space` and joined by material: one non-indexed
 * mesh per material (position, normal, uv), no shadow cast. The bake is game-shapes' `mergeTransformed`, bit-identical to three's
 * `toNonIndexed` + `applyMatrix4` + join, so the result is the one `game-props3d`'s `mergeByMaterial` always gave.
 */
export function mergeByMaterial(THREE: Three, root: THREE_NS.Object3D, space: THREE_NS.Object3D): THREE_NS.Mesh[] {
  const toSpace = space.matrixWorld.clone().invert()
  const byMaterial = new Map<THREE_NS.Material, TransformedPiece[]>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material) || !isVisible(mesh)) return
    const list = byMaterial.get(mesh.material) ?? []
    list.push(piece(mesh.geometry, new THREE.Matrix4().multiplyMatrices(toSpace, mesh.matrixWorld)))
    byMaterial.set(mesh.material, list)
  })
  return [...byMaterial].map(([material, pieces]) => {
    const merged = mergeTransformed(pieces)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(merged.positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(merged.normals, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(merged.uvs, 2))
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = false
    mesh.receiveShadow = true
    return mesh
  })
}
