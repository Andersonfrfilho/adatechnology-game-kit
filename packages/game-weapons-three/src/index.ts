/**
 * @adatechnology/game-weapons-three: the three.js side of @adatechnology/game-weapons. Low-poly weapon models, the weapon in the hands with
 * fire and reload motion, ejected casings and dropped magazines, synthesized sounds, and the weapons test area as a `TestableModule`
 * (any host of @adatechnology/game-contracts, like the test room, loads it with `loadModule`).
 */
export { createWeaponsTestModule, weaponsLayout, WEAPON_ITEM_PREFIX, COUNTER_ITEM_ID, MOUNTED_M134_ITEM_ID } from './area'
export type { WeaponsTestModuleOptions } from './area'
export { WEAPON_THUMBNAILS, DEFAULT_THUMBNAIL_BASE, weaponThumbnailUrl, weaponThumbnailCredit } from './thumbnails'
export type { WeaponThumbnailEntry } from './thumbnails'
export { WORLD_EXPLOSIVE_IDS, WORLD_EXPLOSIVE_PREFIX, worldExplosiveItem } from './world-explosives'
export { createWorldEffects, WORLD_EFFECTS } from './world-effects'
export type { WorldEffectIds, WorldEffectsOptions } from './world-effects'
export { createWeaponFx } from './fx'
export type { FxLayers, WeaponFx, WeaponFxOptions } from './fx'
export {
  createWeaponAudio,
  computeShotSound,
  mechanicalSoundOf,
  MECHANICAL_SOUNDS,
  GAME_SOUND_CLASSES,
  GAME_DISTANCE_CURVE,
  DEFAULT_ENERGY_CURVE,
  CLASS_REFERENCE_ENERGY,
} from './audio'
export type {
  WeaponAudio,
  WeaponAudioOptions,
  ShotExtras,
  ShotSound,
  ShotSoundInput,
  ShotSoundOptions,
  ShotSoundClass,
  SoundClassDef,
  DistanceCurve,
  EnergyCurve,
  MechanicalSoundId,
  SoundStep,
} from './audio'
export { buildWeaponModel, buildProp, weaponProp, BODY_ACTIONS } from './props'
export type { WeaponProp } from './props'
export { MODEL_ENTRIES, ARCHETYPE_MODELS, buildWeaponModelById, hasWeaponModel } from './models'
export type { ModelEntry, ModelFamily, ModelOptions, ModelParts, WeaponModel } from './models'
export { buildCartridge, buildCasing, buildRound, cartridgeShape } from './models/cartridge'
export { applyCondition } from './models/condition'
export { partRegistry } from './models/part-registry'
export { buildToolClips } from './animation/clip-set'
export type { ClipContext } from './animation/context'
export type { CartridgeShape } from './models/cartridge'
export { modelKit } from './models/kit'
export type { ModelKit, ModelMaterials } from './models/kit'
export { fitAttachmentModels } from './models/attachments/fit'
export type { AttachmentRig, FitAttachmentOptions } from './models/attachments/fit'
export { ATTACHMENT_MODELS } from './models/attachments/registry'
export { mountFrame, deriveFrames } from './models/attachments/mount-frames'
export type { MountFrame } from './models/attachments/mount-frames'
export type { AttachmentBuildContext, AttachmentModel, AttachmentModelBuilder, AttachmentModelRegistry, LaserRaycast } from './models/attachments/types'
export { rigUnderbarrel } from './models/attachments/rig-underbarrel'
export { rigStock } from './models/rig-stock'
