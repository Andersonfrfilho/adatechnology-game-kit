import type { AnimalSpecies } from '@adatechnology/game-animals'

import type { DocumentLike } from '../types'

/** The part of the outbreak rule the area uses (`createAnimalOutbreak` of game-characters-undead has all of it). */
export type OutbreakLike = {
  enabled: boolean
  bite(speciesId: string, random: () => number, now: number): { readonly speciesId: string; readonly outcome: 'turns' | 'dies'; readonly bittenAt: number; readonly dueAt: number } | undefined
  stateOf(fate: { readonly speciesId: string; readonly outcome: 'turns' | 'dies'; readonly bittenAt: number; readonly dueAt: number }, now: number): 'incubating' | 'turned' | 'dead'
  carcass(speciesId: string, position: readonly [number, number, number], now: number): { readonly lureRadiusMetres: number } | undefined
  lures(carcass: { readonly lureRadiusMetres: number }, distance: number, now: number): boolean
}

export type AnimalsTestOptions = {
  /** `en` or `pt-BR` (default). */
  readonly locale?: string
  /** The species to lay out (the 13 of `@adatechnology/game-animals-species`). */
  readonly species?: readonly AnimalSpecies[]
  /** Builds the outbreak rule for the bench (`createAnimalOutbreak` from game-characters-undead): called again when the clock changes. Without it the bite actions do nothing. */
  readonly createOutbreak?: (options: { readonly species: readonly AnimalSpecies[]; readonly enabled: boolean; readonly timeScale: number }) => OutbreakLike
  readonly document?: DocumentLike
  /** Seed of the draws of the area (default 7, the page's). */
  readonly seed?: number
}
