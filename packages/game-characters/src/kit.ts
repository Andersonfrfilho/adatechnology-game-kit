import { createBodySpec } from './body/body-spec'
import type { BodySpec } from './body/body-spec'
import { createCharacterCore, resolveSpec } from './character'
import { createDamageCharacter } from './damage/damage-character'
import type { DamageCharacter } from './damage/damage-character'
import { DAMAGE_PRESETS, PROTECTION_PRESETS, TEAM_GAME_CALIBERS } from './damage/defaults'
import { penetrateLine } from './damage/line'
import type { LineResult, LineShot, LineTarget } from './damage/line'
import { PENETRATION_MODELS } from './damage/penetration'
import type { CaliberEntry, DamageRules, PenetrationModel, ProtectionLayer } from './damage/types'
import { applyPatches, mergeById, removeIds } from './registry'
import type { CharacterPreset, CharacterSpec, CharactersOptions, CorpseOptions, DamageOptions } from './types'

export const DEFAULT_CORPSES: CorpseOptions = { max: 400, seconds: 900 }

/** The base preset every spec can start from: an unnamed adult person. */
export const PERSON_PRESET: CharacterPreset = { id: 'person', kind: 'person', age: 'adult' }

export type CharacterKit = {
  readonly body: BodySpec
  readonly presets: ReadonlyMap<string, CharacterPreset>
  readonly corpses: CorpseOptions
  readonly damage: DamageRules
  readonly penetration: PenetrationModel
  readonly protection: ReadonlyMap<string, ProtectionLayer>
  readonly calibers: ReadonlyMap<string, CaliberEntry>
  /** A new character: the preset (`spec.preset`, else the one named `spec.kind`) under the spec. */
  create(spec: CharacterSpec): DamageCharacter
  /** A shot through a line of bodies with the kit's penetration model and calibre table. */
  penetrateLine(shot: LineShot, targets: readonly LineTarget[]): LineResult
}

/** Fills a spec from its preset: what the spec says wins; `multipliers` merge field by field. */
export const applyPreset = (spec: CharacterSpec, presets: ReadonlyMap<string, CharacterPreset>): CharacterSpec => {
  const preset = presets.get(spec.preset ?? spec.kind)
  if (!preset) return spec
  const { id: _presetId, ...defaults } = preset
  const multipliers = { ...defaults.multipliers, ...spec.multipliers }
  return { ...defaults, ...spec, multipliers }
}

/** The rules of a preset (`kit` by default) with the given fields replaced; `severity`, `blast` and `segments` merge key by key. */
export const resolveDamageRules = (options: DamageOptions = {}): DamageRules => {
  const { preset, severity, blast, segments, ...rest } = options
  const base = DAMAGE_PRESETS[preset ?? 'kit']
  return { ...base, ...rest, severity: { ...base.severity, ...severity }, blast: { ...base.blast, ...blast }, segments: { ...base.segments, ...segments } }
}

const modelOf = (option: CharactersOptions['penetration']): PenetrationModel => (typeof option === 'object' ? option : PENETRATION_MODELS[option ?? 'physical'])

export const createCharacters = (options: CharactersOptions = {}): CharacterKit => {
  const body = createBodySpec(options.body)
  const packs = options.packs ?? []
  const presets = mergeById([PERSON_PRESET], packs.flatMap((pack) => pack.presets ?? []))
  applyPatches(presets, options.patch)
  removeIds(presets, options.remove)
  const damage = resolveDamageRules(options.damage)
  const penetration = modelOf(options.penetration)
  const protection = mergeById(PROTECTION_PRESETS, [...packs.flatMap((pack) => pack.protection ?? []), ...(options.protection ?? [])])
  const shippedCalibers = penetration.id === 'team-game' ? TEAM_GAME_CALIBERS : []
  const calibers = mergeById(shippedCalibers, [...packs.flatMap((pack) => pack.calibers ?? []), ...(options.calibers ?? [])])
  const setup = { rules: damage, model: penetration, protection, calibers }
  let counter = 0
  return {
    body,
    presets,
    corpses: { ...DEFAULT_CORPSES, ...options.corpses },
    damage,
    penetration,
    protection,
    calibers,
    create(spec) {
      counter += 1
      const resolved = resolveSpec(applyPreset(spec, presets), body, counter)
      const core = createCharacterCore({ spec: resolved, bodySpec: body, hitPointsOf: (kind) => damage.segments[kind].hitPoints })
      return createDamageCharacter(core, setup)
    },
    penetrateLine: (shot, targets) => penetrateLine({ model: penetration.id === 'team-game' ? 'team-game' : 'physical', shot, targets, calibers }),
  }
}
