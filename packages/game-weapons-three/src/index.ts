/**
 * @adatechnology/game-weapons-three: the three.js side of @adatechnology/game-weapons. Low-poly weapon models, the weapon in the hands with
 * fire and reload motion, ejected casings and dropped magazines, synthesized sounds, and the weapons test area as a `TestableModule`
 * (any host of @adatechnology/game-contracts, like the test room, loads it with `loadModule`).
 */
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export { createWeaponsTestModule, weaponsLayout, WEAPON_ITEM_PREFIX, COUNTER_ITEM_ID, MOUNTED_M134_ITEM_ID } from './testing'
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export type { WeaponsTestModuleOptions } from './testing'
export { WEAPON_THUMBNAILS, DEFAULT_THUMBNAIL_BASE, weaponThumbnailUrl, weaponThumbnailCredit } from './thumbnails'
export type { WeaponThumbnailEntry } from './thumbnails'
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export { createExplosivesTestModule, DEFAULT_EXPLOSIVES_SCENE, EXPLOSIVES_AREA_ID } from './testing'
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export type { ExplosivesRoom, ExplosivesScene, ExplosivesTestModuleOptions } from './testing'
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export { EXPLOSIVES_TEXT, explosivesTextOf } from './testing'
/** @deprecated import from '@adatechnology/game-weapons-three/testing' */
export type { ExplosivesText } from './testing'
export { P13_VALVE_MESH, WORLD_EXPLOSIVE_IDS, WORLD_EXPLOSIVE_PREFIX, worldExplosiveItem, worldExplosiveShell, worldExplosiveValve } from './world-explosives'
export type { WorldExplosiveOptions } from './world-explosives'
export type { ItemModelRequest, ItemModels } from './item-models'
export { projectileModel } from './projectile-model'
export type { ProjectileModel, ProjectileQuery } from './projectile-model'
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
export { buildItemWeaponModel, buildWeaponModel, buildProp, itemModelOfWeapon, registerWeaponItemModel, weaponProp, BODY_ACTIONS } from './props'
export type { WeaponItemModel, WeaponProp } from './props'
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
