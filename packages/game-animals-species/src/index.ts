/**
 * @adatechnology/game-animals-species: the 13 species of the Bichos do Vale as data for `game-animals`, with `en` and `pt-BR` text. The `outbreak` field is
 * read by `game-characters-undead` and ignored by the engine.
 */
import type { AnimalPack, AnimalSpecies } from '@adatechnology/game-animals'

import speciesData from './data/species.json'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

export type SpeciesLocale = {
  readonly groups: Readonly<Record<string, string>>
  readonly phases: Readonly<Record<string, string>>
  readonly outcomes: Readonly<Record<string, string>>
}

/** The 13 species in the production order of the page. */
export const SPECIES = speciesData as unknown as readonly AnimalSpecies[]
export const SPECIES_LOCALES: Readonly<Record<'en' | 'pt-BR', SpeciesLocale>> = { en, 'pt-BR': ptBR }

export const getSpecies = (id: string): AnimalSpecies | undefined => SPECIES.find((species) => species.id === id)

/** The species as a pack: `createAnimals({ packs: [createSpeciesPack()] })`. */
export const createSpeciesPack = (): AnimalPack => ({ id: 'species', species: SPECIES })
