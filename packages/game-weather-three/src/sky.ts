import type * as THREE_NS from 'three'
import type { WeatherSample } from '@adatechnology/game-weather'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { SKY_FRAGMENT, SKY_VERTEX } from './sky-shader'
import { cloudCoverOf, cloudDarknessOf, nightnessOf, starVisibilityOf, sunDirectionOf, sunsetOf, sunVisibilityOf } from './sky-state'
import type { HostSun } from './sky-state'
import type { ThreeLib, ZoneFog } from './types'

export { cloudCoverOf, cloudDarknessOf, CLOUD_COVER, nightnessOf, starVisibilityOf, sunDirectionOf, sunsetOf, sunVisibilityOf } from './sky-state'
export type { HostSun } from './sky-state'

/** The colours of the game's `skyUpdate` (jogo.js `_skyN` and `_skyD`): the sky goes from the night one to the day one with the sun height. */
export const SKY_NIGHT = 0x0b0f18
export const SKY_DAY = 0x8796a6
/** The zone fog colour is lit by `0.35 + 0.65 s` (the page's `ZONA_NEBLINA` blend). */
export const ZONE_LIGHT = { base: 0.35, sun: 0.65 } as const
/** The page's zone fog (`ZONA_NEBLINA`): colour and far distance; its weight is the game's to set. */
export const ZONE_FOG_DEFAULTS = { color: 0x3a4a3a, far: 60 } as const
/** The dome's colours: the zenith (deep blue by day, black by night), the sunset warmth, the sun, and the cloud tops, undersides and storm underside. */
export const SKY_DOME = {
  zenithDay: 0x3f78c4,
  zenithNight: 0x02040a,
  sunsetTint: 0xff7a3d,
  sunDay: 0xfff4e0,
  sunSet: 0xff9a50,
  cloudDay: 0xf4f6fa,
  cloudOvercast: 0xb8bec6,
  cloudStorm: 0x3e434c,
  cloudNight: 0x1a2030,
  /** How much of the sunset warmth the horizon (and so the fog) takes. */
  fogWarmth: 0.3,
  /** Clouds drift this many noise units per second for each m/s of wind (wind capped at `driftMaxWind`). */
  drift: 0.0025,
  driftMaxWind: 20,
  /** Largest radius of the dome; it is 90 % of the camera's far plane when that is smaller. */
  radius: 900,
  renderOrder: -1000,
} as const

export type SkyOptions = {
  /** The camera the dome follows (centred on it every frame). Without it there is no dome: only the colour. */
  readonly camera?: THREE_NS.Camera
  /** The host's sun (a `DirectionalLight` or anything with `position` and `target.position`): the disc and the glow sit in its direction. Without it the sun follows the hour. */
  readonly sun?: HostSun
}

export type Sky = {
  /** The sky colour for this weather: night to day by `sample.sun`, dimmed by `sample.skyScale` (the page's 0.8 in rain), pulled to the zone colour by its weight. It is also the horizon's colour and the fog's. `dt` (seconds) drifts the clouds and moves the stars. */
  update(sample: WeatherSample, zone?: ZoneFog, dt?: number): THREE_NS.Color
  readonly color: THREE_NS.Color
  /** The dome, to add to the scene (absent without a camera). It follows the camera and renders behind everything. */
  readonly object?: THREE_NS.Mesh
  dispose(): void
}

type DomeUniforms = Record<'uZenith' | 'uHorizon' | 'uTint' | 'uSunDir' | 'uSunColor' | 'uMoonDir' | 'uCloudLit' | 'uCloudShade' | 'uDrift', { value: THREE_NS.Color | THREE_NS.Vector3 }> &
  Record<'uSunsetAmount' | 'uSunVis' | 'uMoonVis' | 'uStars' | 'uCover' | 'uTime' | 'uFlash', { value: number }>

function createDome(THREE: ThreeLib, camera: THREE_NS.Camera): { readonly mesh: THREE_NS.Mesh; readonly uniforms: DomeUniforms; dispose(): void } {
  const vector = (): { value: THREE_NS.Vector3 } => ({ value: new THREE.Vector3() })
  const colour = (hex: number): { value: THREE_NS.Color } => ({ value: new THREE.Color(hex) })
  const uniforms: DomeUniforms = {
    uZenith: colour(SKY_DOME.zenithDay),
    uHorizon: colour(SKY_DAY),
    uTint: colour(SKY_DOME.sunsetTint),
    uSunDir: vector(),
    uSunColor: colour(SKY_DOME.sunDay),
    uMoonDir: vector(),
    uCloudLit: colour(SKY_DOME.cloudDay),
    uCloudShade: colour(SKY_DOME.cloudOvercast),
    uDrift: vector(),
    uSunsetAmount: { value: 0 },
    uSunVis: { value: 0 },
    uMoonVis: { value: 0 },
    uStars: { value: 0 },
    uCover: { value: 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  }
  const geometry = new THREE.SphereGeometry(1, 24, 12)
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false })
  const mesh = markKitOrigin(new THREE.Mesh(geometry, material), { owner: 'game-weather-three', kind: 'effect', id: 'sky-dome' })
  mesh.name = 'sky-dome'
  mesh.renderOrder = SKY_DOME.renderOrder
  mesh.frustumCulled = false
  // the dome is no target: a ray from the player or a bullet goes through it
  mesh.raycast = () => undefined
  const far = (camera as THREE_NS.PerspectiveCamera).far
  mesh.scale.setScalar(far > 0 ? Math.min(SKY_DOME.radius, far * 0.9) : SKY_DOME.radius)
  return {
    mesh,
    uniforms,
    dispose() {
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
    },
  }
}

