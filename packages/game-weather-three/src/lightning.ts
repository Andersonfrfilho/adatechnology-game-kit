import type * as THREE_NS from 'three'
import type { LightBudget } from '@adatechnology/game-render-three'
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

export type LightningOptions = {
  /**
   * The host's light budget: the flash uses one of its hemisphere slots (leased for good) instead of a light of its own, so the weather coming up in the middle of the game does not
   * change the number of lights. Without it the light is created here (deprecated, removed in the next major).
   */
  readonly lights?: LightBudget
}

export function createLightning(THREE: ThreeLib, scene: { add(object: THREE_NS.Object3D): unknown; remove(object: THREE_NS.Object3D): unknown }, vfx?: VfxWorld, options: LightningOptions = {}): Lightning {
  const leased = options.lights?.leaseHemisphere('weather.lightning') ?? null
  // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget (or a budget with no hemisphere slot left: then it stays out of the scene), removed in the next major
  const light = leased ?? new THREE.HemisphereLight(LIGHTNING.skyColor, LIGHTNING.groundColor, 0)
  light.name = 'weather-lightning'
  light.color.setHex(LIGHTNING.skyColor)
  light.groundColor.setHex(LIGHTNING.groundColor)
  if (!options.lights) scene.add(light)
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
      light.intensity = 0
      if (options.lights) return
      scene.remove(light)
      light.dispose()
    },
  }
}
