import { createStream, drawBetween } from './rng'
import type { LightningConfig } from './types'

/** Speed of sound in air, m/s: a physical constant, so it is not configurable. */
export const SPEED_OF_SOUND = 343

/** Seconds a flash goes on after a strike before the scene is back to normal (Workshop W1068: `k > .4`). */
export const FLASH_END_SECONDS = 0.4

/** Seconds from the flash to the thunder for a strike `distance` metres away. */
export function thunderDelay(distance: number): number {
  return distance / SPEED_OF_SOUND
}

/** The Workshop double flash (W1068): full for 0.08 s, 0.2 until 0.16 s, 0.8 until 0.26 s, then dark. `elapsed` is seconds since the strike. */
export function flashIntensity(elapsed: number): number {
  if (elapsed < 0 || elapsed >= FLASH_END_SECONDS) return 0
  if (elapsed < 0.08) return 1
  if (elapsed < 0.16) return 0.2
  if (elapsed < 0.26) return 0.8
  return 0
}

export type LightningStream = {
  /** Seconds from entering a state with lightning to its first strike. */
  first(config: LightningConfig): number
  /** Seconds from a strike to the next one. */
  interval(config: LightningConfig): number
  /** Where a strike lands: metres and degrees clockwise from north. Draws the distance, then the bearing. */
  place(config: LightningConfig): { readonly distance: number; readonly bearing: number }
}

/** The lightning's own seeded stream, apart from the scheduler's: the server can send the seed and every client sees the same strikes. */
export function createLightningStream(seed: number): LightningStream {
  const rng = createStream(seed, 'lightning')
  return {
    first: (config) => drawBetween(rng, config.first),
    interval: (config) => drawBetween(rng, config.interval),
    place(config) {
      const distance = drawBetween(rng, config.distance)
      return { distance, bearing: rng() * 360 }
    },
  }
}
