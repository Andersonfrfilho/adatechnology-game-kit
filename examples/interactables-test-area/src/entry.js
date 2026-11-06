// Bundle entry (IIFE global `FurnitureArea`): the area wired to the two kit packages it needs, so a page only has to call
// `FurnitureArea.loadInto(room)` or `room.loadModule(FurnitureArea.createFurnitureArea({ locale }))`.
// The page also carries the weapons module (arms and accessories) and the explosives module (the P13 cylinder: shot, valve, lighter, fire), so what the furniture does under fire can be tried with the real weapons: `loadInto` loads it too.
// And the items module (`ItemsArea`: every item of the goods catalog at real size): the containers of the furniture hold real items, drawn by game-items-three at their real size.
// It carries the characters and the animals modules as well (owner rule: this area shows what every phase adds), so a shot can cross a wardrobe door and reach a zombie behind it,
// the vehicles module, so a car can stand in the yard next to the furniture (`car_in_the_yard`), the vegetation module, so the plants of the Viveiro can be cut, shot and burnt in the same world,
// and the urban module, so the street poles, the neighbourhoods and the terrain are in the same room.
// And the houses area (owner rule): any typology of the residential, commercial, rural and post-apocalyptic packages, built in the room's destruction world next to the furniture.
// And the effects bench (explosions and recipes of the Workshop), to see the smoke, sparks and blood the furniture's destruction plays.
// And the player area (game-player): the room's camera is the player body, with stamina, wounds, the grab and the individual infection (off by default).
// And the crowd area (game-crowd-three): a horde on the instanced path that hunts that player body, civilians, the herd and a region model. It starts empty here (the bench adds agents).
// And the stories area (game-stories): no 3D, a world of stories run to the bench's day, with one character sheet on the room's panel.
import { createAudioTestModule, createSoundCheckModule } from '@adatechnology/game-audio/testing'
import { rng } from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { placeFinds } from '@adatechnology/game-items'
import { createGoodsFindsProvider, createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { buildItem, itemModels } from '@adatechnology/game-items-three'
import { createItemsTestModule } from '@adatechnology/game-items-three/testing'
import { createWeatherTestModule } from '@adatechnology/game-weather/testing'
import { createWeatherVisual } from '@adatechnology/game-weather-three/testing'
import { createVfxTestModule } from '@adatechnology/game-vfx-three/testing'
import { createTerrainTestModule } from '@adatechnology/game-terrain-three/testing'
import { createExplosivesTestModule, createWeaponsTestModule } from '@adatechnology/game-weapons-three/testing'
import { createPersonBuilder } from '@adatechnology/game-characters-three'
import { wallPiece } from '@adatechnology/game-floorplan-three'
import { personSpecOf, registerBodyMaterial } from '@adatechnology/game-characters-three/testing'
import { PROFESSIONS } from '@adatechnology/game-characters-people'
import { createModule as createAnimalsModule } from '../../animals-test-area/src/entry.js'
import { createModule as createCharactersModule } from '../../characters-test-area/src/entry.js'
import { createModule as createCrowdModule } from '../../crowd-test-area/src/entry.js'
import { createModule as createUrbanModule, createVehicleBuilder } from '../../urban-test-area/src/entry.js'
import { loadVegetationTestModule } from '../../vegetation-test-area/src/entry.js'
import { loadVehiclesTestModule } from '../../vehicles-test-area/src/entry.js'
import { loadModule as loadProvingModule } from '../../vehicles-proving-area/src/entry.js'
import { createModule as createFloorplanModule } from '../../floorplan-test-area/src/entry.js'
import { createModule as createPlayerModule } from '../../player-test-area/src/entry.js'
import { createModule as createStoriesModule } from '../../stories-test-area/src/entry.js'
import { createFurnitureArea as create } from './area.js'

/** @typedef {import('@adatechnology/game-test-room').TestRoom} TestRoom */
/** @typedef {import('@adatechnology/game-test-room').ModuleReport} ModuleReport */
/** @typedef {Parameters<TestRoom['loadModule']>[0]} RoomModule */
/** @typedef {typeof import('three')} ThreeLib */
/** What `createFurnitureArea` takes: the kit packages and the contents of the containers, each optional (the bundled ones by default). */
/** @typedef {Partial<Parameters<typeof create>[0]>} FurnitureOptions */
/** The options of `loadInto`: the furniture area's, plus `<step>: false` to leave a module out. */
/** @typedef {FurnitureOptions & { readonly [step: string]: unknown }} LoadOptions */
/** @typedef {{ index: number; total: number; key: string; name: string; done?: boolean }} LoadProgress */
/** @typedef {{ key: string; prepare: () => { name: string; load: () => unknown } }} LoadStep */
/** @typedef {NonNullable<Parameters<typeof createVehicleBuilder>[2]>} VehicleEffects */
/** The keys the other modules' reports go under in the furniture report (`REPORT_KEYS`). */
/** @typedef {'weapons' | 'explosives' | 'itemsArea' | 'characters' | 'animals' | 'vfx' | 'terrain' | 'audio' | 'soundCheck' | 'weather' | 'floorplan' | 'vehicles' | 'vehicles_proving' | 'vegetation' | 'urban' | 'player' | 'crowd' | 'stories'} SubReportKey */
/** @typedef {ModuleReport & { readonly [key in SubReportKey]?: ModuleReport }} FurnitureReport */

/** The pool of the goods catalog each household piece draws its contents from (the key of the house pools, or a container of the catalog). */
/** @type {Readonly<Record<string, string>>} */
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
const wearOf = (/** @type {{ shelfLife?: number }} */ item, /** @type {{ ageDays?: number } | undefined} */ data) => (item.shelfLife && data?.ageDays !== undefined ? (data.ageDays >= item.shelfLife ? 2 : data.ageDays >= item.shelfLife * 0.5 ? 1 : 0) : 0)

/**
 * `fillContainers` for the furniture area: rolls what the piece holds with the goods catalog, puts the stacks in its slots and draws each as the real item (the model of the team
 * where there is one), at the slot, in its real size. The same seed always fills the same.
 * @param {{ catalog?: ReturnType<typeof createGoodsItems>; seed?: number }} [options]
 */
export function createItemContents(options = {}) {
  const catalog = options.catalog ?? createGoodsItems()
  const provider = createGoodsFindsProvider(catalog)
  return /** @type {NonNullable<FurnitureOptions['fillContainers']>} */ ((THREE, group, spec, type) => {
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
        const drawn = buildItem(THREE, item, { wear: wearOf(item, /** @type {{ ageDays?: number } | undefined} */ (stack.data)) })
        const slot = slots[index]
        drawn.root.position.set(slot.pos[0], slot.pos[1], slot.pos[2])
        drawn.root.name = `contents_${container.id}_${index}`
        drawn.root.userData.contents = { container: container.id, item: item.id, qty: stack.qty }
        group.add(drawn.root)
      })
    }
  })
}

