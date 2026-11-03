/**
 * @adatechnology/game-characters-three/testing: the test area, bench and scenarios, for the test rooms. Not part of the runtime API.
 */
export { createCharactersTestModule, CHARACTERS_AREA_ID, PERSON_ITEM_PREFIX, ZOMBIE_ITEM_PREFIX } from './test-area/module'
export { HIT_PRESETS } from './test-area/hits'
export type { HitPreset } from './test-area/hits'
export type { CharactersTestOptions, ProfessionCard, UndeadCard, UndeadLike } from './test-area/types'
export type { AreaContext } from './test-area/scenarios'
export { BODY_MATERIAL_DEF, registerBodyMaterial } from './test-area/material'
export { personSpecOf } from './test-area/person-spec'
export { AVATAR_AREA_ID, createAvatarTestModule } from './test-area/avatar-module'
export type { AvatarTestOptions } from './test-area/avatar-module'