/** Writes the sky into `scene.background` (a `Color`; made when the scene has none) and hands the colour to the fog; with a `camera` it also builds the dome that draws it. */
export function createSky(THREE: ThreeLib, scene: { background: unknown }, options: SkyOptions = {}): Sky {
  const night = new THREE.Color(SKY_NIGHT)
  const day = new THREE.Color(SKY_DAY)
  const zoneColor = new THREE.Color(ZONE_FOG_DEFAULTS.color)
  const tint = new THREE.Color()
  const color = new THREE.Color()
  const sunsetColor = new THREE.Color(SKY_DOME.sunsetTint)
  const zenithDay = new THREE.Color(SKY_DOME.zenithDay)
  const zenithNight = new THREE.Color(SKY_DOME.zenithNight)
  const sunDay = new THREE.Color(SKY_DOME.sunDay)
  const sunSet = new THREE.Color(SKY_DOME.sunSet)
  const cloudDay = new THREE.Color(SKY_DOME.cloudDay)
  const cloudOvercast = new THREE.Color(SKY_DOME.cloudOvercast)
  const cloudStorm = new THREE.Color(SKY_DOME.cloudStorm)
  const cloudNight = new THREE.Color(SKY_DOME.cloudNight)
  const sunDirection = { x: 0, y: 1, z: 0 }
  const dome = options.camera ? createDome(THREE, options.camera) : undefined
  let time = 0

  const updateDome = (sample: WeatherSample, dt: number): void => {
    if (!dome || !options.camera) return
    const { uniforms, mesh } = dome
    time += dt
    const cover = cloudCoverOf(sample)
    const sunset = sunsetOf(sample)
    const dark = cloudDarknessOf(sample)
    mesh.visible = true
    mesh.position.copy(options.camera.position)
    // the zenith greys into the horizon colour as the cloud thickens
    const zenith = uniforms.uZenith.value as THREE_NS.Color
    zenith.lerpColors(zenithNight, zenithDay, sample.sun).multiplyScalar(sample.skyScale).lerp(color, cover * 0.85)
    ;(uniforms.uHorizon.value as THREE_NS.Color).copy(color)
    const lit = uniforms.uCloudLit.value as THREE_NS.Color
    lit.lerpColors(cloudDay, cloudOvercast, cover * cover).lerp(cloudStorm, dark).lerp(cloudNight, 1 - Math.min(1, sample.sun * 2.2))
    lit.lerp(sunsetColor, sunset * 0.45)
    ;(uniforms.uCloudShade.value as THREE_NS.Color).copy(lit).multiplyScalar(0.62)
    ;(uniforms.uSunColor.value as THREE_NS.Color).lerpColors(sunDay, sunSet, sunset)
    const sunVector = uniforms.uSunDir.value as THREE_NS.Vector3
    sunDirectionOf(sample, options.sun, sunDirection)
    sunVector.set(sunDirection.x, sunDirection.y, sunDirection.z)
    // the moon rides opposite the sun in azimuth and is always above the horizon
    ;(uniforms.uMoonDir.value as THREE_NS.Vector3).set(-sunDirection.x, Math.abs(sunDirection.y) * 0.9 + 0.1, -sunDirection.z).normalize()
    const drift = uniforms.uDrift.value as THREE_NS.Vector3
    drift.x += Math.max(-SKY_DOME.driftMaxWind, Math.min(SKY_DOME.driftMaxWind, sample.windX)) * SKY_DOME.drift * dt
    drift.y += Math.max(-SKY_DOME.driftMaxWind, Math.min(SKY_DOME.driftMaxWind, sample.windZ)) * SKY_DOME.drift * dt
    uniforms.uCover.value = cover
    uniforms.uSunsetAmount.value = sunset
    uniforms.uSunVis.value = sunVisibilityOf(sample)
    uniforms.uMoonVis.value = nightnessOf(sample)
    uniforms.uStars.value = starVisibilityOf(sample)
    uniforms.uTime.value = time
    uniforms.uFlash.value = sample.flash
  }

  return {
    color,
    ...(dome ? { object: dome.mesh } : {}),
    update(sample, zone, dt = 0) {
      color.lerpColors(night, day, sample.sun)
      color.multiplyScalar(sample.skyScale)
      if (dome) color.lerp(sunsetColor, sunsetOf(sample) * SKY_DOME.fogWarmth)
      if (zone && zone.weight > 0) {
        zoneColor.setHex(zone.color ?? ZONE_FOG_DEFAULTS.color)
        color.lerp(tint.copy(zoneColor).multiplyScalar(ZONE_LIGHT.base + sample.sun * ZONE_LIGHT.sun), zone.weight)
      }
      const background = scene.background as THREE_NS.Color | null | undefined
      if (background && (background as { isColor?: boolean }).isColor) background.copy(color)
      else scene.background = color.clone()
      updateDome(sample, dt)
      return color
    },
    dispose() {
      dome?.dispose()
    },
  }
}
