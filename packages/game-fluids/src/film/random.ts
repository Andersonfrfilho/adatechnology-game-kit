import type { FilmRandom } from './types'

export type FilmLcg = FilmRandom & { seed: number }

/** The Fluid Standard's generator (LCG 1664525 / 1013904223). `seed` can be read and set, so a scene can be restarted from a number. */
export function createFilmLcg(seed: number): FilmLcg {
  const lcg = (() => {
    lcg.seed = (lcg.seed * 1664525 + 1013904223) >>> 0
    return lcg.seed / 4294967296
  }) as FilmLcg
  lcg.seed = seed >>> 0
  return lcg
}
