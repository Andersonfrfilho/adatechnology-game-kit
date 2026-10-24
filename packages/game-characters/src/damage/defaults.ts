import type { SegmentKind } from '@adatechnology/game-contracts'

import { SEGMENT_NUMBERS } from '../body/segment-tree'
import segments from '../data/segments.json'
import physical from '../presets/physical.json'
import teamGame from '../presets/team-game.json'
import type { BallisticClass, CaliberEntry, DamageRules, ProtectionLayer } from './types'

const { severity } = segments

/** The kit's rules: Arsenal numbers per segment (A4), the design's severity, the game's head rule, death by vitality or head. */
export const DEFAULT_DAMAGE_RULES: DamageRules = {
  deathRule: 'vitality-or-head',
  segmentRule: 'kit',
  severity: { ...severity, stunAtPoints: 35, limbVitalityShare: 0.3, regionLimbVitalityShare: 0.5 },
  blast: { minimumPoints: 8, headDestroyPoints: 40, bigPoints: 120 },
  defaultCut: segments.defaultCut,
  points: physical.points,
  spread: 0,
  segments: SEGMENT_NUMBERS,
  burnPointsPerSecond: 3,
}

/** The Galeria 3D do Arsenal, replayed: its `damage`, `sever`, `explodeSeg`, `splitTorso`, `legLost` and `grenadeAt`. */
export const ARSENAL_RULES: DamageRules = { ...DEFAULT_DAMAGE_RULES, segmentRule: 'arsenal' }

const ELENCO_HIT_POINTS = segments.elenco.segments as Partial<Record<SegmentKind, { readonly hp: number }>>

/** The Elenco, replayed: its own hit points, no multiplier, ±15 % per blow and its cut rule (`hit`, `sever`, `breakBone`); a torso at 0 kills (a human). */
export const ELENCO_RULES: DamageRules = {
  ...DEFAULT_DAMAGE_RULES,
  segmentRule: 'elenco',
  spread: 0.15,
  segments: Object.fromEntries(
    Object.entries(SEGMENT_NUMBERS).map(([kind, numbers]) => [kind, { ...numbers, multiplier: 1, hitPoints: ELENCO_HIT_POINTS[kind as SegmentKind]?.hp ?? numbers.hitPoints }]),
  ) as DamageRules['segments'],
}

export const DAMAGE_PRESETS = { kit: DEFAULT_DAMAGE_RULES, arsenal: ARSENAL_RULES, elenco: ELENCO_RULES } as const

/** The protection presets that reproduce the game's `ROUPAS` (tools/characters-catalog/decisions.json `protectionPresets`). */
export const PROTECTION_PRESETS: readonly ProtectionLayer[] = [
  { id: 'vest_police', slots: ['torso'], ballistic: { resistance: 14, blunt: 0.3, pass: 0.8 } },
  { id: 'vest_military', slots: ['torso'], ballistic: { resistance: 28, blunt: 0.5 } },
  { id: 'helmet_combat', slots: ['head'], ballistic: { resistance: 9, blunt: 0, pass: 1, consumable: true } },
  { id: 'turnout_gear', slots: ['torso', 'arms', 'legs'], fire: 0.25, limbs: 0.8 },
]

const CLASS_OF: Readonly<Record<string, BallisticClass>> = { pistol: 'pistol', rifle: 'rifle' }

/** The game's calibre table (`CALIBRES`) under the kit's calibre ids, for the `team-game` model. */
export const TEAM_GAME_CALIBERS: readonly CaliberEntry[] = Object.entries(teamGame.calibers).map(([id, entry]) => ({
  id,
  points: entry.points,
  penetration: entry.penetration,
  class: CLASS_OF[entry.class] ?? 'pistol',
  skullRange: entry.skullRange,
  pellets: 'pellets' in entry ? entry.pellets : 1,
  effectiveRangeMetres: entry.effectiveRangeMetres,
}))

/** The game's calibre keys (`9x19`, `12ga`, `762x39`, `308`) to the kit's calibre ids. */
export const TEAM_GAME_CALIBER_KEYS: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(teamGame.calibers).map(([id, entry]) => [entry.gameKey, id]))

export const TEAM_GAME_RULES = { regionCost: teamGame.regionCost, damageKeptPerBody: teamGame.damageKeptPerBody, falloff: teamGame.falloff } as const

export const PHYSICAL_RULES = physical
