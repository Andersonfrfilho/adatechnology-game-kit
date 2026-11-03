/**
 * @adatechnology/game-weapons-three/testing: the weapons test area, for the test rooms. Not part of the runtime API.
 */
export { createWeaponsTestModule, weaponsLayout, WEAPON_ITEM_PREFIX, COUNTER_ITEM_ID, MOUNTED_M134_ITEM_ID } from './test-area/area'
export type { WeaponsTestModuleOptions } from './test-area/area'
export { createExplosivesTestModule, DEFAULT_EXPLOSIVES_SCENE, EXPLOSIVES_AREA_ID } from './test-area/explosives-area'
export type { ExplosivesRoom, ExplosivesScene, ExplosivesTestModuleOptions } from './test-area/explosives-area'
export { EXPLOSIVES_TEXT, explosivesTextOf } from './test-area/explosives-text'
export type { ExplosivesText } from './test-area/explosives-text'
