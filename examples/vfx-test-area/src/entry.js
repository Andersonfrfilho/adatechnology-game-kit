// Bundle entry (IIFE global `VfxArea`): the effects bench of @adatechnology/game-vfx-three with the scenarios of the area, ready for any room page:
// `VfxArea.loadInto(room)` loads it and opens its area. The bench picks an explosion or a recipe (by team), its variant, the distance, the LOD band, the quality
// and the layers, replays it or repeats it by itself, and reads particles, debris and lights against the budget.
import { GAME_EFFECTS } from '@adatechnology/game-vfx'
import { createVfxTestModule } from '@adatechnology/game-vfx-three/testing'
import { createVfxArea as create } from './area.js'

export { createVfxTestModule }

/** The module for `room.loadModule`. */
export function createVfxArea(options = {}) {
  return create({ createVfxTestModule, recipeIds: Object.keys(GAME_EFFECTS), ...options })
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the effects area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createVfxArea({ ...options, locale: lang }))
  room.openArea('vfx')
  return report
}
