import type { Object3D } from 'three'

import type { ThreeLib } from './three-lib'
import type { WarmupProbe } from './warmup-types'

/** The sprite probes the room builds by hand today: one sprite material with fog and one without. */
export function spriteProbes(THREE: Pick<ThreeLib, 'Group' | 'Sprite' | 'SpriteMaterial' | 'DataTexture'>): WarmupProbe {
  return {
    id: 'sprite',
    build() {
      const group = new THREE.Group()
      const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
      texture.needsUpdate = true
      const materials = [true, false].map((fog) => new THREE.SpriteMaterial({ map: texture, fog, transparent: true }))
      for (const material of materials) group.add(new THREE.Sprite(material))
      return { group, materials, dispose: () => texture.dispose() }
    },
  }
}

export function hasMissingDistanceMaterial(root: Object3D): string | undefined {
  let found: string | undefined
  root.traverse((object) => {
    const mesh = object as { isInstancedMesh?: boolean; castShadow?: boolean; customDepthMaterial?: unknown; customDistanceMaterial?: unknown }
    if (found === undefined && mesh.isInstancedMesh === true && mesh.castShadow === true && mesh.customDepthMaterial && !mesh.customDistanceMaterial) found = object.name || object.type
  })
  return found
}
