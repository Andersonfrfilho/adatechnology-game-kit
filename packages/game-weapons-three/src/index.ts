/**
 * @adatechnology/game-weapons-three: the three.js side of @adatechnology/game-weapons. Low-poly weapon models, the weapon in the hands with
 * fire and reload motion, ejected casings and dropped magazines, synthesized sounds, and the weapons test area as a `TestableModule`
 * (any host of @adatechnology/game-contracts, like the test room, loads it with `loadModule`).
 */
export { createWeaponsTestModule, weaponsLayout, WEAPON_ITEM_PREFIX, COUNTER_ITEM_ID } from './area'
export type { WeaponsTestModuleOptions } from './area'
export { createWeaponFx } from './fx'
export type { WeaponFx, WeaponFxOptions } from './fx'
export { createWeaponAudio } from './audio'
export type { WeaponAudio } from './audio'
export { buildWeaponModel, buildProp, weaponProp, BODY_ACTIONS } from './props'
export type { WeaponProp } from './props'
export { MODEL_ENTRIES, buildWeaponModelById, hasWeaponModel } from './models'
export type { ModelEntry, ModelFamily, ModelOptions, ModelParts, WeaponModel } from './models'
export { buildCartridge, buildCasing, buildRound, cartridgeShape } from './models/cartridge'
export { applyCondition } from './models/condition'
export { partRegistry } from './models/part-registry'
export { buildToolClips } from './animation/clip-set'
export type { ClipContext } from './animation/context'
export type { CartridgeShape } from './models/cartridge'
export { modelKit } from './models/kit'
export type { ModelKit, ModelMaterials } from './models/kit'
