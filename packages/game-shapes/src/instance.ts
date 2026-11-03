import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'

import { generate } from './generate'
import { generatorsOver } from './registry'
import type { ShapeGenerators } from './registry'
import type { GenerateOptions, ShapeBuffers, ShapeGenerator, ShapeSchema } from './types'

export interface ShapesOptions {
  /** Generators by name, added to the set; later packs replace earlier ones with the same name. */
  readonly packs?: readonly Readonly<Record<string, ShapeGenerator>>[]
  /** A generator replaced by name (a function is replaced as a whole). */
  readonly patch?: Readonly<Record<string, ShapeGenerator>>
  /** Names taken out. */
  readonly remove?: readonly string[]
}

export interface Shapes extends ShapeGenerators {
  /** `generate` that looks custom nodes up in this set only (a name only the global registry has throws). */
  generate(schema: ShapeSchema, options?: Omit<GenerateOptions, 'isolatedGenerators'>): ShapeBuffers
}

type Entry = { readonly id: string; readonly generator: ShapeGenerator }

/** A set of shape generators of its own. Nothing is shared with any other set or with the global registry. */
export function createShapes(options: ShapesOptions = {}): Shapes {
  const entryOf = ([id, generator]: [string, ShapeGenerator]): Entry => ({ id, generator })
  const entries = mergeById<Entry>([], (options.packs ?? []).flatMap((pack) => Object.entries(pack).map(entryOf)))
  const patches: Record<string, Partial<Entry>> = {}
  for (const [id, generator] of Object.entries(options.patch ?? {})) patches[id] = { generator }
  applyPatches(entries, patches)
  removeIds(entries, options.remove)
  const generators = generatorsOver(new Map([...entries].map(([id, entry]) => [id, entry.generator])))
  return { ...generators, generate: (schema, generateOptions = {}) => generate(schema, { ...generateOptions, generators: { ...generators.record(), ...generateOptions.generators }, isolatedGenerators: true }) }
}
