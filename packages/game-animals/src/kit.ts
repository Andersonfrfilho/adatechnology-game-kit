import { GAIT_PHASES } from './gaits'
import { applyPatches, mergeById, removeIds } from './registry'
import type { AnimalGaitName, AnimalOutcome, AnimalSpecies, AnimalVisualState, AnimalsOptions, GaitPhases } from './types'

export type AnimalKit = {
  readonly species: readonly AnimalSpecies[]
  get(id: string): AnimalSpecies | undefined
  gait(name: AnimalGaitName): GaitPhases
}

/**
 * What a bite does to the look of an animal: a species that turns shows the infected look, one that dies shows the dead look, and an immune one shows no
 * change. `forceDead` shows the dead look for any species (a carcass, an animal killed by something else).
 */
export const visualStateOf = (outcome: AnimalOutcome, isBitten: boolean, forceDead = false): AnimalVisualState => {
  if (forceDead) return 'dead'
  if (!isBitten) return 'alive'
  if (outcome === 'turns') return 'infected'
  return outcome === 'dies' ? 'dead' : 'alive'
}

export const createAnimals = (options: AnimalsOptions = {}): AnimalKit => {
  const entries = mergeById([], options.packs?.flatMap((pack) => pack.species ?? []))
  applyPatches(entries, options.patch)
  removeIds(entries, options.remove)
  const species = [...entries.values()].sort((first, second) => first.order - second.order)
  const gaits = { ...GAIT_PHASES, ...options.gaits }
  return { species, get: (id) => entries.get(id), gait: (name) => gaits[name] }
}

