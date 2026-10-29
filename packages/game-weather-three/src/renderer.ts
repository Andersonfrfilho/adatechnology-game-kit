import type * as THREE_NS from 'three'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { Puddle } from '@adatechnology/game-vfx'
import { createFog, emitAirborne } from './fog'
import type { Fog } from './fog'
import { createHeadlights } from './headlights'
import type { HeadlightRules, Headlights } from './headlights'
import { createHeatHaze } from './heat-haze'
import type { HeatHaze } from './heat-haze'
import { createLightning } from './lightning'
import type { Lightning } from './lightning'
import { createNearRain } from './rain-near'
import type { NearRain } from './rain-near'
import { createRainCurtain } from './rain-curtain'
import type { RainCurtain } from './rain-curtain'
import { createSky } from './sky'
import type { Sky } from './sky'
import type { ThreeLib, Vec3, WeatherProfileName, WeatherSource, ZoneFog } from './types'

/** The parts the renderer draws, each of which a layer switches. */
export const WEATHER_LAYERS = ['far_rain', 'near_rain', 'mist', 'fog', 'sky', 'lightning', 'headlights', 'haze'] as const
export type WeatherLayerId = (typeof WEATHER_LAYERS)[number]

export type WeatherRendererOptions = {
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.Camera
  readonly weather: WeatherSource
  /** The effects world: near rain, splashes, mist, ash, the white of lightning and the lit drops of headlights live in its Workshop pools (game-vfx-three draws them). */
  readonly vfx?: VfxWorld
  readonly profile?: WeatherProfileName
  /** Seeds the rain curtain (default `Math.random`). */
  readonly random?: () => number
  readonly zone?: ZoneFog
  readonly puddles?: readonly Puddle[]
  readonly puddleAt?: (x: number, z: number) => boolean
  readonly headlights?: HeadlightRules
  readonly layers?: Partial<Record<WeatherLayerId, boolean>>
}

export type WeatherRenderer = {
  readonly curtain: RainCurtain
  readonly nearRain: NearRain
  readonly fog: Fog
  readonly sky: Sky
  readonly lightning: Lightning
  readonly headlights: Headlights
  readonly haze: HeatHaze
  /** Draws the weather of the source for a frame of `dt` seconds. Call once per frame, after the weather advanced. */
  update(dt: number): void
  setLayer(id: WeatherLayerId, on: boolean): void
  layer(id: WeatherLayerId): boolean
  setZoneFog(zone: ZoneFog | undefined): void
  setProfile(profile: WeatherProfileName): void
  stats(): { readonly rainCurtain: number; readonly rainNear: number; readonly cars: number }
  dispose(): void
}

/** The whole weather picture: rain curtain, near rain with splashes, mist and ash, fog, sky, lightning, headlights and heat haze, from one `WeatherSource`. */
export function createWeatherRenderer(THREE: ThreeLib, options: WeatherRendererOptions): WeatherRenderer {
  const { scene, camera, weather, vfx } = options
  const group = new THREE.Group()
  group.name = 'weather'
  scene.add(group)
  const curtain = createRainCurtain(THREE, { ...(options.random ? { random: options.random } : {}), ...(options.profile ? { profile: options.profile } : {}) })
  const haze = createHeatHaze(THREE)
  group.add(curtain.object, haze.object)
  const sky = createSky(THREE, scene)
  const fog = createFog(THREE, scene)
  const lightning = createLightning(THREE, scene, vfx)
  const headlights = createHeadlights(THREE, options.headlights)
  const nearRain = createNearRain(vfx, { ...(options.puddles ? { puddles: options.puddles } : {}), ...(options.puddleAt ? { puddleAt: options.puddleAt } : {}) })
  const on = new Map<WeatherLayerId, boolean>(WEATHER_LAYERS.map((id) => [id, options.layers?.[id] ?? true]))
  let zone = options.zone
  let time = 0
  const eye: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

  const switchedOff = (id: WeatherLayerId): void => {
    if (id === 'far_rain') curtain.object.visible = false
    else if (id === 'near_rain') nearRain.clear()
    else if (id === 'fog') fog.clear()
    else if (id === 'lightning') lightning.light.intensity = 0
    else if (id === 'haze') haze.object.visible = false
  }

  return {
    curtain,
    nearRain,
    fog,
    sky,
    lightning,
    headlights,
    haze,
    update(dt) {
      time += dt
      const sample = weather.sample()
      const position = camera.position
      eye.x = position.x
      eye.y = position.y
      eye.z = position.z
      const where: Vec3 = [eye.x, eye.y, eye.z]
      const background = (scene.background as THREE_NS.Color | null) ?? undefined
      const ownSky = on.get('sky') === true
      const color = ownSky ? sky.update(sample, zone) : background && (background as { isColor?: boolean }).isColor ? background : sky.color
      if (on.get('fog')) fog.update(sample, color, zone)
      if (on.get('lightning')) lightning.update(sample, ownSky ? (scene.background as THREE_NS.Color) : undefined)
      if (on.get('far_rain')) curtain.update(sample, eye, time, sample.sun)
      if (on.get('haze')) haze.update(sample, time)
      if (vfx) {
        if (on.get('near_rain')) nearRain.update(sample, dt, where)
        if (on.get('mist')) emitAirborne(vfx.workshop(), sample, dt, where)
      }
      headlights.update(sample, dt, where, vfx && sample.rain > 0 ? vfx.workshop() : undefined, on.get('headlights'))
    },
    setLayer(id, value) {
      on.set(id, value)
      if (!value) switchedOff(id)
    },
    layer: (id) => on.get(id) === true,
    setZoneFog(next) {
      zone = next
    },
    setProfile(profile) {
      curtain.setProfile(profile)
    },
    stats: () => ({ rainCurtain: curtain.drawn(), rainNear: nearRain.count(), cars: headlights.count() }),
    dispose() {
      scene.remove(group)
      curtain.dispose()
      haze.dispose()
      lightning.dispose()
      headlights.dispose()
      nearRain.clear()
    },
  }
}
