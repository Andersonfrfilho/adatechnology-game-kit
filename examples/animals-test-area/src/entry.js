// Bundle entry (IIFE global `AnimalsArea`): the animals module of @adatechnology/game-animals-three with the species of the kit and the outbreak rule of the undead pack, ready for any room page:
// `AnimalsArea.loadInto(room)` loads it and opens its area (`?area=animals`).
// The bench changes the look of every animal (alive, infected, dead), the gait and its speed, shows the joints, the split view, the sound range and the carcass lure radius,
// bites every animal (the outbreak rule decides who turns, who dies and who shrugs it off) on a clock that runs accelerated, and adds 40 animals as node skins.
import { SPECIES } from '@adatechnology/game-animals-species'
import { ANIMALS_AREA_ID, createAnimalsTestModule } from '@adatechnology/game-animals-three'
import { createAnimalOutbreak } from '@adatechnology/game-characters-undead'

export { createAnimalsTestModule }

/** The module with the kit's own species and outbreak rule; options replace or extend any of them. */
export function createModule(options = {}) {
  return createAnimalsTestModule({
    species: SPECIES,
    createOutbreak: ({ species, enabled, timeScale }) => createAnimalOutbreak({ species, enabled, timeScale }),
    ...options,
  })
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the animals area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createModule({ ...options, locale: lang }))
  room.openArea(ANIMALS_AREA_ID)
  return report
}
