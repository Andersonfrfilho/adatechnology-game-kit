// Bundle entry (IIFE global `UrbanArea`): the urban module of @adatechnology/game-urban-three with the kit's own catalogues, ready for any room page:
// `UrbanArea.loadInto(room)` loads it and opens its area (`?area=urban`).
// The area lays the five poles of the Galeria, a street grid with a filled block, a patch of terrain and the ten neighbourhoods of the sample sheet; the bench draws any neighbourhood in
// front of the player with a seed, a share of lamps on, a light budget and, when asked, the vehicles of the fleet (lite build) and the species of the region. Eight scenarios check it.
// "Plantas" mode: a button on the page opens the 2D map of a city plan of `urban.cities` (select with the 6 templates, button that fills the downtown and commercial blocks).
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '@adatechnology/game-vehicles-three'
import { URBAN_AREA_ID, createUrbanTestModule, loadUrbanTestModule } from '@adatechnology/game-urban-three/testing'

import { drawLayout, fillDowntown, openCityPlans } from './cities-map.js'

export { createUrbanTestModule, loadUrbanTestModule, drawLayout, fillDowntown, openCityPlans }

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
  addPlantasButton(lang)
  return report
}

/** The "Plantas" button of the page: opens the city-plan map overlay. Does nothing without a document. */
export function addPlantasButton(locale = 'pt-BR') {
  const doc = globalThis.document
  if (!doc?.body || doc.getElementById('urban-plantas-button')) return
  const btn = doc.createElement('button')
  btn.id = 'urban-plantas-button'
  btn.textContent = locale === 'en' ? 'City plans' : 'Plantas'
  btn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:40'
  btn.onclick = () => openCityPlans({ locale })
  doc.body.appendChild(btn)
}
