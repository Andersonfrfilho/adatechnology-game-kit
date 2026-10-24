/**
 * @adatechnology/game-characters: living bodies without an engine. Proportions and rig, the 17-segment tree with the 6 crowd regions, the
 * registries of presets, and the damage model (protection, penetration, severity, dismemberment, death, bleeding) as a `DestructibleImpl`.
 * Knows nothing about any game: content packs (people, uniformed forces, undead) add presets. Engine units: joules, metres, seconds.
 */
export { createCharacters, applyPreset, resolveDamageRules, DEFAULT_CORPSES, PERSON_PRESET } from './kit'
export type { CharacterKit } from './kit'
export type { Character, ResolvedCharacterSpec } from './character'
export { GUIDE, TEAM_GAME, JOINT_IDS, createBodySpec } from './body/body-spec'
export type { BodySpec, JointId } from './body/body-spec'
export { createRig, GAME_BONES, JOINT_PARENTS } from './body/rig'
export type { CreateRigParams, Rig } from './body/rig'
export { SEGMENT_TREE, SEGMENT_IDS, SEGMENT_NUMBERS, segmentNode, segmentsBelow, isSegmentId } from './body/segment-tree'
export type { SegmentId, SegmentNode, SegmentNumbers, SegmentSide } from './body/segment-tree'
export { BODY_REGIONS, LIMB_REGIONS, REGION_HIT_POINTS, REGION_SEGMENTS, isBodyRegion } from './body/regions'
export type { LimbRegion } from './body/regions'
export { BODY_MATERIAL, describeBody } from './body/describe'
export { mergeById, applyPatches, removeIds } from './registry'
export * from './gait'
export { createConditionTimeline } from './condition/timeline'
export type { ConditionOptions, ConditionPhase, ConditionSample, ConditionTimeline } from './condition/timeline'
export { createCorpseLedger } from './corpses'
export type { CorpseEntry, CorpseLedger } from './corpses'
export * from './appearance'
export type { DamageCharacter } from './damage/damage-character'
export {
  ARSENAL_RULES,
  DAMAGE_PRESETS,
  DEFAULT_DAMAGE_RULES,
  ELENCO_RULES,
  PROTECTION_PRESETS,
  TEAM_GAME_CALIBERS,
  TEAM_GAME_CALIBER_KEYS,
} from './damage/defaults'
export {
  PENETRATION_MODELS,
  PHYSICAL_PENETRATION,
  TEAM_GAME_PENETRATION,
  TORSO_RESISTANCE,
  energyKept,
  segmentResistance,
  teamGameCost,
  teamGameFalloff,
} from './damage/penetration'
export { createRng, cutOf, penetrationForce, pointsFromEnergy, projectileOf, resolvePoints, spreadPoints } from './damage/points'
export { LAYERED_PROTECTION_CAP, layeredProtection, layersOn, protect } from './damage/protection'
export type { ProtectionOutcome } from './damage/protection'
export { penetrateLine } from './damage/line'
export type { LineHit, LineResult, LineShot, LineTarget, PenetrateLineParams } from './damage/line'
export { BLOOD_LITERS_PER_DROP, bleedRateAt } from './damage/bleeding'
export type { Bleeder } from './damage/bleeding'
export type {
  BallisticClass,
  BlastRules,
  BodyHit,
  CaliberEntry,
  DamageRules,
  DeathRule,
  HitReport,
  PenetrationModel,
  ProjectileInfo,
  ProtectionLayer,
  SegmentRuleId,
  SeverityRules,
} from './damage/types'
export type {
  AgeGroup,
  BodyMultipliers,
  CharacterPack,
  CharacterPreset,
  CharacterSpec,
  CharactersOptions,
  CorpseOptions,
  DamageOptions,
  Detail,
  SegmentState,
  SegmentStatus,
} from './types'