/**
 * The module for `room.loadModule`. Pass your own copies of the packages through `options` to use them instead of the bundled ones.
 * @param {FurnitureOptions} [options]
 */
export function createFurnitureArea(options = {}) {
  return create({ GameInteractablesHousehold, GameInteractablesThree, fillContainers: createItemContents(), ...options })
}

export { createTerrainTestModule, createVfxTestModule, createWeaponsTestModule, createExplosivesTestModule, createItemsTestModule, createCharactersModule, createAnimalsModule, createAudioTestModule, createSoundCheckModule, createWeatherTestModule, createFloorplanModule, createUrbanModule, loadVehiclesTestModule, loadVegetationTestModule, createPlayerModule, createCrowdModule, createStoriesModule }

// the site copies the weapon thumbnails to site/dist/weapon-svg, next to the folder of each example page
const SITE_THUMBNAIL_BASE = '../weapon-svg/'

/** Short labels of each loading step, for the modules that are not created before they load (pt-BR, en). */
/** @type {Readonly<Record<string, readonly string[]>>} */
const STEP_LABELS = {
  vehicles: ['Veículos', 'Vehicles'],
  vehicles_proving: ['Banco de provas', 'Proving ground'],
  vegetation: ['Vegetação', 'Vegetation'],
}

/**
 * The loading steps of `loadInto`, in order. A step creates its module only when it is its turn (`prepare()` returns `{ name, load }`, `load()` returns the module's report),
 * so the modules still see the room as the ones before them left it. A module that is created shows its own `name`; the others a short label.
 * The furniture area is the last step and its report is the base of the whole one.
 * @param {TestRoom} room
 * @param {LoadOptions} options
 * @param {string} lang
 * @returns {LoadStep[]}
 */
