import type * as THREE_NS from 'three'
import type { AreaPlacement, BenchChange, DestructibleSpec, HostTool, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import type { EngineSink } from '@adatechnology/game-audio'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal, WeaponDef } from '@adatechnology/game-weapons'
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
import { createAccessoryBench, accessoryControls, accessoryLayers, accessoryMetrics } from '../accessory-bench'
import { accessoryTextOf } from '../accessory-text'
import { createWeaponAudio } from '../audio'
import type { WeaponAudio } from '../audio'
import { createWeaponFx } from '../fx'
import type { WeaponFx } from '../fx'
import { createLaserRaycast } from '../laser-raycast'
import { ARCHETYPE_MODELS, hasWeaponModel } from '../models'
import type { AttachmentModelRegistry } from '../models/attachments/types'
import { BODY_ACTIONS, buildModeledProp, buildProp, buildTripodMountedProp, itemModelOfWeapon, modeledPropSpec, weaponProp } from '../props'
import type { ItemModels } from '../item-models'
import type { WeaponProp } from '../props'
import { DEFAULT_THUMBNAIL_BASE, weaponThumbnailCredit, weaponThumbnailUrl } from '../thumbnails'
import { WORLD_EXPLOSIVE_IDS, WORLD_EXPLOSIVE_PREFIX, worldExplosiveItem } from '../world-explosives'
import { createWorldEffects } from '../world-effects'
import { weaponsScenarios } from '../scenarios'

export interface WeaponsTestModuleOptions {
  /** `en` or `pt-BR` (default). */
  locale?: string
  /** The arsenal to lay out (default `createArsenal` with the locale). */
  arsenal?: Arsenal
  /** Play sounds (default true; silent anyway where there is no AudioContext). */
  sound?: boolean
  /** Wear of the weapon in the hands, which the gallery models show in their metal: `new` (default), `used`, `worn` or `rusty`. */
  condition?: string
  /** Seed of the scatter of casings and smoke (default 1). */
  seed?: number
  /** Builders of accessory models that replace or add to the ones the kit ships (by the `model` of the accessory). */
  attachmentModels?: AttachmentModelRegistry
  /** Folder (ending with a slash) the weapon thumbnails are served from, relative to the page (default `weapon-svg/`); `false` leaves the items without a thumbnail. */
  thumbnailBase?: string | false
  /** The rocket of a launcher flies out of the weapon in the hands (default true). A host that draws the projectile (the test room's `projectileModel`) passes false: one round flies. */
  flyRocket?: boolean
  /** The item models of game-items-three (`itemModels` there): the weapons the gallery did not draw get the team's model instead of the low-poly prop. */
  items?: ItemModels
}

/** Prefix of the item ids of the weapon props (`weapon_pistol_9mm`). */
export const WEAPON_ITEM_PREFIX = 'weapon_'
// must not start with WEAPON_ITEM_PREFIX: hosts and tests tell the props apart by it
export const COUNTER_ITEM_ID = 'counter_weapons'

