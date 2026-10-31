// Bundle entry (IIFE global `VegetationArea`): the vegetation module of @adatechnology/game-vegetation-three with the species of the kit, ready for any room page:
// `VegetationArea.loadInto(room)` loads it and opens its area (`?area=vegetation`).
// The area lays the 18 plants of the Viveiro as items of the room's default destruction world (a mesh per piece, joints, anchors, wind sway); the bench plants the nursery lot with its seed,
// quality, detail, condition and season, sets the wind and starts the walker that bends the plants; its layers show the colliders, the boxes of the pieces and the axes of the wood.
// Thirteen scenarios check it.
import { VEGETATION_AREA_ID, createVegetationTestModule, loadVegetationTestModule } from '@adatechnology/game-vegetation-three/testing'

export { createVegetationTestModule, loadVegetationTestModule }

/** The module with the kit's own engine and species; options replace any of it. */
export function createModule(options = {}) {
  return createVegetationTestModule(options)
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the vegetation area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = loadVegetationTestModule(room, { ...options, locale: lang })
  room.openArea(VEGETATION_AREA_ID)
  return report
}
