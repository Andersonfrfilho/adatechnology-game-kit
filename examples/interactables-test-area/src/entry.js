// Bundle entry (IIFE global `FurnitureArea`): the area wired to the two kit packages it needs, so a page only has to call
// `FurnitureArea.loadInto(room)` or `room.loadModule(FurnitureArea.createFurnitureArea({ locale }))`.
// The page also carries the weapons module (arms and accessories), so what the furniture does under fire can be tried with the real weapons: `loadInto` loads it too.
// And the items module (`ItemsArea`: every item of the goods catalog at real size): the containers of the furniture hold real items, drawn by game-items-three at their real size.
// It carries the characters and the animals modules as well (owner rule: this area shows what every phase adds), so a shot can cross a wardrobe door and reach a zombie behind it,
// the vehicles module, so a car can stand in the yard next to the furniture (`car_in_the_yard`), the vegetation module, so the plants of the Viveiro can be cut, shot and burnt in the same world,
// and the urban module, so the street poles, the neighbourhoods and the terrain are in the same room.
// And the houses area (owner rule): any typology of the residential, commercial, rural and post-apocalyptic packages, built in the room's destruction world next to the furniture.
// And the effects bench (explosions and recipes of the Workshop), to see the smoke, sparks and blood the furniture's destruction plays.
import { createAudioTestModule } from '@adatechnology/game-audio'
import { rng } from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { placeFinds } from '@adatechnology/game-items'
import { createGoodsFindsProvider, createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { buildItem, createItemsTestModule } from '@adatechnology/game-items-three'
import { createWeatherTestModule } from '@adatechnology/game-weather'
import { createWeatherVisual } from '@adatechnology/game-weather-three'
import { createVfxTestModule } from '@adatechnology/game-vfx-three'
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'
import { registerBodyMaterial } from '@adatechnology/game-characters-three'
import { createModule as createAnimalsModule } from '../../animals-test-area/src/entry.js'
import { createModule as createCharactersModule } from '../../characters-test-area/src/entry.js'
import { createModule as createUrbanModule } from '../../urban-test-area/src/entry.js'
import { loadVegetationTestModule } from '../../vegetation-test-area/src/entry.js'
import { loadVehiclesTestModule } from '../../vehicles-test-area/src/entry.js'
import { createModule as createFloorplanModule } from '../../floorplan-test-area/src/entry.js'
import { createFurnitureArea as create } from './area.js'

/** The pool of the goods catalog each household piece draws its contents from (the key of the house pools, or a container of the catalog). */
const CONTENT_KEYS = {
  fridge: 'geladeira',
  fridge_compact: 'geladeira',
  kitchen_cabinet_base: 'pia',
  kitchen_cabinet_wall: 'aereo',
  pantry: 'despensa',
  wardrobe: 'guarda',
  dresser: 'comoda',
  nightstand: 'criado',
  bathroom_cabinet: 'bathroom_cabinet',
  trash_bin: 'lixeira',
  wheelie_bin: 'lixeira',
  mailbox: 'correio',
  cooler: 'cooler',
}

/** The wear an item shows by how far it is through its shelf life. */
const wearOf = (item, data) => (item.shelfLife && data?.ageDays !== undefined ? (data.ageDays >= item.shelfLife ? 2 : data.ageDays >= item.shelfLife * 0.5 ? 1 : 0) : 0)

/**
 * `fillContainers` for the furniture area: rolls what the piece holds with the goods catalog, puts the stacks in its slots and draws each as the real item (the model of the team
 * where there is one), at the slot, in its real size. The same seed always fills the same.
 */
export function createItemContents(options = {}) {
  const catalog = options.catalog ?? createGoodsItems()
  const provider = createGoodsFindsProvider(catalog)
  return (THREE, group, spec, type) => {
    const key = CONTENT_KEYS[type]
    if (!key) return
    for (const container of spec.containers ?? []) {
      const slots = container.slots.filter((slot) => !slot.part)
      if (slots.length === 0) continue
      const stacks = provider.findsFor({ place: 'house', container: key, key, state: 'normal', rng: rng(options.seed ?? 1), day: 0, footprint: 1 }) ?? []
      const { contents } = placeFinds(stacks, slots, catalog)
      contents.forEach((stack, index) => {
        if (!stack) return
        const item = catalog.get(stack.type)
        const drawn = buildItem(THREE, item, { wear: wearOf(item, stack.data) })
        const slot = slots[index]
        drawn.root.position.set(slot.pos[0], slot.pos[1], slot.pos[2])
        drawn.root.name = `contents_${container.id}_${index}`
        drawn.root.userData.contents = { container: container.id, item: item.id, qty: stack.qty }
        group.add(drawn.root)
      })
    }
  }
}

/** The module for `room.loadModule`. Pass your own copies of the packages through `options` to use them instead of the bundled ones. */
export function createFurnitureArea(options = {}) {
  return create({ GameInteractablesHousehold, GameInteractablesThree, fillContainers: createItemContents(), ...options })
}

export { createVfxTestModule, createWeaponsTestModule, createItemsTestModule, createCharactersModule, createAnimalsModule, createAudioTestModule, createWeatherTestModule, createFloorplanModule, createUrbanModule, loadVehiclesTestModule, loadVegetationTestModule }

// the site copies the weapon thumbnails to site/dist/weapon-svg, next to the folder of each example page
const SITE_THUMBNAIL_BASE = '../weapon-svg/'

/**
 * Creates the module for the room's locale (`?lang=en` or pt-BR) and loads it, after the weapons, items, characters, animals, effects, sound, weather, houses, vehicles, vegetation and urban modules (the furniture bench stays the one the panel shows).
 * Returns the room's report of the furniture module, with the other modules' reports under `weapons`, `itemsArea`, `characters`, `animals`, `vfx`, `audio`, `weather`, `floorplan`, `vehicles`, `vegetation` and `urban`.
 */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const weapons = options.weapons === false ? undefined : room.loadModule(createWeaponsTestModule({ locale: lang, thumbnailBase: SITE_THUMBNAIL_BASE }))
  const itemsArea = options.items === false ? undefined : room.loadModule(createItemsTestModule({ catalog: createGoodsItems(), translate: goodsText, locale: lang }))
  // the bodies of the characters module are DestructibleImpls with the 'flesh' material, which the room's world has to know before the module is checked
  registerBodyMaterial(room.world)
  const characters = options.characters === false ? undefined : room.loadModule(createCharactersModule({ fluids: room.fluids, film: room.film, locale: lang }))
  const animals = options.animals === false ? undefined : room.loadModule(createAnimalsModule({ locale: lang }))
  const vfx = options.vfx === false ? undefined : room.loadModule(createVfxTestModule({ locale: lang }))
  // the sound and the weather (with its picture: rain curtain, near rain, mist, lightning, headlights, haze; the sky and the fog stay the room's own) ride along too: they use the room's engine and environment (`host.audio`, `host.environment`), so what the furniture does under rain, wind and shots is heard and seen here
  const audio = options.audio === false ? undefined : room.loadModule(createAudioTestModule({ locale: lang }))
  const weather = options.weather === false ? undefined : room.loadModule(createWeatherTestModule({ locale: lang, fog: false, targets: { film: room.film, vfx: room.vfx }, visual: createWeatherVisual({ vfx: room.vfx, layers: { sky: false } }) }))
  // the houses use the room's destruction world and renderer (a shot, a blow or a blast of the room reaches their walls); they are built from the houses area (the bench's Build), not on load
  const floorplan = options.floorplan === false ? undefined : room.loadModule(createFloorplanModule({ world: room.world, renderer: room.renderer, locale: lang }))
  // the vehicles: the sedan of the cross scenario `car_in_the_yard` and the rest of the Frota test, in the same world as the furniture
  const vehicles = options.vehicles === false ? undefined : loadVehiclesTestModule(room, { locale: lang })
  // the plants of the Viveiro: cut, shot and burnt next to the house (the module only loads here; its own area is `?area=vegetation`)
  const vegetation = options.vegetation === false ? undefined : loadVegetationTestModule(room, { locale: lang })
  // the street poles, the ten neighbourhoods and the terrain patch (the module only loads here; its own area is `?area=urban`)
  const urban = options.urban === false ? undefined : room.loadModule(createUrbanModule({ locale: lang }))
  const report = room.loadModule(createFurnitureArea({ ...options, locale: lang }))
  return { ...report, ...(weapons ? { weapons } : {}), ...(itemsArea ? { itemsArea } : {}), ...(characters ? { characters } : {}), ...(animals ? { animals } : {}), ...(vfx ? { vfx } : {}), ...(audio ? { audio } : {}), ...(weather ? { weather } : {}), ...(floorplan ? { floorplan } : {}), ...(vehicles ? { vehicles } : {}), ...(vegetation ? { vegetation } : {}), ...(urban ? { urban } : {}) }
}