// how loud an explosion is: a base plus what its reach adds (the game's `explosao` class is at full volume for a blast of 15 m or more)
const EXPLOSION_VOLUME_BASE = 0.4
const EXPLOSION_VOLUME_PER_METRE = 0.04
const SOUND_DISTANCE_MAX = 200
/** Longest safety fuse the bench offers, metres: one metre burns 131 s, enough to see a delayed trap. */
const FUSE_LENGTH_MAX = 1
const DEFAULT_FUSE_LENGTH = 0.03
const COUNTER = { length: 4.8, depth: 1.6, height: 0.9 }
// four columns on the free left side of the room, in two rows: counters fill in this order
const COUNTER_X = [-6.5, -9, -11.5, -14]
const COUNTER_Z = [-1, 5.5]
// the M134 mounted on its tripod stands apart from the counters, in front of the targets and pointing at them
export const MOUNTED_M134_ITEM_ID = 'm134_tripod'
const MOUNTED_M134 = { weaponId: 'm134', at: [-3.5, 0, 2] as Vec3, rotationY: Math.PI / 2 }
// props closer than this to a counter end have nothing next to them on one side
const END_MARGIN = 0.5
// the strip of counter a weapon lying across it takes: most are slim, a few are wide (a tripod, two fuel tanks, a bow limb)
const DEFAULT_PITCH = 0.16
const PITCH_BY_ID: Readonly<Record<string, number>> = { browning_m2: 0.5, m134: 0.45, m2_flamethrower: 0.45, bow: 0.3, crossbow: 0.3 }
// the explosives of the world stand together in the far corner (the player is at the other end, 17 m away): a bullet, fire or blast starts the chain reaction
const WORLD_EXPLOSIVES: Array<{ id: string; at: Vec3 }> = [
  { id: 'fuel_barrel', at: [10, 0, -8] },
  { id: 'fuel_barrel', at: [11.2, 0, -8] },
  { id: 'propane_p13', at: [10.6, 0, -9.3] },
  { id: 'car_fuel_tank', at: [8.6, 0, -9.3] },
]
// targets in front of the brick wall of the room, at shooting distances
const TARGETS: Array<{ id: string; at: Vec3 }> = [
  { id: 'target_steel_plate', at: [-1.5, 0, -7] },
  { id: 'target_plywood', at: [0, 0, -7] },
  { id: 'target_concrete', at: [1.5, 0, -7] },
]

const EMPTY_TOOL: HostTool = { weapon: '', category: '', ammo: 0, capacity: 0, reserve: 0, reloading: false }

interface Text {
  group: string
  name: string
  counter: string
  targets: Record<string, string>
  reloadStart: string
  /** The line of a reload start: how it goes (`kind`), the clip that plays and its seconds. */
  reloadClip: string
  reloadKinds: Record<string, string>
  /** The line of a sound cue of a reload clip and the name of each cue. */
  soundCue: string
  soundCues: Record<string, string>
  reloadEnd: string
  worldExplosives: Record<string, string>
  mountedM134: string
  condition: string
  conditionHint: string
  conditions: Record<string, string>
  ammoQuality: string
  ammoQualityHint: string
  ammoQualities: Record<string, string>
  soundDistance: string
  soundDistanceHint: string
  fuseLength: string
  fuseLengthHint: string
  layers: Record<'muzzle_flash' | 'casings' | 'magazines', string>
  metrics: Record<'casings_live' | 'magazines_live' | 'heat', string>
}

