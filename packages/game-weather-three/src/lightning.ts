import type * as THREE_NS from 'three'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { ThreeLib } from './types'

/**
 * What the Workshop's double flash does to the scene (W1072): the hemisphere light gains `I * 3.2`, the background gains `I * (.25, .27, .32)` and the screen goes
 * white by `I * .12`, where `I` is the flash the weather samples (1, then .2, then .8 for 0.26 s).
 */
export const LIGHTNING = { light: 3.2, background: [0.25, 0.27, 0.32], white: 0.12, skyColor: 0x3a4c6a, groundColor: 0x0b0b0c } as const

export type Lightning = {
  readonly light: THREE_NS.HemisphereLight
  /**
   * Lights the scene with the flash of `sample`. `background`, when given, is the sky just written for this frame (the renderer passes it only when it owns the sky),
   * and gains the flash; a background the host keeps for itself is left alone.
   */
  update(sample: WeatherSample, background?: THREE_NS.Color): void
  dispose(): void
}

export function createLightning(THREE: ThreeLib, scene: { add(object: THREE_NS.Object3D): unknown; remove(object: THREE_NS.Object3D): unknown }, vfx?: VfxWorld): Lightning {
  const light = new THREE.HemisphereLight(LIGHTNING.skyColor, LIGHTNING.groundColor, 0)
  light.name = 'weather-lightning'
  scene.add(light)
  return {
    light,
    update(sample, background) {
      const flash = sample.flash
      light.intensity = flash * LIGHTNING.light
      if (flash <= 0) return
      if (background) {
        background.r += flash * LIGHTNING.background[0]!
        background.g += flash * LIGHTNING.background[1]!
        background.b += flash * LIGHTNING.background[2]!
      }
      const screen = vfx?.workshop().screen
      if (screen) screen.white = Math.max(screen.white, flash * LIGHTNING.white)
    },
    dispose() {
      scene.remove(light)
      light.dispose()
    },
  }
}
