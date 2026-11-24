import type * as THREE_NS from 'three'

import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import { createWeather } from '@adatechnology/game-weather'
import type { Weather } from '@adatechnology/game-weather'
import { createWeatherRenderer } from '@adatechnology/game-weather-three'
import type { WeatherRenderer, ZoneFog } from '@adatechnology/game-weather-three'

/** Game seconds per real second: the weather and the hour are held, so the clock only creeps (the scenario fixes both). */
const HELD_TIME_SCALE = 1
const SUN_INTENSITY_DAY = 2.1
/** The light of an overcast sky and of the night, as a share of the clear day's (the host's lights are the clear day's). */
const MIN_SUN_SHARE = 0.08

export type DistrictWeather = {
  readonly weather: Weather
  readonly renderer: WeatherRenderer
  /** One frame: advances the weather, draws it and dims the host's light to the hour. */
  update(dt: number): void
  dispose(): void
}

/**
 * The weather of the district held at one state and one hour: `game-weather` decides what the sky does and `game-weather-three` draws the rain, the fog and the sky colour; the host's sun and
 * ambient fill follow the daylight the weather reports, so a night is dark and an overcast day flat.
 */
export function createDistrictWeather({ THREE, world, state, hour, seed, fog }: { readonly THREE: typeof THREE_NS; readonly world: KitWorld; readonly state: string; readonly hour: number; readonly seed: number; readonly fog?: ZoneFog }): DistrictWeather {
  const weather = createWeather({ seed, start: state, startHour: hour, timeScale: HELD_TIME_SCALE, autoSchedule: false })
  const renderer = createWeatherRenderer(THREE, { scene: world.view.scene, camera: world.view.camera, weather, vfx: world.effects.world, lights: world.lights, random: world.random, ...(fog === undefined ? {} : { zone: fog }) })
  const ambientDay = world.ambient.intensity
  return {
    weather,
    renderer,
    update(dt) {
      weather.advance(dt)
      renderer.update(dt)
      const daylight = Math.max(MIN_SUN_SHARE, weather.sample().sun)
      world.sun.intensity = SUN_INTENSITY_DAY * daylight
      world.ambient.intensity = ambientDay * daylight
    },
    dispose() {
      renderer.dispose()
    },
  }
}
