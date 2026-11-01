// Bundle entry (IIFE global `CrowdArea`): the crowd module of @adatechnology/game-crowd-three with the kit's own content, ready for any room page:
// `CrowdArea.loadInto(room)` loads it and opens its area (`?area=crowd`).
// The horde is the undead pack of game-characters-undead, its bodies baked by the Bestiário builder of game-characters-three; the herd is drawn by
// game-animals-three from the species of game-animals-species; the region the area is in is a game-infection model. The room's camera is the
// game-player body the horde hunts. Sounds go to the room's engine, effects to the room's effects.
import { birdSize, quadrupedLayout } from '@adatechnology/game-animals'
import { getSpecies } from '@adatechnology/game-animals-species'
import { createAnimalsThree } from '@adatechnology/game-animals-three'
import { createBestBuilder } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createRng } from '@adatechnology/game-crowd'
import { CROWD_AREA_ID, createCrowdTestModule } from '@adatechnology/game-crowd-three/testing'
import { create } from '@adatechnology/game-infection'

export { createCrowdTestModule }

const cardOf = (id) => UNDEAD_TYPES.find((card) => card.id === id)

/** The body builders of the kit: the Bestiário v17 builder with the undead types' names and eyes. */
const builders = (THREE) => {
  const best = createBestBuilder(THREE, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: createRng(11) })
  return {
    buildBest: (spec, lod) => {
      best.setLOD(lod)
      return best.build(spec)
    },
    topMaterial: () => best.topM(),
  }
}

/** The game's survivor bodies without a portrait (G 68469 `PB`: the human body of the Bestiário, no blood); the civilians take them in turn. */
const CIVILIAN_BODIES = [
  { type: 'Lento', human: true, decay: 0, seed: 4242, skin: 0xb07a52, fem: false, life: 1, hs: 'short', hair: 0x2a1e16 },
  { type: 'Lento', human: true, decay: 0, seed: 813, skin: 0x8a5a3a, fem: false, life: 2 },
  { type: 'Lento', human: true, decay: 0, seed: 814, skin: 0xa8714a, fem: true, life: 1 },
]

/** One region with an outbreak four days old, for the bridge to the region model. */
const town = () => {
  const model = create({
    seed: 5,
    incubationHours: 48,
    startHour: 0,
    regions: [{ id: 'town', pop: 2000, density: 1, police: 2 }],
    links: [],
    phases: [{ id: 'routine', dayMin: -99, dayMax: -99, threshold: 0, awareness: 0, cullFixed: 0, cullFraction: 0, shelter: 0, flee: 0, exit: 0, focusTransfer: 0 }],
    events: [{ id: 'seed', hour: 0, action: 'seed', region: 'town', n: 400 }],
  })
  model.advance(96)
  return model
}

const sizeOf = (species) => (species.body.kind === 'quadruped' ? quadrupedLayout(species.body).size : species.body.kind === 'bird' ? birdSize(species.body) : 1)

/** The module with the kit's own content; options replace any of it (another pack, other bodies, no animals). */
export function createModule(options = {}) {
  const locale = options.locale ?? 'pt-BR'
  return createCrowdTestModule({
    pack: undeadCrowdPack(),
    builders,
    typeName: (type) => cardOf(type.id)?.name['pt-BR'] ?? type.id,
    typeLabel: (type) => cardOf(type.id)?.name[locale] ?? cardOf(type.id)?.name['pt-BR'] ?? type.id,
    civilianBodies: CIVILIAN_BODIES,
    animals: { species: (id) => getSpecies(id), size: sizeOf, drawer: (THREE) => createAnimalsThree(THREE, { seed: 7 }) },
    infection: { create: town, region: 'town', active: (model) => model.region('town').active },
    ...options,
  })
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR) with a horde of 300, loads it and opens the crowd area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const query = new URLSearchParams(globalThis.location?.search ?? '')
  const lang = options.locale ?? (query.get('lang') === 'en' ? 'en' : 'pt-BR')
  // ?variety=1 draws the horde with identity, accessories and the economy ladder (and gives every agent a personality), ?clips=1 walks the bodies from the clip texture
  const variety = query.get('variety') === '1' ? { variety: { segmentClips: query.get('clips') === '1' }, crowdPhysics: { personality: true } } : {}
  const report = room.loadModule(createModule({ startCount: 300, ...variety, ...options, locale: lang }))
  room.openArea(CROWD_AREA_ID)
  return report
}