const TEXT: Record<string, Text> = {
  en: {
    group: 'Weapons',
    name: 'Weapons area',
    counter: 'Weapon counter',
    targets: { target_steel_plate: 'Steel plate target', target_plywood: 'Plywood target', target_concrete: 'Concrete block target' },
    reloadStart: 'Reload started: {weapon} ({ammo}/{capacity})',
    reloadClip: 'Reload of {weapon}: {kind}, clip {clip} ({seconds} s)',
    soundCue: 'Sound: {cue} ({weapon})',
    soundCues: { mag_release: 'magazine release button', mag_out: 'magazine slides out', mag_insert: 'magazine slides in', mag_seat: 'magazine seats (click)', slide_release: 'slide snaps forward', charging_handle_pull: 'charging handle pulled', charging_handle_release: 'charging handle released', bolt_lift: 'bolt handle lifted', bolt_pull: 'bolt pulled back', bolt_push: 'bolt pushed forward', bolt_lock: 'bolt handle locked down', shell_insert: 'round inserted', pump_back: 'pump back', pump_forward: 'pump forward', lever_open: 'lever down', lever_close: 'lever up', cylinder_open: 'cylinder opens', cylinder_eject: 'cases fall out', speedloader: 'speed loader empties', cylinder_close: 'cylinder closes', barrels_open: 'barrels open', casings_eject: 'cases pop out', barrels_close: 'barrels close', belt_cover_open: 'cover opens', belt_insert: 'belt seats', belt_cover_close: 'cover closes', rocket_load: 'rocket slides in', rocket_seat: 'rocket seats', grenade_load: 'grenade goes in', breech_open: 'breech opens', breech_close: 'breech closes', tube_drop: 'empty tube dropped', tube_seat: 'new tube seats' },
    reloadKinds: { tactical: 'tactical (round chambered, no pull)', empty: 'empty chamber (works the action)', one_by_one: 'one by one', full: 'speed loader' },
    reloadEnd: 'Reload done: {weapon} ({ammo}/{capacity})',
    worldExplosives: { fuel_barrel: 'Fuel barrel', propane_p13: 'Propane cylinder (P13)', car_fuel_tank: 'Car fuel tank' },
    mountedM134: 'M134 Minigun on its tripod',
    condition: 'Weapon condition',
    conditionHint: 'Wear of the weapon: it jams more and the metal shows it',
    conditions: { new: 'New', used: 'Used', worn: 'Worn', rusty: 'Rusty' },
    ammoQuality: 'Ammunition',
    ammoQualityHint: 'Reloaded rounds misfire more often',
    ammoQualities: { factory: 'Factory', reloaded: 'Reloaded' },
    soundDistance: 'Sound distance',
    soundDistanceHint: 'How far the listener is from the shot: farther is quieter and duller',
    fuseLength: 'Dynamite fuse length',
    fuseLengthHint: 'Metres of safety fuse (131 s per metre): a long one is set down lit, for a delayed trap',
    layers: { muzzle_flash: 'Muzzle flash', casings: 'Ejected casings', magazines: 'Dropped magazines' },
    metrics: { casings_live: 'Casings in the scene', magazines_live: 'Magazines in the scene', heat: 'Barrel heat' },
  },
  'pt-BR': {
    group: 'Armas',
    name: 'Área de armas',
    counter: 'Balcão de armas',
    targets: { target_steel_plate: 'Alvo: chapa de aço', target_plywood: 'Alvo: compensado', target_concrete: 'Alvo: bloco de concreto' },
    reloadStart: 'Recarga iniciada: {weapon} ({ammo}/{capacity})',
    reloadClip: 'Recarga de {weapon}: {kind}, clipe {clip} ({seconds} s)',
    soundCue: 'Som: {cue} ({weapon})',
    soundCues: { mag_release: 'botão do carregador', mag_out: 'carregador desliza para fora', mag_insert: 'carregador desliza para dentro', mag_seat: 'carregador encaixa (clique)', slide_release: 'ferrolho volta com estalo', charging_handle_pull: 'alavanca de armar puxada', charging_handle_release: 'alavanca de armar solta', bolt_lift: 'alavanca do ferrolho levantada', bolt_pull: 'ferrolho puxado', bolt_push: 'ferrolho empurrado', bolt_lock: 'alavanca do ferrolho travada', shell_insert: 'cartucho entra', pump_back: 'bomba para trás', pump_forward: 'bomba para frente', lever_open: 'alavanca para baixo', lever_close: 'alavanca para cima', cylinder_open: 'tambor abre', cylinder_eject: 'cápsulas caem', speedloader: 'speedloader esvazia', cylinder_close: 'tambor fecha', barrels_open: 'canos abrem', casings_eject: 'estojos saltam', barrels_close: 'canos fecham', belt_cover_open: 'tampa abre', belt_insert: 'cinta encaixa', belt_cover_close: 'tampa fecha', rocket_load: 'foguete desliza para dentro', rocket_seat: 'foguete encaixa', grenade_load: 'granada entra', breech_open: 'culatra abre', breech_close: 'culatra fecha', tube_drop: 'tubo vazio cai', tube_seat: 'tubo novo encaixa' },
    reloadKinds: { tactical: 'tática (com bala na câmara, sem puxar)', empty: 'vazia (puxa o ferrolho ou a trava)', one_by_one: 'uma a uma', full: 'carregador rápido' },
    reloadEnd: 'Recarga completa: {weapon} ({ammo}/{capacity})',
    worldExplosives: { fuel_barrel: 'Barril de combustível', propane_p13: 'Botijão de gás (P13)', car_fuel_tank: 'Tanque de combustível do carro' },
    mountedM134: 'M134 Minigun no tripé',
    condition: 'Estado da arma',
    conditionHint: 'Desgaste da arma: trava mais e o metal mostra',
    conditions: { new: 'Nova', used: 'Usada', worn: 'Gasta', rusty: 'Enferrujada' },
    ammoQuality: 'Munição',
    ammoQualityHint: 'Munição recarregada falha mais',
    ammoQualities: { factory: 'De fábrica', reloaded: 'Recarregada' },
    soundDistance: 'Distância do som',
    soundDistanceHint: 'Quão longe o ouvinte está do tiro: mais longe soa mais baixo e abafado',
    fuseLength: 'Pavio da dinamite',
    fuseLengthHint: 'Metros de pavio de segurança (131 s por metro): um longo é posto no chão aceso, para armadilha com atraso',
    layers: { muzzle_flash: 'Clarão do cano', casings: 'Cápsulas ejetadas', magazines: 'Pentes que caem' },
    metrics: { casings_live: 'Cápsulas na cena', magazines_live: 'Pentes na cena', heat: 'Calor do cano' },
  },
}
const textOf = (locale: string): Text => TEXT[locale] ?? (TEXT.en as Text)
const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))

