import { snapshotScene } from '@adatechnology/golden-tool'
import type { SceneNodeLike } from '@adatechnology/golden-tool'
import * as THREE from 'three'

import type { DocumentLike } from '../src'

/** A canvas 2d context that accepts everything and does nothing. */
export const stubDocument = (): DocumentLike => {
  const gradient = { addColorStop() {} }
  const context = new Proxy({}, { get: (_target, key) => (key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : key === 'getImageData' ? (_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) : () => {}), set: () => true })
  return { createElement: () => ({ width: 0, height: 0, getContext: () => context }) }
}

/** three r128 (the page) truncates `r * 255` where r160 rounds it; the two differ for a colour that was lerped. */
const r128HexString = (color: THREE.Color): string => `000000${(((color.r * 255) << 16) ^ ((color.g * 255) << 8) ^ ((color.b * 255) << 0)).toString(16)}`.slice(-6)

export const asSceneNode = (node: THREE.Object3D): SceneNodeLike => {
  const mesh = node as THREE.Mesh
  const material = mesh.material as THREE.MeshStandardMaterial | undefined
  return {
    type: node.type,
    name: node.name,
    visible: node.visible,
    position: node.position,
    quaternion: node.quaternion,
    scale: node.scale,
    traverse: (visit) => node.traverse((child) => visit(asSceneNode(child))),
    ...(mesh.geometry ? { geometry: mesh.geometry } : {}),
    ...(material ? { material: { type: material.type, color: { getHexString: () => r128HexString(material.color) }, opacity: material.opacity } } : {}),
  }
}

export const snapshotOf = (root: THREE.Object3D) => snapshotScene(asSceneNode(root))
