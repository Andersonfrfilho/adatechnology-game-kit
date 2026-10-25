// Bundle entry (IIFE global `UrbanArea`): the urban module of @adatechnology/game-urban-three with the kit's own catalogues, ready for any room page:
// `UrbanArea.loadInto(room)` loads it and opens its area (`?area=urban`).
// The area lays the five poles of the Galeria, a street grid with a filled block, a patch of terrain and the ten neighbourhoods of the sample sheet; the bench draws any neighbourhood in
// front of the player with a seed, a share of lamps on, a light budget and, when asked, the vehicles of the fleet (lite build) and the species of the region. Eight scenarios check it.
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '@adatechnology/game-vehicles-three'
import { URBAN_AREA_ID, createUrbanTestModule, loadUrbanTestModule } from '@adatechnology/game-urban-three'

export { createUrbanTestModule, loadUrbanTestModule }

/** The vehicles of the fleet for the bench: one kit for the room's three.js, the fleet installed, the lite build. */
export function createVehicleBuilder(THREE, locale = 'pt-BR') {
  const kit = createVehicleKit({ THREE, locale })
  installFleet(kit)
  return createVehiclesThree(THREE, { kit })
}

/** The module with the kit's own catalogues; options replace or extend any of it. */
export function createModule(options = {}) {
  return createUrbanTestModule({ vehicles: (THREE) => createVehicleBuilder(THREE, options.locale), ...options })
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the urban area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createModule({ ...options, locale: lang }))
  room.openArea(URBAN_AREA_ID)
  return report
}
