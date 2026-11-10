// Bundle entry (IIFE global `FloorplanArea`): the houses module of @adatechnology/game-floorplan-three with the content packs of the kit (residential, commercial, rural, post-apocalyptic, and the
// structure that makes every plan a destructible spec), ready for any room page: `FloorplanArea.loadInto(room)` loads it, opens its area (`?area=floorplan_area`) and builds the first house.
// The bench picks the package, the typology, the state and the seed (or the address: `?template=mansion&seed=4&state=abandoned`); builds a row of houses; goes in, up and down; uses the doors (E); and hits the aimed wall. Shots, blows, blasts and fire of the
// room reach the walls: the houses register in the room's destruction world. A whole lot needs room: open the page with `?arena=40`.
import { engine } from '@adatechnology/game-floorplan'
import { commercialTemplateIds, register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential, residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { register as registerRural, ruralTemplateIds } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import * as GameVegetation from '@adatechnology/game-vegetation'
import * as GameVegetationThree from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import { itemModels } from '@adatechnology/game-items-three'
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three/testing'
import { FLOORPLAN_AREA_ID, createFloorplanTestModule, floorplanAreaParams } from '@adatechnology/game-floorplan-three/testing'

export { FLOORPLAN_AREA_ID, createFloorplanTestModule, createWeaponsTestModule }

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

export const TEST_ROOM_FURNITURE = [
  'dining_table',
  'coffee_table',
  'desk',
  'sofa_3seat',
  'fridge',
  'stove_4burner',
  'tv',
  'floor_lamp',
  'double_bed',
  'toilet',
  'washbasin',
  'shower',
  'mirror',
  'washing_machine',
]

/**
 * The module for the room's locale (`?lang=en` or pt-BR); options replace or extend anything.
 * @param {Partial<Parameters<typeof createFloorplanTestModule>[0]>} [options]
 */
export function createModule(options = {}) {
  registerPacks()
  // the houses are drawn with the interactables kit and vegetation kit: the adapter that turns the plan into doors, drawers, appliances, sockets and lamps is the package's default (game-floorplan-interactables)
  return createFloorplanTestModule({
    engine,
    groups: GROUPS,
    furniture: options.furniture ?? TEST_ROOM_FURNITURE,
    ...options,
    house: {
      interactives: { GameInteractables, GameInteractablesHousehold, GameInteractablesThree },
      vegetation: { GameVegetation: { ...GameVegetation, ...GameVegetationThree }, GameVegetationSpecies },
      ...options.house,
    },
  })
}

/**
 * Creates the module for the room's locale, with the room's destruction world and renderer (the houses register in them), loads it, opens the houses area and builds the first house.
 * Returns the room's module report with the module itself under `area` (its `houses`, `build()` and `clear()`).
 * @param {import('@adatechnology/game-test-room').TestRoom} room
 * @param {Partial<Parameters<typeof createFloorplanTestModule>[0]>} [options]
 */
export function loadInto(room, options = {}) {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const lang = options.locale ?? (params.get('lang') === 'en' ? 'en' : 'pt-BR')
  const arena = Number(params.get('arena'))
  // Load the weapons module so 1st-person arms and 3rd-person avatar hold and animate 3D weapons
  if (!room.modules().some((m) => m.id === 'weapons_area')) {
    room.loadModule(createWeaponsTestModule({ locale: lang, thumbnailBase: '../weapon-svg/', flyRocket: false, items: itemModels }))
  }
  // ?effectlights=0: a blast lights no house surface (what the houses did before `effectLightsIndoors`), to compare with the default
  const house = params.get('effectlights') === '0' ? { effectLightsIndoors: false, ...options.house } : options.house
  // ?template=mansion&seed=4&state=abandoned opens straight on that house
  const area = createModule({ world: room.world, renderer: room.renderer, arenaSize: arena >= 14 ? arena : 40, ...floorplanAreaParams(globalThis.location?.search ?? ''), ...options, ...(house ? { house } : {}), locale: lang })
  const report = room.loadModule(area)
  room.openArea(FLOORPLAN_AREA_ID)
  area.build()
  if (room.tool?.def?.category === 'hand' && room.arsenal?.weapons?.has('beretta_92fs')) {
    room.setTool('beretta_92fs')
  }
  return { ...report, area }
}
