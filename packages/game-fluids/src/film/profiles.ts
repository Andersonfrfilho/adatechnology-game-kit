import profilesData from '../data/film-profiles.json'
import type { LiquidId } from '../types'
import type { FilmProfile } from './types'

/** Film profiles of the liquids that run as a film (F46-55, plus the Workshop's `spikes` and `landsAsBlob`). Data in `data/film-profiles.json`. */
export const FILM_PROFILES: FilmProfile[] = profilesData as unknown as FilmProfile[]

/** The profile of a liquid with the given overrides, or undefined when the liquid has no film. */
export function filmProfileOf(id: LiquidId, overrides: Partial<FilmProfile> = {}): FilmProfile | undefined {
  const profile = FILM_PROFILES.find((entry) => entry.id === id)
  return profile ? { ...profile, ...overrides } : undefined
}
