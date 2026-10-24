// Bundle entry (IIFE global `CharactersArea`): the characters module of @adatechnology/game-characters-three with the content packs of the kit (people, undead), ready for any room page:
// `CharactersArea.loadInto(room)` loads it and opens its area (`?area=characters`).
// Aim at a body and click to shoot it with the tool in hand; the bench "Hit" button fires the chosen load at the body you shot last. The 13 undead types stand in the back row,
// the professions in the front row and the five in the lane are the first five professions; the crowd stands in the east field and is filled by the bench.
import { createCharacters } from '@adatechnology/game-characters'
import { createPeoplePack, PROFESSIONS } from '@adatechnology/game-characters-people'
import { BODY_MATERIAL_DEF, CHARACTERS_AREA_ID, createCharactersTestModule, registerBodyMaterial } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, createUndead, createUndeadPack } from '@adatechnology/game-characters-undead'

export { BODY_MATERIAL_DEF, createCharactersTestModule, registerBodyMaterial }

/** The module with the kit's own packs; options replace or extend any of them (the game's numbers, its own professions). */
export function createModule(options = {}) {
  return createCharactersTestModule({
    packs: [createPeoplePack(), createUndeadPack()],
    undeadTypes: UNDEAD_TYPES,
    professions: PROFESSIONS,
    createUndead: (kit) => createUndead(kit),
    createKit: ({ penetration, deathRule }) => createCharacters({ packs: [createPeoplePack(), createUndeadPack()], penetration, damage: { deathRule } }),
    ...options,
  })
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), puts the body material in the room's world, loads it and opens the characters area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  registerBodyMaterial(room.world)
  const report = room.loadModule(createModule({ fluids: room.fluids, ...options, locale: lang }))
  room.openArea(CHARACTERS_AREA_ID)
  return report
}
