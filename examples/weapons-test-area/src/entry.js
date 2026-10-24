// Bundle entry (IIFE global `WeaponsArea`): the weapons module of @adatechnology/game-weapons-three, ready for any room page:
// `WeaponsArea.loadInto(room)` loads it and opens its area.
// Controls: aim at a weapon and press H to equip it, click fires or throws, R reloads, Q changes the fire mode (burst), X clears a jam, B turns the safety on and off,
// Y detonates the charges set down (Claymore, C4), E grabs, G throws what is held. The fuel barrels, the propane cylinder and the car tank stand in the east corner.
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'

export { createWeaponsTestModule }

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the weapons area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createWeaponsTestModule({ ...options, locale: lang }))
  room.openArea('weapons_area')
  return report
}
