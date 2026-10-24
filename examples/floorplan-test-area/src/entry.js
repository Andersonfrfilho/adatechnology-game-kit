// Bundle entry (IIFE global `FloorplanArea`): the houses module of @adatechnology/game-floorplan-three with the content packs of the kit (residential, commercial, rural, post-apocalyptic, and the
// structure that makes every plan a destructible spec), ready for any room page: `FloorplanArea.loadInto(room)` loads it, opens its area (`?area=floorplan_area`) and builds the first house.
// The bench picks the package, the typology, the state and the seed; builds a row of houses; goes in, up and down; uses the doors (E); and hits the aimed wall. Shots, blows, blasts and fire of the
// room reach the walls: the houses register in the room's destruction world. A whole lot needs room: open the page with `?arena=40`.
import { engine } from '@adatechnology/game-floorplan'
import { commercialTemplateIds, register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential, residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { register as registerRural, ruralTemplateIds } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import { FLOORPLAN_AREA_ID, createFloorplanTestModule } from '@adatechnology/game-floorplan-three'

export { FLOORPLAN_AREA_ID, createFloorplanTestModule }

let registered = false
/** Puts the content packs in the engine (once). The rural pack extends the residential one, so that goes before it; the structure pack gives every plan its pillars, beams and roof. */
export function registerPacks() {
  if (registered) return engine
  registerResidential(engine, { region: 'br' })
  registerCommercial(engine, { region: 'br' })
  registerStructure(engine)
  registerRural(engine)
  registerPostApocalyptic(engine)
  registered = true
  return engine
}

/** What the bench lists, by package. The post-apocalyptic pack adds the fortified and abandoned states to every typology, and its own triage tent. */
export const GROUPS = [
  { id: 'residential', name: { en: 'Residential', 'pt-BR': 'Residencial' }, templates: residentialTemplateIds },
  { id: 'commercial', name: { en: 'Commercial and public', 'pt-BR': 'Comercial e público' }, templates: commercialTemplateIds },
  { id: 'rural', name: { en: 'Rural and camp', 'pt-BR': 'Rural e acampamento' }, templates: ruralTemplateIds },
  { id: 'post_apocalyptic', name: { en: 'Post-apocalyptic', 'pt-BR': 'Pós-apocalíptico' }, templates: ['triage_tent'] },
]

/** The module for the room's locale (`?lang=en` or pt-BR); options replace or extend anything. */
export function createModule(options = {}) {
  registerPacks()
  return createFloorplanTestModule({ engine, groups: GROUPS, ...options })
}

/**
 * Creates the module for the room's locale, with the room's destruction world and renderer (the houses register in them), loads it, opens the houses area and builds the first house.
 * Returns the room's module report with the module itself under `area` (its `houses`, `build()` and `clear()`).
 */
export function loadInto(room, options = {}) {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const lang = options.locale ?? (params.get('lang') === 'en' ? 'en' : 'pt-BR')
  const arena = Number(params.get('arena'))
  const area = createModule({ world: room.world, renderer: room.renderer, arenaSize: arena >= 14 ? arena : 14, ...options, locale: lang })
  const report = room.loadModule(area)
  room.openArea(FLOORPLAN_AREA_ID)
  area.build()
  return { ...report, area }
}
