import type { AudioSink, LoopHandle, Vec3 } from '@adatechnology/game-contracts'

import type { Strike, WeatherSample } from '../types'
import { WEATHER_BANK } from './recipes'

export type WeatherSoundStyle = 'art_scene' | 'game'

export type WeatherSoundOptions = {
  /** Which team's rain: `art_scene` (default, the kit mix) or `game` (a highpass hiss). The wind and the thunder are the same. */
  readonly style?: WeatherSoundStyle
  /**
   * Level of the rain loop. It is `light` at `lightAt` mm/h (the game's rain, 0.035) and `heavy` from `heavyAt` mm/h (the art scene's, 0.06), a straight
   * line between, and 0 when it does not rain.
   */
  readonly rain?: { readonly light?: number; readonly heavy?: number; readonly lightAt?: number; readonly heavyAt?: number }
  /** Level of the wind loop: `base` (the art scene's 0.05) at `referenceSpeed` m/s, in proportion to the speed, at most `max`. */
  readonly wind?: { readonly base?: number; readonly referenceSpeed?: number; readonly max?: number }
  /** Where the listener is, to place the thunder around it (default the origin). */
  readonly listener?: () => Vec3
  /** Level of the thunder (default 1). */
  readonly thunderVolume?: number
  /** `false` keeps the sink's bank as it is (the host registered `WEATHER_BANK` itself). */
  readonly register?: boolean
}

export const DEFAULT_RAIN_SOUND = { light: 0.035, heavy: 0.06, lightAt: 2.5, heavyAt: 15 } as const
/** The art scene opens its wind at 0.05 with the breeze of its day (3.8 m/s, the `clear` state's wind): the level follows the speed from there. */
export const DEFAULT_WIND_SOUND = { base: 0.05, referenceSpeed: 3.8, max: 0.12 } as const

/** The level of the rain loop for `rain` mm/h. */
export function rainVolume(rain: number, options: WeatherSoundOptions['rain'] = {}): number {
  if (!(rain > 0)) return 0
  const { light, heavy, lightAt, heavyAt } = { ...DEFAULT_RAIN_SOUND, ...options }
  if (heavyAt <= lightAt) return rain >= heavyAt ? heavy : light
  const t = Math.min(1, Math.max(0, (rain - lightAt) / (heavyAt - lightAt)))
  return light + (heavy - light) * t
}

/** The level of the wind loop for a wind of `speed` m/s. */
export function windVolume(speed: number, options: WeatherSoundOptions['wind'] = {}): number {
  const { base, referenceSpeed, max } = { ...DEFAULT_WIND_SOUND, ...options }
  return Math.min(max, (base * Math.max(0, speed)) / referenceSpeed)
}

/** Where a strike is, around `origin`: `bearing` is degrees clockwise from north, and north is -z. */
export function strikePosition(strike: Pick<Strike, 'distance' | 'bearing'>, origin: Vec3 = [0, 0, 0]): Vec3 {
  const angle = (strike.bearing * Math.PI) / 180
  return [origin[0] + Math.sin(angle) * strike.distance, origin[1], origin[2] - Math.cos(angle) * strike.distance]
}

export type WeatherSound = {
  /** Sets the level of the loops from the weather of now (opens a loop the first time it is above 0). */
  update(sample: Pick<WeatherSample, 'rain' | 'windSpeed'>): void
  /** Plays a clap of thunder at the strike (call it when the thunder arrives: the weather delays it by `distance / 343`). */
  thunder(strike: Pick<Strike, 'distance' | 'bearing'>): void
  dispose(): void
}

/** The sound of the weather on the host's `audio`: the rain loop, the wind loop and the thunder. Without a sink (or one without loops) it does nothing. */
export function createWeatherSound(sink: AudioSink | undefined, options: WeatherSoundOptions = {}): WeatherSound {
  if (sink && options.register !== false) sink.register?.(WEATHER_BANK)
  const rainSound = options.style === 'game' ? 'rain_hiss_game' : 'rain_loop'
  const loops = new Map<string, LoopHandle>()
  const set = (id: string, volume: number): void => {
    let loop = loops.get(id)
    if (!loop) {
      if (!(volume > 0) || !sink?.loop) return
      loop = sink.loop(id)
      loops.set(id, loop)
    }
    loop.set({ volume })
  }
  return {
    update(sample) {
      set(rainSound, rainVolume(sample.rain, options.rain))
      set('wind_loop', windVolume(sample.windSpeed, options.wind))
    },
    thunder(strike) {
      sink?.play({ sound: 'thunder', position: strikePosition(strike, options.listener?.()), ...(options.thunderVolume === undefined ? {} : { volume: options.thunderVolume }) })
    },
    dispose() {
      for (const loop of loops.values()) loop.stop()
      loops.clear()
    },
  }
}
