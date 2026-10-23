import type { Archetype, PlantSpec } from '@adatechnology/game-vegetation'

export type Climate = 'tropical' | 'subtropical' | 'arid' | 'temperate'
export type SpeciesSize = 's' | 'm' | 'l'
export type Locale = 'pt-BR' | 'en'

/** One plant species. `params` holds the archetype parameters; colors are `#rrggbb` strings in the data files. */
export interface Species {
  id: string
  archetype: Archetype
  params: Record<string, unknown>
  /** free-form tags such as tree, fruit, flowering, cactus, indoor, hedge, palm, street, ground... */
  tags: string[]
  climate: Climate[]
  size: SpeciesSize
  /** true when the plant has a collider (trunks, cacti, pots); foliage never blocks the player */
  solid: boolean
}

export interface LocaleEntry {
  name: string
  description: string
}
export type LocaleTable = Record<string, LocaleEntry>

export interface WeightedSpecies {
  species: string
  weight: number
}
/** Regions are data: which species are common in which context of an urban area. */
export interface Region {
  id: string
  name: string
  contexts: Record<string, WeightedSpecies[]>
}

export type { PlantSpec }
