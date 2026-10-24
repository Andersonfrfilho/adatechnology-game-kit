/**
 * @adatechnology/game-characters: living bodies without an engine. Proportions and rig, the 17-segment tree with the 6 crowd regions, and the
 * registries of presets. Knows nothing about any game: content packs (people, uniformed forces, undead) add presets.
 */
export { createCharacters, applyPreset, DEFAULT_CORPSES, PERSON_PRESET } from './kit'
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
export type {
  AgeGroup,
  BodyMultipliers,
  CharacterPack,
  CharacterPreset,
  CharacterSpec,
  CharactersOptions,
  CorpseOptions,
  Detail,
  SegmentState,
  SegmentStatus,
} from './types'
