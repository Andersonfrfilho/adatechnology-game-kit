import type * as THREE_NS from 'three'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { ThreeLib, ZoneFog } from './types'

/** The colours of the game's `skyUpdate` (jogo.js `_skyN` and `_skyD`): the sky goes from the night one to the day one with the sun height. */
export const SKY_NIGHT = 0x0b0f18
export const SKY_DAY = 0x8796a6
/** The zone fog colour is lit by `0.35 + 0.65 s` (the page's `ZONA_NEBLINA` blend). */
export const ZONE_LIGHT = { base: 0.35, sun: 0.65 } as const
/** The page's zone fog (`ZONA_NEBLINA`): colour and far distance; its weight is the game's to set. */
export const ZONE_FOG_DEFAULTS = { color: 0x3a4a3a, far: 60 } as const

export type Sky = {
  /** The sky colour for this weather: night to day by `sample.sun`, dimmed by `sample.skyScale` (the page's 0.8 in rain), pulled to the zone colour by its weight. */
  update(sample: WeatherSample, zone?: ZoneFog): THREE_NS.Color
  readonly color: THREE_NS.Color
}

/** Writes the sky into `scene.background` (a `Color`; made when the scene has none) and hands the colour to the fog. */
export function createSky(THREE: ThreeLib, scene: { background: unknown }): Sky {
  const night = new THREE.Color(SKY_NIGHT)
  const day = new THREE.Color(SKY_DAY)
  const zoneColor = new THREE.Color(ZONE_FOG_DEFAULTS.color)
  const tint = new THREE.Color()
  const color = new THREE.Color()
  return {
    color,
    update(sample, zone) {
      color.lerpColors(night, day, sample.sun)
      color.multiplyScalar(sample.skyScale)
      if (zone && zone.weight > 0) {
        zoneColor.setHex(zone.color ?? ZONE_FOG_DEFAULTS.color)
        color.lerp(tint.copy(zoneColor).multiplyScalar(ZONE_LIGHT.base + sample.sun * ZONE_LIGHT.sun), zone.weight)
      }
      const background = scene.background as THREE_NS.Color | null | undefined
      if (background && (background as { isColor?: boolean }).isColor) background.copy(color)
      else scene.background = color.clone()
      return color
    },
  }
}
