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
 * Shadow casters drawn into every shadow map at load: a lit material with and without a map, on each side, plain and instanced. three r160 links the
 * depth (directional, spot) and distance (point) programs only in the shadow pass (`compile` never does), keyed by the caster's map and side. And the
 * shadow pass draws every caster with one shared depth material whose program it picks again only when the caster switches between plain and
 * instanced (or skinned, batched): a textured caster drawn right after a plain one keeps the plain program, and the `USE_MAP` one links later, in play,
 * the first time a textured wall follows an instanced caster (the debris of a blast). Each probe here follows a caster of the other kind, so every
 * variant is picked and linked at load.
 */
export function shadowCasterProbes(
  THREE: Pick<ThreeLib, 'Group' | 'Mesh' | 'InstancedMesh' | 'MeshLambertMaterial' | 'DataTexture' | 'BufferGeometry' | 'BufferAttribute' | (typeof SHADOW_PROBE_SIDES)[number]>,
): WarmupProbe {
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
      const instanced: Array<InstanceType<typeof THREE.InstancedMesh>> = []
      for (const material of materials) {
        // instanced, then plain: the shadow pass picks the depth program again for each, with this material's map and side
        const batch = new THREE.InstancedMesh(geometry, material, 1)
        instanced.push(batch)
        for (const caster of [batch, new THREE.Mesh(geometry, material)]) {
          caster.castShadow = true
          caster.receiveShadow = true
          // inside every shadow camera, wherever the lights are
          caster.frustumCulled = false
          group.add(caster)
        }
      }
      return {
        group,
        materials,
        dispose() {
          // the instance matrices are buffers of their own
          for (const batch of instanced) batch.dispose()
          geometry.dispose()
          texture.dispose()
        },
      }
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
