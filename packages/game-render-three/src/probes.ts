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

const SHADOW_PROBE_SIDES = ['FrontSide', 'BackSide', 'DoubleSide'] as const

/**
 * Shadow casters drawn into every shadow map at load: a lit material with and without a map, on each side. three r160 links the depth (directional,
 * spot) and distance (point) programs only in the shadow pass (`compile` never does), keyed by the caster's map and side; a textured wall that first
 * enters a shadow camera in play (the sun's box follows the player) links its `USE_MAP` depth program in the middle of a frame otherwise.
 */
export function shadowCasterProbes(THREE: Pick<ThreeLib, 'Group' | 'Mesh' | 'MeshLambertMaterial' | 'DataTexture' | 'BufferGeometry' | 'BufferAttribute' | (typeof SHADOW_PROBE_SIDES)[number]>): WarmupProbe {
  return {
    id: 'shadow-casters',
    build() {
      const group = new THREE.Group()
      const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
      texture.needsUpdate = true
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0]), 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
      const materials = SHADOW_PROBE_SIDES.flatMap((side) => [undefined, texture].map((map) => new THREE.MeshLambertMaterial({ side: THREE[side], ...(map ? { map } : {}) })))
      for (const material of materials) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        // inside every shadow camera, wherever the lights are
        mesh.frustumCulled = false
        group.add(mesh)
      }
      return { group, materials, dispose: () => (geometry.dispose(), texture.dispose()) }
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
