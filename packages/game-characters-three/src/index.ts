/**
 * @adatechnology/game-characters-three: the three.js presentation of the living bodies. The instanced crowd body (GPU pose, LOD, baking,
 * variants, torn-off limbs) and the rich bodies (Bestiário v17 builder, survivors, animator, wounds). three.js is passed in by the host.
 */
export type { Three } from './three'
export { BODY_CHUNK, createBodyChunk } from './instanced/body-chunk'
export type { BodyChunkOptions } from './instanced/body-chunk'
export { buildInstancedBody, jointsOf } from './instanced/body-geometry'
export type { BodyJoints, BuildInstancedBodyParams } from './instanced/body-geometry'
export { createBodyMaterial } from './instanced/body-material'
export type { BodyMaterialParams } from './instanced/body-material'
export { createBodyBatch } from './instanced/body-batch'
export type { BodyBatch, BodyBatchOptions, BodyInstance } from './instanced/body-batch'
export { LOD_BAKE, LOD_BATCH_CAPACITY, LOD_CASTS_SHADOW, LOD_DISTANCES, LOD_SEGMENTS, lodAt } from './instanced/lod'
export { BAKE_NEUTRAL_POSE, bakeBody } from './instanced/bake'
export type { BakeBuilders, BakeSpec, BakedBody } from './instanced/bake'
export { bakeVariants, createVariantBatches } from './instanced/variants'
export type { BodyVariant, VariantType } from './instanced/variants'
export { createFlyingLimbs } from './instanced/flying-limbs'
export type { FlyingLimb, FlyingLimbs, FlyingLimbsOptions, LimbEffects, LimbLaunch } from './instanced/flying-limbs'
export { createRigAnimator } from './rich/animator'
export type { PoseTargets, RichRig, RigAnimator, RigAnimatorOptions } from './rich/animator'
export { createBestBuilder } from './rich/best-builder'
export type { BestBuilder, BestBuilderOptions, BestTypeCard } from './rich/best-builder'
export { createPersonBuilder } from './rich/person-builder'
export type { PersonBuilder, PersonBuilderOptions } from './rich/person-builder'
export { EXTRAS } from './rich/accessories/extras'
export { FACE_FEATURES } from './rich/accessories/face-features'
export { HATS } from './rich/accessories/hats'
export { HAND_ITEMS } from './rich/accessories/hand-items'
export { createEye, createGlowTexture, findEyes } from './eyes'
export type { EyeOptions, Eyes } from './eyes'
export { PENDULUM, createPendulum, stepPendulum } from './wounds/pendulum'
export type { Pendulum } from './wounds/pendulum'
export { blobGeometry, blobRadii, createWoundMaterials, makeCut, makeStump, ringWound } from './wounds/cut'
export type { WoundMaterials } from './wounds/cut'
export { createFlyingPieces } from './wounds/flying'
export type { FlyingPiece, FlyingPieces, FlyingPiecesOptions } from './wounds/flying'
export { exitWound, explodeChunks, gouge, starGeometry, woundDecal } from './wounds/marks'
export { woundBodyOf } from './wounds/segment-nodes'
export type { WoundBody, WoundNode } from './wounds/segment-nodes'
export { createWounds } from './wounds/wounds'
export type { Wounds, WoundsOptions } from './wounds/wounds'
export { bloodLookOfAge, createFluidsBridge } from './wounds/fluids-bridge'
export type { BloodAge, BloodLook, BloodLookOptions, BloodSink, FilmSink, FluidsBridge, FluidsBridgeOptions, WoundSpray } from './wounds/fluids-bridge'
export { createCharactersTestModule, CHARACTERS_AREA_ID, PERSON_ITEM_PREFIX, ZOMBIE_ITEM_PREFIX } from './test-area/module'
export { HIT_PRESETS } from './test-area/hits'
export type { HitPreset } from './test-area/hits'
export type { CharactersTestOptions, ProfessionCard, UndeadCard, UndeadLike } from './test-area/types'
export type { AreaContext } from './test-area/scenarios'
export { BODY_MATERIAL_DEF, registerBodyMaterial } from './test-area/material'
export { CHARACTER_SOUND_BANK, CHARACTER_SOUNDS, UNDEAD_VOICE_GROUP } from './audio/recipes'
export { BODY_SOUNDS, PLAYER_SOUNDS, UNDEAD_VOICES, UNDEAD_VOICE_SOURCES, createCharacterSound } from './audio/sound'
export type { BodySoundRule, CharacterSound, CharacterSoundOptions, CharacterSoundSink, CharacterSoundStyle, UndeadVoice, VoiceMoment, VoiceStep } from './audio/sound'
export { createPlayerAvatar } from './player/avatar'
export type { AvatarEvent, AvatarItemUsePose, AvatarUpdate, PlayPoseOptions, PlayerAvatar, PlayerAvatarColors, PlayerAvatarOptions, PlayerAvatarSpec } from './player/avatar'
export { toRoomAvatar } from './player/room-avatar'
export type { RoomAvatarLike, ToRoomAvatarOptions } from './player/room-avatar'
export { AVATAR_AREA_ID, createAvatarTestModule } from './player/test-module'
export type { AvatarTestOptions } from './player/test-module'
export { createFirstPersonArms, FIRST_PERSON_BOB, FIRST_PERSON_COLORS, FIRST_PERSON_RIG, FIRST_PERSON_STANCES } from './first-person/arms'
export { solveTwoBone } from './first-person/ik'
export type { TwoBone } from './first-person/ik'
export type {
  FirstPersonArms,
  FirstPersonArmsOptions,
  FirstPersonArmsState,
  FirstPersonBob,
  FirstPersonColors,
  FirstPersonEvent,
  FirstPersonRig,
  RestPose,
  StanceDef,
} from './first-person/types'
