import type { BodyRegion, SegmentKind } from '@adatechnology/game-contracts'

import type { BodySpec } from './body/body-spec'
import type { SegmentId, SegmentSide } from './body/segment-tree'
import type { DAMAGE_PRESETS } from './damage/defaults'
import type { BlastRules, CaliberEntry, DamageRules, PenetrationModel, ProtectionLayer, SeverityRules } from './damage/types'

export type AgeGroup = 'child' | 'young' | 'adult' | 'elder'

/** `segments`: the 17 segments (near, rich path); `regions`: the 6 crowd regions of the game (far, instanced path). */
export type Detail = 'segments' | 'regions'

/** `ok` untouched, `wounded` hit, `broken` bone broken (still attached), `severed` cut off at its joint, `destroyed` blown to pieces. */
export type SegmentStatus = 'ok' | 'wounded' | 'broken' | 'severed' | 'destroyed'

export type SegmentState = {
  readonly id: SegmentId
  readonly kind: SegmentKind
  readonly side?: SegmentSide
  readonly region: BodyRegion
  hp: number
  readonly max: number
  status: SegmentStatus
  /** Still on the body (false once it or a segment above it is severed or destroyed). */
  attached: boolean
}

/** Damage multipliers of a body type per body part (a zombie type's `mult`); 1 by default. */
export type BodyMultipliers = { readonly head: number; readonly torso: number; readonly arms: number; readonly legs: number }

/** What makes one character. Everything but `seed` and `kind` is optional; a preset (`kind`, or `preset`) fills what the spec leaves out. */
export type CharacterSpec = {
  readonly seed: number
  /** `person`, or a preset id (a profession, an undead type...). */
  readonly kind: string
  readonly id?: string
  /** Preset to start from (default: the preset whose id is `kind`, when there is one). */
  readonly preset?: string
  readonly sex?: 'male' | 'female'
  readonly age?: AgeGroup
  /** Height in metres (default the body spec's). */
  readonly height?: number
  /** Width factor (default 1). */
  readonly build?: number
  /** Outfit id (content packs define them). */
  readonly outfit?: string
  /** Ids of the protection layers worn (`vest_police`, `helmet_combat`...). */
  readonly protection?: readonly string[]
  /** Free data for content packs (an undead type, a profession...). The engine never reads it. */
  readonly traits?: Readonly<Record<string, unknown>>
  /** Starting vitality (default 100). */
  readonly vitality?: number
  readonly multipliers?: Partial<BodyMultipliers>
  /** Extra damage taken by arms and legs (the age of a zombie: `membro`); default 1. */
  readonly limbFactor?: number
  /** Scales every bleed rate (the age of a zombie: `sangue`); default 1. */
  readonly bloodFactor?: number
  /** How many bodies the torso counts as for penetration (a brute: 2); default 1. */
  readonly bodyCount?: number
  /** Seconds a heavy hit stuns (default 0.45). */
  readonly stunSeconds?: number
  readonly detail?: Detail
  /** Starts crawling (a crawler). */
  readonly crawling?: boolean
  /**
   * A random stream to draw from instead of the per-hit stream (`seed ^ hit counter`). For replaying a recorded game: the goldens pass the
   * team's own stream here.
   */
  readonly random?: () => number
}

/** A named starting point for specs (a profession, a force, an undead type). */
export type CharacterPreset = { readonly id: string } & Partial<Omit<CharacterSpec, 'seed' | 'id' | 'preset' | 'random'>>

/** Content added by a pack (people, uniformed, undead...). */
export type CharacterPack = {
  readonly id: string
  readonly presets?: readonly CharacterPreset[]
  /** Protection layers by id (vests, helmets, coats). */
  readonly protection?: readonly ProtectionLayer[]
  /** Calibre entries by id (a game's own points table). */
  readonly calibers?: readonly CaliberEntry[]
}

/** Damage rules: a preset (`kit` by default, or a team page replayed: `arsenal`, `elenco`) with fields replaced. */
export type DamageOptions = Partial<Omit<DamageRules, 'severity' | 'blast' | 'segments'>> & {
  readonly preset?: keyof typeof DAMAGE_PRESETS
  readonly severity?: Partial<SeverityRules>
  readonly blast?: Partial<BlastRules>
  readonly segments?: Partial<DamageRules['segments']>
}

export type CorpseOptions = { readonly max: number; readonly seconds: number }

export type CharactersOptions = {
  readonly packs?: readonly CharacterPack[]
  /** Fields to change in presets, by id. */
  readonly patch?: Readonly<Record<string, Partial<CharacterPreset>>>
  /** Preset ids to remove. */
  readonly remove?: readonly string[]
  /** Proportions (default `GUIDE`); `joints` and `segmentRadius` merge key by key. */
  readonly body?: Partial<BodySpec>
  /** Corpse cap and lifetime (default 400 bodies, 900 s). */
  readonly corpses?: Partial<CorpseOptions>
  readonly damage?: DamageOptions
  /** `physical` (P = √(E·m/A), default), `team-game` (the game's points; for the goldens) or a model of your own. */
  readonly penetration?: PenetrationModel | 'physical' | 'team-game'
  /** Protection layers added to (or replacing, by id) the presets `vest_police`, `vest_military`, `helmet_combat`, `turnout_gear`. */
  readonly protection?: readonly ProtectionLayer[]
  /** Calibre entries (points, class, skull range...) by calibre id. */
  readonly calibers?: readonly CaliberEntry[]
}
