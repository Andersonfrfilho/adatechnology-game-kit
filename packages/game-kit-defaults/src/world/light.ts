import type * as THREE_NS from 'three'

import type { Vec3 } from '@adatechnology/game-contracts'

import { snapSunShadow, sunOffsetOf, sunShadowFrustum } from './sun-shadow'
import type { KitWorldQuality, ThreeNamespace } from './view'

/**
 * The ambient fill: sky above, bounce from the ground below (what a slab's underside and a house's shaded rooms are lit by).
 * three.js lights are not pre-multiplied by pi, so the ground bounce needs an intensity of about 5 for light concrete to read light grey; the sky colour is
 * scaled down by the same factor.
 */
export const HEMISPHERE_SKY = 0x5c6573
export const HEMISPHERE_GROUND = 0xa8a8a8
export const HEMISPHERE_INTENSITY = 5
const BACKGROUND_COLOR = 0x9fb4c8
const SUN_COLOR = 0xffffff
const SUN_INTENSITY = 2.1
const SUN_DIRECTION: Vec3 = [7, 13, 8]
const SHADOW_MAP_SIZE = 1024
const SHADOW_MAP_SIZE_HIGH = 2048
const SHADOW_BIAS = -0.0006
const SHADOW_NORMAL_BIAS = 0.03

export type KitWorldLight = {
  readonly group: THREE_NS.Group
  readonly sun: THREE_NS.DirectionalLight
  /** Moves the sun's shadow frustum to the camera (snapped to the shadow map's texels). */
  followSun(focus: Vec3): void
  /** The sun's shadow map for a quality level: 2048 on high, 1024 otherwise. */
  setShadowQuality(quality: KitWorldQuality): void
  dispose(): void
}

export function createLight({ THREE, scene }: { readonly THREE: ThreeNamespace; readonly scene: THREE_NS.Scene }): KitWorldLight {
  const group = new THREE.Group()
  group.name = 'kit-world-light'
  scene.background = new THREE.Color(BACKGROUND_COLOR)
  group.add(new THREE.HemisphereLight(HEMISPHERE_SKY, HEMISPHERE_GROUND, HEMISPHERE_INTENSITY))
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  // set back far enough that the whole cascade fits between its planes
  const offset = sunOffsetOf(SUN_DIRECTION)
  sun.position.set(...offset)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  const shadowCamera = sun.shadow.camera
  Object.assign(shadowCamera, sunShadowFrustum())
  shadowCamera.updateProjectionMatrix()
  sun.shadow.bias = SHADOW_BIAS
  // a texel of the map is 3 cm: a face nearly along the sun shades itself in stripes without pushing the lookup out along its normal
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS
  group.add(sun)
  group.add(sun.target)
  scene.add(group)
  return {
    group,
    sun,
    followSun(focus) {
      const frame = snapSunShadow({ focus: [focus[0], 0, focus[2]], offset, half: shadowCamera.right, mapSize: sun.shadow.mapSize.x })
      sun.target.position.set(...frame.target)
      sun.position.set(...frame.position)
    },
    setShadowQuality(quality) {
      const size = quality === 'high' ? SHADOW_MAP_SIZE_HIGH : SHADOW_MAP_SIZE
      sun.shadow.mapSize.set(size, size)
      sun.shadow.map?.dispose()
      sun.shadow.map = null
    },
    dispose() {
      sun.shadow.map?.dispose()
      group.removeFromParent()
    },
  }
}
