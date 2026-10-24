import { createBodySpec } from './body/body-spec'
import type { BodySpec } from './body/body-spec'
import { characterView, createCharacterCore, resolveSpec } from './character'
import type { Character } from './character'
import { applyPatches, mergeById, removeIds } from './registry'
import type { CharacterPreset, CharacterSpec, CharactersOptions, CorpseOptions } from './types'

export const DEFAULT_CORPSES: CorpseOptions = { max: 400, seconds: 900 }

/** The base preset every spec can start from: an unnamed adult person. */
export const PERSON_PRESET: CharacterPreset = { id: 'person', kind: 'person', age: 'adult' }

export type CharacterKit = {
  readonly body: BodySpec
  readonly presets: ReadonlyMap<string, CharacterPreset>
  readonly corpses: CorpseOptions
  /** A new character: the preset (`spec.preset`, else the one named `spec.kind`) under the spec. */
  create(spec: CharacterSpec): Character
}

/** Fills a spec from its preset: what the spec says wins; `multipliers` merge field by field. */
export const applyPreset = (spec: CharacterSpec, presets: ReadonlyMap<string, CharacterPreset>): CharacterSpec => {
  const preset = presets.get(spec.preset ?? spec.kind)
  if (!preset) return spec
  const { id: _presetId, ...defaults } = preset
  const multipliers = { ...defaults.multipliers, ...spec.multipliers }
  return { ...defaults, ...spec, multipliers }
}

export const createCharacters = (options: CharactersOptions = {}): CharacterKit => {
  const body = createBodySpec(options.body)
  const presets = mergeById([PERSON_PRESET], options.packs?.flatMap((pack) => pack.presets ?? []))
  applyPatches(presets, options.patch)
  removeIds(presets, options.remove)
  let counter = 0
  return {
    body,
    presets,
    corpses: { ...DEFAULT_CORPSES, ...options.corpses },
    create(spec) {
      counter += 1
      const resolved = resolveSpec(applyPreset(spec, presets), body, counter)
      return characterView(createCharacterCore({ spec: resolved, bodySpec: body }))
    },
  }
}
