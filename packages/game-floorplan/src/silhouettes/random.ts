import type { RandomSource } from './types'

/** The page's own seeded generator (mulberry32), so a silhouette drawn from the same seed has the same windows and colours. */
export function createSilhouetteRandom(seed: number): RandomSource {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
