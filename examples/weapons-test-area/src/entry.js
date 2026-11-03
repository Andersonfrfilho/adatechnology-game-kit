// Bundle entry (IIFE global `WeaponsArea`): the weapons module of @adatechnology/game-weapons-three, ready for any room page:
// `WeaponsArea.loadInto(room)` loads it and opens its area.
// Controls: aim at a weapon and press H to equip it, click fires or throws, R reloads, Q changes the fire mode (burst), X clears a jam, B turns the safety on and off,
// Y detonates the charges set down for the remote detonator (C4); the Claymore goes off by itself when a body crosses its trip wire, E grabs, G throws what is held. The fuel barrels, the propane cylinder and the car tank stand in the east corner.
// Accessories: the bench has a choice per mount of the weapon in hand (only what fits it), L turns the light on and off, K the laser, V folds or opens the stock (on a weapon with no stock that moves, V is the kick),
// U switches between the weapon and the launcher under its barrel, and the right mouse button aims (zoom by the optic that is fitted; on a weapon that does not fire it still grabs).
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three/testing'
import { itemModels } from '@adatechnology/game-items-three'

export { createWeaponsTestModule }

// the site copies the weapon thumbnails to site/dist/weapon-svg, next to the folder of each example page
const SITE_THUMBNAIL_BASE = '../weapon-svg/'

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the weapons area (behind the room's loading indicator). Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createWeaponsTestModule({ thumbnailBase: SITE_THUMBNAIL_BASE, items: itemModels, ...options, locale: lang }))
  // the area is heavy (hundreds of items, or a whole fleet): the room's loading indicator shows while it is laid, one frame after this returns
  if (room.openAreaAsync) void room.openAreaAsync('weapons_area')
  else room.openArea('weapons_area')
  return report
}
