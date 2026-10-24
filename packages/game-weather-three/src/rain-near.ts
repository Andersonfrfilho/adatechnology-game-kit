import type { Puddle, VfxWorld } from '@adatechnology/game-vfx'
import { inPuddle } from '@adatechnology/game-vfx'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { Vec3 } from './types'

/** The rain (mm/h) from which a drop that lands splashes (the Workshop's garoa, 2.5, does not; its chuva, 15, does). */
export const SPLASH_FROM_MM = 5

export type NearRainOptions = {
  /** Ground ellipses where a drop leaves a ring (the Workshop's four dark puddles; a game has its own). None by default. */
  readonly puddles?: readonly Puddle[]
  /** Replaces the puddle test. */
  readonly puddleAt?: (x: number, z: number) => boolean
  readonly splashFrom?: number
}

export type NearRain = {
  update(sample: WeatherSample, dt: number, camera: Vec3): void
  /** Streaks alive. */
  count(): number
  clear(): void
}

/**
 * The Workshop's near rain (W313-331) driven by the weather: the streaks live in the world's Workshop engine (`engine.rain`), game-vfx-three draws them, and the
 * splashes and rings they leave go to the `normal` sprite pool and the rings. `drops` (900 garoa, 2 200 chuva, 4 000 temporal) and the wind along x are the Workshop's own
 * numbers for its three intensities.
 */
export function createNearRain(vfx: VfxWorld | undefined, options: NearRainOptions = {}): NearRain {
  const puddles = options.puddles ?? []
  return {
    update(sample, dt, camera) {
      const raining = sample.rain > 0
      const engine = raining ? vfx?.workshop() : vfx?.peekWorkshop()
      if (!engine) return
      const field = engine.rain
      if (!raining) {
        if (field.on) field.clear()
        return
      }
      field.puddleAt = options.puddleAt ?? ((x, z) => inPuddle(puddles, x, z))
      field.drive(sample.drops, sample.windX, camera[0], camera[2])
      field.update(dt, sample.rain >= (options.splashFrom ?? SPLASH_FROM_MM), camera)
    },
    count: () => vfx?.peekWorkshop()?.rain.count ?? 0,
    clear() {
      vfx?.peekWorkshop()?.rain.clear()
    },
  }
}