function loadSteps(room, options, lang) {
  const on = (/** @type {string} */ key) => options[key] !== false
  const label = (/** @type {string} */ key) => STEP_LABELS[key]?.[lang === 'en' ? 1 : 0] ?? key
  /** @type {LoadStep[]} */
  const steps = []
  /**
   * @param {string} key
   * @param {() => RoomModule} create
   * @param {() => void} [before]
   */
  const mod = (key, create, before) => {
    if (!on(key)) return
    steps.push({
      key,
      prepare: () => {
        before?.()
        const module = create()
        return { name: module.name ?? label(key), load: () => room.loadModule(module) }
      },
    })
  }
  const custom = (/** @type {string} */ key, /** @type {() => unknown} */ load) => {
    if (on(key)) steps.push({ key, prepare: () => ({ name: label(key), load }) })
  }
  // the recorded shots and reload steps of game-audio's sfx, when the page carries them (the test room inlines them as `window.__kitSfx`)
  const sfx = globalThis.__kitSfx
  // KNOWN BUG (typing found it): the vehicle kits want an `EffectSink` (`play(request)`) and `room.vfx` is the effects world (`play(id, point)`), so their smoke, dust
  // and fire go nowhere. The cast keeps today's behaviour; the fix (the room's effect sink) comes in its own change.
  const roomPuffs = /** @type {VehicleEffects} */ (/** @type {unknown} */ (room.vfx))
  const samples = sfx ? { manifest: sfx.manifest, url: (/** @type {string | number} */ file) => sfx.files[file] ?? file } : undefined
  mod('weapons', () => createWeaponsTestModule({ locale: lang, thumbnailBase: SITE_THUMBNAIL_BASE, flyRocket: false, items: itemModels, ...(samples ? { samples } : {}) }))
  // the P13 cylinder of the weapons area with its whole sequence (leak, torch, blast, shell) in a kitchen corner against the room's brick wall, with the furniture and the people of the other modules (`?area=explosives_area`)
  mod('explosives', () => createExplosivesTestModule({ locale: lang, room, items: itemModels }))
  // the 1.80 m reference of the items area is a person of the kit (a survivor of the Retratos do Vale builder), not a figure drawn on the spot
  const person = (/** @type {unknown} */ THREE) => createPersonBuilder(/** @type {ThreeLib} */ (THREE), { createCanvas: () => document.createElement('canvas') }).build(personSpecOf(PROFESSIONS.find((/** @type {{ id: string; }} */ p) => p.id === 'mechanic') ?? PROFESSIONS[0])).root
  mod('items', () => createItemsTestModule({ catalog: createGoodsItems(), translate: goodsText, locale: lang, person }))
  // the bodies of the characters module are DestructibleImpls with the 'flesh' material, which the room's world has to know before the module is checked
  mod('characters', () => createCharactersModule({ fluids: room.fluids, film: room.film, locale: lang }), () => registerBodyMaterial(/** @type {Parameters<typeof registerBodyMaterial>[0]} */ (/** @type {unknown} */ (room.world))))
  mod('animals', () => createAnimalsModule({ locale: lang }))
  mod('vfx', () => createVfxTestModule({ locale: lang }))
  mod('terrain', () => createTerrainTestModule({ locale: lang }))
  // the sound and the weather (with its picture: rain curtain, near rain, mist, lightning, headlights, haze; the sky and the fog stay the room's own) ride along too: they use the room's engine and environment (`host.audio`, `host.environment`), so what the furniture does under rain, wind and shots is heard and seen here
  // the probe of the sound bench is a portable radio of the goods catalogue, drawn by game-items-three
  const radio = (/** @type {unknown} */ THREE) => buildItem(/** @type {ThreeLib} */ (THREE), /** @type {Parameters<typeof buildItem>[1]} */ (createGoodsItems().items.get('portable_radio'))).root
  mod('audio', () => createAudioTestModule({ locale: lang, probe: radio }))
  // the measuring area of the sound criteria C1–C10 (`?area=sound_check_area`): files played live, measured offline through the real engine, 3 s recorded for the owner's ear
  // the source is the same portable radio; the wall that muffles it is a wall of the houses (wallPiece: the houses' structure and renderer)
  mod('soundCheck', () => createSoundCheckModule({ locale: lang, probe: radio, wall: (THREE) => wallPiece(/** @type {ThreeLib} */ (THREE), { w: 4, h: 2.6 }).build(/** @type {ThreeLib} */ (THREE)) }))
  mod('weather', () => createWeatherTestModule({ locale: lang, fog: false, targets: { film: room.film, vfx: room.vfx }, visual: createWeatherVisual({ vfx: room.vfx, layers: { sky: false }, vehicles: (THREE) => createVehicleBuilder(/** @type {ThreeLib} */ (THREE), lang, roomPuffs), rigItem: 'sedan' }) }))
  // the houses use the room's destruction world and renderer (a shot, a blow or a blast of the room reaches their walls); they are built from the houses area (the bench's Build), not on load
  mod('floorplan', () => createFloorplanModule({ world: room.world, renderer: room.renderer, locale: lang }))
  // the vehicles: the sedan of the cross scenario `car_in_the_yard` and the rest of the Frota test, in the same world as the furniture
  // ?vehicles=midsize_sedan,compact_suv lays those models of the fleet instead of the Frota test (one model at a time for a check)
  const vehicleKeys = new URLSearchParams(globalThis.location?.search ?? '').get('vehicles')
  custom('vehicles', () => loadVehiclesTestModule(room, { locale: lang, ...(vehicleKeys ? { vehicles: vehicleKeys.split(',') } : {}) }))
  // the proving ground: a fleet vehicle runs the measured tests on a track, with the vehicle cameras, the mirrors and the certificate board (its own area is `?area=vehicles_proving`; it builds nothing until opened)
  custom('vehicles_proving', () => loadProvingModule(room, { locale: lang, occupant: 'person_nurse' }))
  // the plants of the Viveiro: cut, shot and burnt next to the house (the module only loads here; its own area is `?area=vegetation`)
  custom('vegetation', () => loadVegetationTestModule(room, { locale: lang }))
  // the street poles, the ten neighbourhoods and the terrain patch (the module only loads here; its own area is `?area=urban`)
  mod('urban', () => createUrbanModule({ locale: lang, effects: roomPuffs }))
  // the player body rides along: the room's camera is the player, so walking here spends stamina and makes footstep noise
  mod('player', () => createPlayerModule({ locale: lang }))
  // the crowd rides along: empty until the bench adds agents, then a horde on the instanced path hunting the player body
  mod('crowd', () => createCrowdModule({ locale: lang }))
  // the stories ride along: no 3D, a world of stories and a character sheet for the room's panel
  mod('stories', () => createStoriesModule({ locale: lang }))
  // the furniture comes last: its report is the base of the whole one
  steps.push({
    key: 'furniture',
    prepare: () => {
      const module = createFurnitureArea({ ...options, locale: lang })
      return { name: module.name, load: () => room.loadModule(module) }
    },
  })
  return steps
}

