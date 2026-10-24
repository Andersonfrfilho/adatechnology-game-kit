// Bundle entry (IIFE global `FurnitureArea`): the area wired to the two kit packages it needs, so a page only has to call
// `FurnitureArea.loadInto(room)` or `room.loadModule(FurnitureArea.createFurnitureArea({ locale }))`.
// The page also carries the weapons module (arms and accessories), so what the furniture does under fire can be tried with the real weapons: `loadInto` loads it too.
// It carries the characters and the animals modules as well (owner rule: this area shows what every phase adds), so a shot can cross a wardrobe door and reach a zombie behind it.
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'
import { registerBodyMaterial } from '@adatechnology/game-characters-three'
import { createModule as createAnimalsModule } from '../../animals-test-area/src/entry.js'
import { createModule as createCharactersModule } from '../../characters-test-area/src/entry.js'
import { createFurnitureArea as create } from './area.js'

/** The module for `room.loadModule`. Pass your own copies of the packages through `options` to use them instead of the bundled ones. */
export function createFurnitureArea(options = {}) {
  return create({ GameInteractablesHousehold, GameInteractablesThree, ...options })
}

export { createWeaponsTestModule, createCharactersModule, createAnimalsModule }

// the site copies the weapon thumbnails to site/dist/weapon-svg, next to the folder of each example page
const SITE_THUMBNAIL_BASE = '../weapon-svg/'

/**
 * Creates the module for the room's locale (`?lang=en` or pt-BR) and loads it, after the weapons, characters and animals modules (the furniture bench stays the one the panel shows).
 * Returns the room's report of the furniture module, with the other modules' reports under `weapons`, `characters` and `animals`.
 */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const weapons = options.weapons === false ? undefined : room.loadModule(createWeaponsTestModule({ locale: lang, thumbnailBase: SITE_THUMBNAIL_BASE }))
  // the bodies of the characters module are DestructibleImpls with the 'flesh' material, which the room's world has to know before the module is checked
  registerBodyMaterial(room.world)
  const characters = options.characters === false ? undefined : room.loadModule(createCharactersModule({ fluids: room.fluids, locale: lang }))
  const animals = options.animals === false ? undefined : room.loadModule(createAnimalsModule({ locale: lang }))
  const report = room.loadModule(createFurnitureArea({ ...options, locale: lang }))
  return { ...report, ...(weapons ? { weapons } : {}), ...(characters ? { characters } : {}), ...(animals ? { animals } : {}) }
}