// the counters are the buffet of the furniture catalogue (a cabinet base under a top), drawn by the house renderer at the counter's measures: its width across x, its length along z
const COUNTER_FURNITURE = 'buffet'

/** A counter of the furniture catalogue (`furnitureSpec` of game-floorplan-three), as an item of the area. */
const counterItem = (name: string): TestableItem => {
  const counter = (THREE: unknown) => furnitureSpec(THREE, COUNTER_FURNITURE, { w: COUNTER.depth, d: COUNTER.length, h: COUNTER.height })
  return {
    id: COUNTER_ITEM_ID,
    name,
    build: (THREE: unknown) => {
      const piece = counter(THREE)
      const root = piece.build(THREE) as THREE_NS.Object3D
      root.userData.counterSpec = { ...piece.spec, name, tags: [...(piece.spec.tags ?? []), 'furniture'] }
      return root
    },
    spec: (root: unknown) => (root as THREE_NS.Object3D).userData.counterSpec as DestructibleSpec,
    movable: false,
  }
}

const targetProp = (id: string, name: string): WeaponProp => {
  const face: Record<string, [string, Vec3, number]> = {
    target_steel_plate: ['steel', [0.5, 0.5, 0.01], 0xb5bcc4],
    target_plywood: ['plywood', [0.6, 0.8, 0.018], 0xc9a26b],
    target_concrete: ['concrete', [0.4, 0.2, 0.2], 0x9a9a94],
  }
  const [material, size, color] = face[id]
  const spec: DestructibleSpec = {
    name,
    parts: [
      { id: 'post', material: 'steel', shape: { kind: 'box', size: [0.05, 1.1, 0.05] }, position: [0, 0.55, -0.05], anchored: true },
      { id: 'face', material, shape: { kind: 'box', size }, position: [0, 1.1 + size[1] / 2, 0] },
    ],
    joints: [{ a: 'post', b: 'face', kind: 'bolt' }],
    tags: ['target'],
  }
  return { spec, colors: { post: 0x3a3d42, face: color } }
}

