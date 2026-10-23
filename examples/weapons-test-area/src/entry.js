// Bundle entry (IIFE global `WeaponsArea`): the weapons module of @adatechnology/game-weapons-three, ready for any room page:
// `WeaponsArea.loadInto(room)` loads it and opens its area.
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'

export { createWeaponsTestModule }

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the weapons area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createWeaponsTestModule({ ...options, locale: lang }))
  room.openArea('weapons_area')
  return report
}
