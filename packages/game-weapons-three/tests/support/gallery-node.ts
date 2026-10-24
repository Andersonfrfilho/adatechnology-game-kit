import type * as THREE from 'three'
import type { SceneNodeLike } from '@adatechnology/golden-tool'

// The page keeps its colours in linear values and reads them back with r128's truncating `getHexString`; the SDK reads the same values the same way (see gallery-models.test.ts).
const legacyHex = (color: THREE.Color): string => (`000000${(((color.r * 255) << 16) ^ ((color.g * 255) << 8) ^ ((color.b * 255) << 0)).toString(16)}`).slice(-6)

/** A three.js node as the hashing tool of the goldens reads it. */
export const asGalleryNode = (node: THREE.Object3D): SceneNodeLike => {
  const mesh = node as THREE.Mesh
  const material = mesh.material as THREE.MeshStandardMaterial | undefined
  return {
    type: node.type,
    name: node.name,
    visible: node.visible,
    position: node.position,
    quaternion: node.quaternion,
    scale: node.scale,
    traverse: (visit) => node.traverse((child) => visit(asGalleryNode(child))),
    ...(mesh.geometry ? { geometry: mesh.geometry } : {}),
    ...(material ? { material: { type: material.type, color: { getHexString: () => legacyHex(material.color) }, opacity: material.opacity } } : {}),
  }
}
