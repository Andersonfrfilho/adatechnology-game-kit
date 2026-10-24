import type { AudioSink, EnvironmentBus, EnvironmentState } from '@adatechnology/game-contracts'

import { createWeatherSound } from './audio/sound'
import type { WeatherSound, WeatherSoundOptions } from './audio/sound'
import type { Strike, WeatherSample } from './types'
import type { Weather } from './weather'

/** The shape of the film of `game-fluids-three` (`FilmBridge`) this needs: no import, so the weather does not depend on it. */
export type FilmTarget = {
  setWeather(weather: { rain: number; drying?: number }): void
  wash?(maxDryness?: number): number
}
/** The interactables world (`game-interactables`): its water takes the rain, the soft volumes the wind. */
export type InteractablesTarget = { water: { setRain(mmPerHour: number): void }; setWind(x: number, z: number): void }
/** The vegetation renderer (`game-vegetation`). `direction` is normalised by the renderer, `strength` and `gust` are 0..1. */
export type VegetationTarget = { setWind(wind: { direction?: [number, number]; strength?: number; gust?: number }): void }
/** The effects world (`game-vfx`'s `VfxWorld`): smoke and dust drift with its wind. */
export type VfxTarget = { setWind(wind: readonly [number, number, number]): void }

export type WeatherTargets = {
  readonly film?: FilmTarget
  readonly interactables?: InteractablesTarget
  readonly vegetation?: VegetationTarget
  readonly vfx?: VfxTarget
  /** The host's environment bus (`ModuleHost.environment`). */
  readonly environment?: Pick<EnvironmentBus, 'set'>
  /** The host's sound (`ModuleHost.audio`): the rain and wind loops, and the thunder. */
  readonly audio?: AudioSink
}

/** The rules the bridges apply; every number can be replaced. */
export type WeatherBridgeRules = {
  /** Rain in mm/h at which the film counts as fully rained on (it stops drying, spreads 1.5 times faster). Default 2.5, the light rain. */
  readonly filmRainFullAt?: number
  /** Rain in mm/h from which the rain washes the fresh stain (Workshop and visor: heavy rain and stronger). Default 15; light rain does not wash. */
  readonly washFrom?: number
  /** Stains less dry than this are washed (visor L13494). Default 0.5. */
  readonly washBelow?: number
  /** Seconds between two washes while it pours. Default 1. */
  readonly washEvery?: number
  /** Wind speed in m/s that is 1 for the vegetation (`strength = min(1, speed / this)`). Default 20. */
  readonly windFull?: number
}

export type WeatherBridgeOptions = WeatherBridgeRules & {
  readonly sound?: WeatherSoundOptions | false
}

export const DEFAULT_BRIDGE_RULES = { filmRainFullAt: 2.5, washFrom: 15, washBelow: 0.5, washEvery: 1, windFull: 20 } as const

/** The weather as the environment bus holds it. */
export function environmentOf(sample: WeatherSample): Partial<EnvironmentState> {
  return {
    rain: sample.rain,
    windX: sample.windX,
    windZ: sample.windZ,
    windSpeed: sample.windSpeed,
    gust: sample.gust,
    fogFar: sample.fogFar,
    visibility: sample.effects.visibility,
    nightFactor: sample.nightFactor,
    temperatureC: sample.temperatureC,
    wetness: sample.groundWetness,
  }
}

export type WeatherBridges = {
  /** Follows this weather (the one before is let go) and pushes its values at once. */
  bind(weather: Weather): void
  /** Pushes the weather of now to every target; call it each frame after `weather.advance(dt)`. */
  update(dt: number): void
  dispose(): void
}

/**
 * Pushes one weather to the packages that react to it, each through a small interface of its own, so the weather depends on none of them and every
 * target is optional:
 * - fluids film: `setWeather({ rain: min(1, rain / filmRainFullAt), drying: dryingScale })`, and `wash()` every `washEvery` seconds while the rain is at
 *   `washFrom` or stronger (light rain stops the drying and does not wash);
 * - interactables: `water.setRain(mm/h)` and `setWind(x, z)`;
 * - vegetation: `setWind({ direction: [x, z], strength: min(1, speed / windFull), gust: min(1, gust / windFull) })`;
 * - vfx: `setWind([x, 0, z])`;
 * - the environment bus: every value of `environmentOf`;
 * - sound: the rain and wind loops follow the weather, and each thunder that arrives plays at its bearing.
 */
export function createWeatherBridges(targets: WeatherTargets, options: WeatherBridgeOptions = {}): WeatherBridges {
  const rules = { ...DEFAULT_BRIDGE_RULES, ...options }
  const sound: WeatherSound | undefined = options.sound === false || !targets.audio ? undefined : createWeatherSound(targets.audio, options.sound ?? {})
  let weather: Weather | undefined
  let offThunder: (() => void) | undefined
  let sinceWash = 0
  let last: { rain?: number; windX?: number; windZ?: number; filmRain?: number; drying?: number } = {}

  const push = (): void => {
    if (!weather) return
    const sample = weather.sample()
    const { film, interactables, vegetation, vfx, environment } = targets
    environment?.set(environmentOf(sample))
    if (film) {
      const rain = Math.min(1, Math.max(0, sample.rain / rules.filmRainFullAt))
      const drying = sample.effects.dryingScale
      if (rain !== last.filmRain || drying !== last.drying) film.setWeather({ rain, drying })
      last.filmRain = rain
      last.drying = drying
    }
    if (interactables && sample.rain !== last.rain) interactables.water.setRain(sample.rain)
    const windChanged = sample.windX !== last.windX || sample.windZ !== last.windZ
    if (windChanged) {
      interactables?.setWind(sample.windX, sample.windZ)
      vfx?.setWind([sample.windX, 0, sample.windZ])
      if (vegetation) {
        const wind = { strength: Math.min(1, sample.windSpeed / rules.windFull), gust: Math.min(1, sample.gust / rules.windFull) }
        vegetation.setWind(sample.windSpeed > 1e-6 ? { direction: [sample.windX, sample.windZ], ...wind } : wind)
      }
    }
    last = { ...last, rain: sample.rain, windX: sample.windX, windZ: sample.windZ }
    sound?.update(sample)
  }

  const onThunder = (strike: Strike): void => sound?.thunder(strike)

  return {
    bind(next) {
      offThunder?.()
      weather = next
      offThunder = next.on('thunder', onThunder)
      last = {}
      sinceWash = 0
      push()
    },
    update(dt) {
      push()
      if (!weather || !targets.film?.wash) return
      if (weather.sample().rain < rules.washFrom) {
        sinceWash = 0
        return
      }
      sinceWash += dt
      if (sinceWash >= rules.washEvery) {
        sinceWash = 0
        targets.film.wash(rules.washBelow)
      }
    },
    dispose() {
      offThunder?.()
      offThunder = undefined
      weather = undefined
      sound?.dispose()
    },
  }
}
