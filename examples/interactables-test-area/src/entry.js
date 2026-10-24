// Bundle entry (IIFE global `FurnitureArea`): the area wired to the two kit packages it needs, so a page only has to call
// `FurnitureArea.loadInto(room)` or `room.loadModule(FurnitureArea.createFurnitureArea({ locale }))`.
// The page also carries the weapons module (arms and accessories), so what the furniture does under fire can be tried with the real weapons: `loadInto` loads it too.
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'
import { createFurnitureArea as create } from './area.js'

/** The module for `room.loadModule`. Pass your own copies of the packages through `options` to use them instead of the bundled ones. */
export function createFurnitureArea(options = {}) {
  return create({ GameInteractablesHousehold, GameInteractablesThree, ...options })
}

export { createWeaponsTestModule }

/**
 * Creates the module for the room's locale (`?lang=en` or pt-BR) and loads it, after the weapons module (the furniture bench stays the one the panel shows).
 * Returns the room's report of the furniture module, with the weapons module's report under `weapons`.
 */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const weapons = options.weapons === false ? undefined : room.loadModule(createWeaponsTestModule({ locale: lang }))
  const report = room.loadModule(createFurnitureArea({ ...options, locale: lang }))
  return weapons ? { ...report, weapons } : report
}