/** A weapon on the counters: the gallery model when it drew one, else the item model of game-items-three (one rigid body of its measures), the low-poly prop of its category when neither. */
const weaponItem = (def: WeaponDef, name: string, items?: ItemModels): TestableItem => {
  const id = `${WEAPON_ITEM_PREFIX}${def.id}`
  if (!hasWeaponModel(def.id) && !itemModelOfWeapon(def.id, items)) return asItem(id, name, weaponProp(def, name), { weapon: def.id, movable: true })
  return {
    id,
    name,
    build: (THREE: unknown) => buildModeledProp(THREE as typeof THREE_NS, def, name, undefined, items) as THREE_NS.Group,
    spec: (root: unknown) => modeledPropSpec(root, def, name),
    weapon: def.id,
    movable: true,
  }
}

/** The M134 standing on a tripod: the support the `tripod` accessory gives, as a prop of its own (aim at it and press H to take the gun). */
const mountedM134Item = (def: WeaponDef, name: string): TestableItem => ({
  id: MOUNTED_M134_ITEM_ID,
  name,
  build: (THREE: unknown) => buildTripodMountedProp(THREE as typeof THREE_NS, def, name) as THREE_NS.Group,
  spec: (root: unknown) => modeledPropSpec(root, def, name),
  weapon: def.id,
  movable: false,
})

/** A shooting target of the range (a plate of steel, plywood or concrete on a post): a piece of the weapons kit itself, marked as such. */
const targetItem = (id: string, name: string): TestableItem => {
  const prop = targetProp(id, name)
  return { id, name, build: (THREE: unknown) => markKitOrigin(buildProp(THREE as typeof THREE_NS, prop), { owner: 'game-weapons-three', kind: 'target', id }), spec: prop.spec, movable: false }
}

const asItem = (id: string, name: string, prop: WeaponProp, extra: Partial<TestableItem> = {}): TestableItem => ({
  id,
  name,
  build: (THREE: unknown) => buildProp(THREE as typeof THREE_NS, prop),
  spec: prop.spec,
  ...extra,
})

/** Where the counters go and where each weapon lies on them: weapons side by side across the counters in order, each taking its strip, until the counter is full. */
export function weaponsLayout(weaponItemIds: string[], pitchOf: (itemId: string) => number = () => DEFAULT_PITCH): AreaPlacement[] {
  const usable = COUNTER.length - 2 * END_MARGIN
  const slots = COUNTER_Z.flatMap((z) => COUNTER_X.map((x) => ({ x, z })))
  const counterOf: Array<{ x: number; z: number; used: number }> = []
  const placements: AreaPlacement[] = []
  for (const item of weaponItemIds) {
    const pitch = pitchOf(item)
    let counter = counterOf[counterOf.length - 1]
    if (!counter || counter.used + pitch > usable + 1e-9) {
      const slot = slots[counterOf.length]
      if (!slot) throw new Error(`weapons area: ${weaponItemIds.length} weapons do not fit on ${slots.length} counters of ${usable.toFixed(2)} m`)
      if (pitch > usable + 1e-9) throw new Error(`weapons area: "${item}" takes ${pitch} m and a counter holds ${usable.toFixed(2)} m`)
      counter = { ...slot, used: 0 }
      counterOf.push(counter)
    }
    placements.push({ item, position: [counter.x, COUNTER.height + 0.01, counter.z - COUNTER.length / 2 + END_MARGIN + counter.used + pitch / 2], asleep: true })
    counter.used += pitch
  }
  const counters: AreaPlacement[] = counterOf.map(({ x, z }) => ({ item: COUNTER_ITEM_ID, position: [x, 0, z], surface: { halfSize: [COUNTER.depth / 2, COUNTER.length / 2], height: COUNTER.height } }))
  const targets: AreaPlacement[] = TARGETS.map((target) => ({ item: target.id, position: target.at }))
  const explosives: AreaPlacement[] = WORLD_EXPLOSIVES.map((explosive) => ({ item: `${WORLD_EXPLOSIVE_PREFIX}${explosive.id}`, position: explosive.at }))
  return [...counters, ...placements, ...targets, ...explosives]
}