/** The key a module's report goes under (the items module's is `itemsArea`). */
/** @type {Readonly<Record<string, string>>} */
const REPORT_KEYS = { items: 'itemsArea' }

const langOf = (/** @type {{ readonly locale?: string }} */ options) => options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')

/**
 * @param {ReadonlyArray<[string, unknown]>} results
 * @returns {FurnitureReport}
 */
function assemble(results) {
  const base = /** @type {ModuleReport} */ (/** @type {[string, unknown]} */ (results.find(([key]) => key === 'furniture'))[1])
  return { ...base, ...Object.fromEntries(results.filter(([key, report]) => key !== 'furniture' && report).map(([key, report]) => [REPORT_KEYS[key] ?? key, report])) }
}

/**
 * Creates the module for the room's locale (`?lang=en` or pt-BR) and loads it, after the weapons, items, characters, animals, effects, sound, weather, houses, vehicles, vegetation, urban, player, crowd and stories modules (the furniture bench stays the one the panel shows).
 * Returns the room's report of the furniture module, with the other modules' reports under `weapons`, `explosives`, `itemsArea`, `characters`, `animals`, `vfx`, `audio`, `weather`, `floorplan`, `vehicles`, `vegetation`, `urban`, `player`, `crowd` and `stories`.
 * @param {TestRoom} room
 * @param {LoadOptions} [options]
 */
export function loadInto(room, options = {}) {
  const lang = langOf(options)
  const results = loadSteps(room, options, lang).map((step) => /** @type {[string, unknown]} */ ([step.key, step.prepare().load()]))
  return assemble(results)
}

/** Waits for the browser to paint (a frame, then a task); falls back to a timer where frames do not run (a hidden tab). */
const nextPaint = () =>
  /** @type {Promise<void>} */ (new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    globalThis.requestAnimationFrame?.(() => setTimeout(finish, 0))
    setTimeout(finish, 100)
  }))

/**
 * Same as `loadInto`, but yields to the browser before each module so a loading screen can paint and move. `onProgress({ index, total, key, name })` is called before each step
 * (`index` counts from 1; `index === total` is the furniture area); once more with `index: total + 1` and `done: true` at the end. Resolves to the same report as `loadInto`.
 * @param {TestRoom} room
 * @param {LoadOptions & { onProgress?: (progress: LoadProgress) => void }} [options]
 */
export async function loadIntoAsync(room, options = {}) {
  const { onProgress, ...rest } = options
  const lang = langOf(rest)
  const steps = loadSteps(room, rest, lang)
  /** @type {Array<[string, unknown]>} */
  const results = []
  for (const [i, step] of steps.entries()) {
    const { name, load } = step.prepare()
    onProgress?.({ index: i + 1, total: steps.length, key: step.key, name })
    await nextPaint()
    results.push([step.key, load()])
  }
  onProgress?.({ index: steps.length + 1, total: steps.length, key: 'done', name: '', done: true })
  return assemble(results)
}