/**
 * The weapons test area as a `TestableModule` of @adatechnology/game-contracts: every weapon of the arsenal on counters, the real model of each one the gallery drew (aim at one and
 * press H to equip it), targets at shooting distance, and, through `attach`, the weapon in the hands with its fire and reload motion,
 * ejected casings, dropped magazines and sounds, driven by the host's tool events.
 */
export function createWeaponsTestModule(options: WeaponsTestModuleOptions = {}): TestableModule & { readonly audio: WeaponAudio | null; readonly fx: WeaponFx | null } {
  const locale = options.locale ?? 'pt-BR'
  const arsenal = options.arsenal ?? createArsenal({ locale })
  const text = textOf(locale)
  const accessoryText = accessoryTextOf(locale)
  const seedOption = options.seed === undefined ? {} : { seed: options.seed }
  // the module's own audio (it makes no context until the first sound); when the host lends a sound engine, `attach` swaps it for one on that engine
  let audio: WeaponAudio | null = options.sound === false ? null : createWeaponAudio(undefined, seedOption)
  const weaponDefs = [...arsenal.weapons.values()].filter((def) => !BODY_ACTIONS.has(def.id))
  const thumbnailBase = options.thumbnailBase ?? DEFAULT_THUMBNAIL_BASE
  const withThumbnail = (item: TestableItem, key: string): TestableItem => {
    const thumbnail = thumbnailBase === false ? undefined : weaponThumbnailUrl(key, thumbnailBase)
    if (!thumbnail) return item
    const thumbnailCredit = weaponThumbnailCredit(key)
    return thumbnailCredit ? { ...item, thumbnail, thumbnailCredit } : { ...item, thumbnail }
  }
  // An archetype wearing the model of a brand weapon is the same thing twice on the counters: it stays in the catalogue (the hands still take it) but is not laid out.
  const weaponIds = weaponDefs.filter((def) => !(def.id in ARCHETYPE_MODELS)).map((def) => `${WEAPON_ITEM_PREFIX}${def.id}`)
  const pitchOf = (itemId: string): number => PITCH_BY_ID[itemId.slice(WEAPON_ITEM_PREFIX.length)] ?? DEFAULT_PITCH
  const worldExplosives = WORLD_EXPLOSIVE_IDS.flatMap((id) => {
    const def = arsenal.explosives.get(id)
    const item = def ? worldExplosiveItem(def, text.worldExplosives[id] ?? id, options.items === undefined ? {} : { items: options.items }) : undefined
    return item ? [item] : []
  })
  const worldExplosiveIds = new Set(worldExplosives.map((item) => item.id))
  const mountedM134Def = arsenal.weapons.get(MOUNTED_M134.weaponId)
  const mountedM134 = mountedM134Def && hasWeaponModel(mountedM134Def.id) ? [mountedM134Item(mountedM134Def, text.mountedM134)] : []
  let fx: WeaponFx | null = null
  let host: ModuleHost | null = null
  let soundDistance = 0
  const heatPercent = (): number => Math.min(100, (host?.tool().heat ?? 0) * 100)
  return {
    id: 'weapons_area',
    name: text.name,
    ground: { surface: 'concrete_slab' },
    group: text.group,
    get audio() {
      return audio
    },
    get fx() {
      return fx
    },
    items: () => [
      ...weaponDefs.map((def) => withThumbnail(weaponItem(def, arsenal.name(def.id), options.items), def.id)),
      counterItem(text.counter),
      ...TARGETS.map((target) => targetItem(target.id, text.targets[target.id] ?? target.id)),
      ...worldExplosives.map((item) => withThumbnail(item, item.id.slice(WORLD_EXPLOSIVE_PREFIX.length))),
      ...mountedM134.map((item) => withThumbnail(item, MOUNTED_M134.weaponId)),
    ],
    scenarios: (scenarioLocale) => weaponsScenarios(scenarioLocale ?? locale),
    area: (): ModuleArea => ({
      placements: [
        ...weaponsLayout(weaponIds, pitchOf).filter((placement) => !placement.item.startsWith(WORLD_EXPLOSIVE_PREFIX) || worldExplosiveIds.has(placement.item)),
        ...mountedM134.map((item) => ({ item: item.id, position: MOUNTED_M134.at, rotationY: MOUNTED_M134.rotationY, asleep: true })),
      ],
      view: { eye: [-3.4, 1.9, 9.2], target: [-9, 0.9, 1.6] },
    }),
    controls: (): ModuleControl[] => [
      {
        kind: 'choice',
        id: 'condition',
        name: text.condition,
        hint: text.conditionHint,
        options: arsenal.rules.conditions.map((entry) => ({ id: entry.id, name: text.conditions[entry.id] ?? entry.id })),
        default: options.condition ?? arsenal.rules.defaultCondition,
      },
      {
        kind: 'choice',
        id: 'ammo_quality',
        name: text.ammoQuality,
        hint: text.ammoQualityHint,
        options: arsenal.rules.ammoQualities.map((entry) => ({ id: entry.id, name: text.ammoQualities[entry.id] ?? entry.id })),
        default: arsenal.rules.defaultAmmoQuality,
      },
      { kind: 'number', id: 'sound_distance', name: text.soundDistance, hint: text.soundDistanceHint, unit: 'm', min: 0, max: SOUND_DISTANCE_MAX, step: 5, default: 0 },
      { kind: 'number', id: 'fuse_length', name: text.fuseLength, hint: text.fuseLengthHint, unit: 'm', min: 0.01, max: FUSE_LENGTH_MAX, step: 0.01, default: arsenal.explosives.get('dynamite')?.fuseLength ?? DEFAULT_FUSE_LENGTH },
      ...accessoryControls(accessoryText),
    ],
    layers: (): ModuleLayer[] => [...(['muzzle_flash', 'casings', 'magazines'] as const).map((id) => ({ id, name: text.layers[id] })), ...accessoryLayers(accessoryText)],
    metrics: (): ModuleMetric[] => [
      { id: 'casings_live', name: text.metrics.casings_live, read: () => fx?.casings ?? 0 },
      { id: 'magazines_live', name: text.metrics.magazines_live, read: () => fx?.magazines ?? 0 },
      { id: 'heat', name: text.metrics.heat, unit: '%', max: 100, digits: 0, read: heatPercent },
      ...accessoryMetrics(accessoryText, () => host?.tool() ?? EMPTY_TOOL),
    ],
    attach(lent) {
      host = lent
      const lentEngine = (lent.audio as EngineSink | undefined)?.engine
      if (audio && lentEngine) {
        audio.dispose()
        audio = createWeaponAudio(undefined, { ...seedOption, engine: lentEngine })
      }
      let simulatedMs = 0
      const offClock = lent.onFrame((dt) => (simulatedMs += dt * 1000))
      const created = createWeaponFx({
        onSound: ({ weapon, cue, profile }) => lent.log(fill(text.soundCue, { weapon: arsenal.name(weapon), cue: text.soundCues[cue] ?? cue }), { weapon, cue, weight: profile.weight, material: profile.material }, 'sound'),
        THREE: lent.THREE as typeof THREE_NS,
        scene: lent.scene as THREE_NS.Scene,
        camera: lent.camera as THREE_NS.Camera,
        arsenal,
        ...(options.items ? { items: options.items } : {}),
        groundAt: lent.groundAt,
        audio,
        tool: lent.tool,
        soundDistance: () => soundDistance,
        raycast: createLaserRaycast(lent.THREE as typeof THREE_NS, lent.scene as THREE_NS.Scene, lent.camera as THREE_NS.Camera),
        // the weapon against a wall asks as often as the laser, on the clock of the simulation (so a fast-forwarded room measures as often per frame)
        contact: createLaserRaycast(lent.THREE as typeof THREE_NS, lent.scene as THREE_NS.Scene, lent.camera as THREE_NS.Camera, { now: () => simulatedMs }),
        ...(lent.holdFrame ? { bodyHold: () => lent.holdFrame?.() ?? null } : {}),
        ...(lent.effects ? { effects: lent.effects } : {}),
        ...(options.attachmentModels ? { attachmentModels: options.attachmentModels } : {}),
        ...(options.condition ? { condition: options.condition } : {}),
        ...(options.seed === undefined ? {} : { seed: options.seed }),
        ...(options.flyRocket === undefined ? {} : { flyRocket: options.flyRocket }),
      })
      fx = created
      const camera = lent.camera as THREE_NS.Camera
      const accessories = createAccessoryBench({ arsenal, host: lent, text: accessoryText })
      const offBench = lent.bench?.onChange((change: BenchChange) => {
        if (accessories.handleChange(change)) return
        if (change.kind === 'layer') {
          if (change.id === 'attachments') created.layers.attachments = change.on
          else if (change.id === 'beams') created.layers.beams = change.on
          else if (change.id === 'muzzle_flash') created.layers.muzzleFlash = change.on
          else if (change.id === 'casings') created.layers.casings = change.on
          else if (change.id === 'magazines') created.layers.magazines = change.on
        } else if (change.kind === 'control' && typeof change.value === 'string') {
          if (change.id === 'condition') {
            created.setCondition(change.value)
            lent.configureTool?.({ condition: change.value })
          } else if (change.id === 'ammo_quality') lent.configureTool?.({ ammo_quality: change.value })
        } else if (change.kind === 'control' && change.id === 'sound_distance' && typeof change.value === 'number') soundDistance = change.value
        else if (change.kind === 'control' && change.id === 'fuse_length' && typeof change.value === 'number') lent.configureTool?.({ fuse_length: String(change.value) })
      })
      const worldEffects = createWorldEffects({ arsenal })
      const offEvents = lent.on((event) => {
        worldEffects.handle(event, lent.effects)
        if (event.type === 'explosion') {
          const away = Math.hypot(event.point[0] - camera.position.x, event.point[1] - camera.position.y, event.point[2] - camera.position.z)
          audio?.play('explosion', Math.min(1, EXPLOSION_VOLUME_BASE + event.radius * EXPLOSION_VOLUME_PER_METRE), away)
          return
        }
        const tool = lent.tool()
        created.handle(event, tool)
        if (event.type === 'reload' && event.phase === 'start') {
          const clip = created.clips.find((entry) => entry.name.startsWith('reload'))
          if (clip) {
            const kind = event.kind ?? 'tactical'
            lent.log(fill(text.reloadClip, { weapon: arsenal.name(event.weapon), kind: text.reloadKinds[kind] ?? kind, clip: clip.name, seconds: clip.seconds.toFixed(2) }), { weapon: event.weapon, kind, clip: clip.name, seconds: clip.seconds })
          }
        }
        if (event.type === 'reload') lent.log(fill(event.phase === 'start' ? text.reloadStart : text.reloadEnd, { weapon: arsenal.name(event.weapon), ammo: tool.ammo, capacity: tool.capacity }), { weapon: event.weapon, phase: event.phase })
      })
      const offFrame = lent.onFrame((dt) => created.update(dt))
      const offHands = lent.setHandTargets?.(() => created.handTargets())
      created.handle({ type: 'tool', weapon: lent.tool().weapon }, lent.tool())
      return () => {
        accessories.dispose()
        offBench?.()
        offEvents()
        offFrame()
        offClock()
        offHands?.()
        created.dispose()
        audio?.dispose()
        fx = null
        host = null
      }
    },
  }
}
