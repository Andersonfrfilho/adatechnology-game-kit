import type * as THREE_NS from 'three'
import type { AreaPlacement, BenchChange, DestructibleSpec, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal, WeaponDef } from '@adatechnology/game-weapons'
import { createWeaponAudio } from './audio'
import type { WeaponAudio } from './audio'
import { createWeaponFx } from './fx'
import type { WeaponFx } from './fx'
import { hasWeaponModel } from './models'
import { BODY_ACTIONS, buildModeledProp, buildProp, modeledPropSpec, weaponProp } from './props'
import type { WeaponProp } from './props'
import { WORLD_EXPLOSIVE_IDS, WORLD_EXPLOSIVE_PREFIX, worldExplosiveItem } from './world-explosives'

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
}

/** Prefix of the item ids of the weapon props (`weapon_pistol_9mm`). */
export const WEAPON_ITEM_PREFIX = 'weapon_'
// must not start with WEAPON_ITEM_PREFIX: hosts and tests tell the props apart by it
export const COUNTER_ITEM_ID = 'counter_weapons'

// how loud an explosion is: a base plus what its reach adds (the game's `explosao` class is at full volume for a blast of 15 m or more)
const EXPLOSION_VOLUME_BASE = 0.4
const EXPLOSION_VOLUME_PER_METRE = 0.04
const SOUND_DISTANCE_MAX = 200
const COUNTER = { length: 4.8, depth: 1.6, height: 0.9 }
// three columns on the free left side of the room, in two rows: counters fill in this order
const COUNTER_X = [-6.5, -9, -11.5]
const COUNTER_Z = [-1, 5.5]
// props closer than this to a counter end have nothing next to them on one side
const END_MARGIN = 0.5
// the strip of counter a weapon lying across it takes: most are slim, a few are wide (a tripod, two fuel tanks, a bow limb)
const DEFAULT_PITCH = 0.16
const PITCH_BY_ID: Readonly<Record<string, number>> = { browning_m2: 0.5, m2_flamethrower: 0.45, bow: 0.3, crossbow: 0.3 }
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

interface Text {
  group: string
  name: string
  counter: string
  targets: Record<string, string>
  reloadStart: string
  reloadEnd: string
  worldExplosives: Record<string, string>
  condition: string
  conditionHint: string
  conditions: Record<string, string>
  ammoQuality: string
  ammoQualityHint: string
  ammoQualities: Record<string, string>
  soundDistance: string
  soundDistanceHint: string
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
    reloadEnd: 'Reload done: {weapon} ({ammo}/{capacity})',
    worldExplosives: { fuel_barrel: 'Fuel barrel', propane_p13: 'Propane cylinder (P13)', car_fuel_tank: 'Car fuel tank' },
    condition: 'Weapon condition',
    conditionHint: 'Wear of the weapon: it jams more and the metal shows it',
    conditions: { new: 'New', used: 'Used', worn: 'Worn', rusty: 'Rusty' },
    ammoQuality: 'Ammunition',
    ammoQualityHint: 'Reloaded rounds misfire more often',
    ammoQualities: { factory: 'Factory', reloaded: 'Reloaded' },
    soundDistance: 'Sound distance',
    soundDistanceHint: 'How far the listener is from the shot: farther is quieter and duller',
    layers: { muzzle_flash: 'Muzzle flash', casings: 'Ejected casings', magazines: 'Dropped magazines' },
    metrics: { casings_live: 'Casings in the scene', magazines_live: 'Magazines in the scene', heat: 'Barrel heat' },
  },
  'pt-BR': {
    group: 'Armas',
    name: 'Área de armas',
    counter: 'Balcão de armas',
    targets: { target_steel_plate: 'Alvo: chapa de aço', target_plywood: 'Alvo: compensado', target_concrete: 'Alvo: bloco de concreto' },
    reloadStart: 'Recarga iniciada: {weapon} ({ammo}/{capacity})',
    reloadEnd: 'Recarga completa: {weapon} ({ammo}/{capacity})',
    worldExplosives: { fuel_barrel: 'Barril de combustível', propane_p13: 'Botijão de gás (P13)', car_fuel_tank: 'Tanque de combustível do carro' },
    condition: 'Estado da arma',
    conditionHint: 'Desgaste da arma: trava mais e o metal mostra',
    conditions: { new: 'Nova', used: 'Usada', worn: 'Gasta', rusty: 'Enferrujada' },
    ammoQuality: 'Munição',
    ammoQualityHint: 'Munição recarregada falha mais',
    ammoQualities: { factory: 'De fábrica', reloaded: 'Recarregada' },
    soundDistance: 'Distância do som',
    soundDistanceHint: 'Quão longe o ouvinte está do tiro: mais longe soa mais baixo e abafado',
    layers: { muzzle_flash: 'Clarão do cano', casings: 'Cápsulas ejetadas', magazines: 'Pentes que caem' },
    metrics: { casings_live: 'Cápsulas na cena', magazines_live: 'Pentes na cena', heat: 'Calor do cano' },
  },
}
const textOf = (locale: string): Text => TEXT[locale] ?? (TEXT.en as Text)
const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))

const counterProp = (name: string): WeaponProp => {
  const { length, depth, height } = COUNTER
  return {
    spec: {
      name,
      parts: [
        { id: 'top', material: 'wood_soft', shape: { kind: 'box', size: [depth, 0.05, length] }, position: [0, height - 0.025, 0] },
        { id: 'side_a', material: 'plywood', shape: { kind: 'box', size: [depth - 0.1, height - 0.05, 0.05] }, position: [0, (height - 0.05) / 2, -length / 2 + 0.05], anchored: true },
        { id: 'side_b', material: 'plywood', shape: { kind: 'box', size: [depth - 0.1, height - 0.05, 0.05] }, position: [0, (height - 0.05) / 2, length / 2 - 0.05], anchored: true },
      ],
      joints: [
        { a: 'top', b: 'side_a', kind: 'screw' },
        { a: 'top', b: 'side_b', kind: 'screw' },
      ],
      tags: ['furniture'],
    },
    colors: { top: 0x8a5a30, side_a: 0x6b4426, side_b: 0x6b4426 },
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

/** A weapon on the counters: the gallery model when it drew one (one rigid body of its measures), the low-poly prop of its category when it did not. */
const weaponItem = (def: WeaponDef, name: string): TestableItem => {
  const id = `${WEAPON_ITEM_PREFIX}${def.id}`
  if (!hasWeaponModel(def.id)) return asItem(id, name, weaponProp(def, name), { weapon: def.id, movable: true })
  return {
    id,
    name,
    build: (THREE: unknown) => buildModeledProp(THREE as typeof THREE_NS, def, name) as THREE_NS.Group,
    spec: (root: unknown) => modeledPropSpec(root, def, name),
    weapon: def.id,
    movable: true,
  }
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
      const slot = slots[Math.min(counterOf.length, slots.length - 1)] as { x: number; z: number }
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
  const audio = options.sound === false ? null : createWeaponAudio(undefined, options.seed === undefined ? {} : { seed: options.seed })
  const weaponDefs = [...arsenal.weapons.values()].filter((def) => !BODY_ACTIONS.has(def.id))
  const weaponIds = weaponDefs.map((def) => `${WEAPON_ITEM_PREFIX}${def.id}`)
  const pitchOf = (itemId: string): number => PITCH_BY_ID[itemId.slice(WEAPON_ITEM_PREFIX.length)] ?? DEFAULT_PITCH
  const worldExplosives = WORLD_EXPLOSIVE_IDS.flatMap((id) => {
    const def = arsenal.explosives.get(id)
    const item = def ? worldExplosiveItem(def, text.worldExplosives[id] ?? id) : undefined
    return item ? [item] : []
  })
  const worldExplosiveIds = new Set(worldExplosives.map((item) => item.id))
  let fx: WeaponFx | null = null
  let host: ModuleHost | null = null
  let soundDistance = 0
  const heatPercent = (): number => Math.min(100, (host?.tool().heat ?? 0) * 100)
  return {
    id: 'weapons_area',
    name: text.name,
    group: text.group,
    audio,
    get fx() {
      return fx
    },
    items: () => [
      ...weaponDefs.map((def) => weaponItem(def, arsenal.name(def.id))),
      asItem(COUNTER_ITEM_ID, text.counter, counterProp(text.counter), { movable: false }),
      ...TARGETS.map((target) => asItem(target.id, text.targets[target.id] ?? target.id, targetProp(target.id, text.targets[target.id] ?? target.id), { movable: false })),
      ...worldExplosives,
    ],
    area: (): ModuleArea => ({
      placements: weaponsLayout(weaponIds, pitchOf).filter((placement) => !placement.item.startsWith(WORLD_EXPLOSIVE_PREFIX) || worldExplosiveIds.has(placement.item)),
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
    ],
    layers: (): ModuleLayer[] => (['muzzle_flash', 'casings', 'magazines'] as const).map((id) => ({ id, name: text.layers[id] })),
    metrics: (): ModuleMetric[] => [
      { id: 'casings_live', name: text.metrics.casings_live, read: () => fx?.casings ?? 0 },
      { id: 'magazines_live', name: text.metrics.magazines_live, read: () => fx?.magazines ?? 0 },
      { id: 'heat', name: text.metrics.heat, unit: '%', max: 100, digits: 0, read: heatPercent },
    ],
    attach(lent) {
      host = lent
      const created = createWeaponFx({
        THREE: lent.THREE as typeof THREE_NS,
        scene: lent.scene as THREE_NS.Scene,
        camera: lent.camera as THREE_NS.Camera,
        arsenal,
        groundAt: lent.groundAt,
        audio,
        tool: lent.tool,
        soundDistance: () => soundDistance,
        ...(options.condition ? { condition: options.condition } : {}),
        ...(options.seed === undefined ? {} : { seed: options.seed }),
      })
      fx = created
      const camera = lent.camera as THREE_NS.Camera
      const offBench = lent.bench?.onChange((change: BenchChange) => {
        if (change.kind === 'layer') {
          if (change.id === 'muzzle_flash') created.layers.muzzleFlash = change.on
          else if (change.id === 'casings') created.layers.casings = change.on
          else if (change.id === 'magazines') created.layers.magazines = change.on
        } else if (change.kind === 'control' && typeof change.value === 'string') {
          if (change.id === 'condition') {
            created.setCondition(change.value)
            lent.configureTool?.({ condition: change.value })
          } else if (change.id === 'ammo_quality') lent.configureTool?.({ ammoQuality: change.value })
        } else if (change.kind === 'control' && change.id === 'sound_distance' && typeof change.value === 'number') soundDistance = change.value
      })
      const offEvents = lent.on((event) => {
        if (event.type === 'explosion') {
          const away = Math.hypot(event.point[0] - camera.position.x, event.point[1] - camera.position.y, event.point[2] - camera.position.z)
          audio?.play('explosion', Math.min(1, EXPLOSION_VOLUME_BASE + event.radius * EXPLOSION_VOLUME_PER_METRE), away)
          return
        }
        const tool = lent.tool()
        created.handle(event, tool)
        if (event.type === 'reload') lent.log(fill(event.phase === 'start' ? text.reloadStart : text.reloadEnd, { weapon: arsenal.name(event.weapon), ammo: tool.ammo, capacity: tool.capacity }), { weapon: event.weapon, phase: event.phase })
      })
      const offFrame = lent.onFrame((dt) => created.update(dt))
      created.handle({ type: 'tool', weapon: lent.tool().weapon }, lent.tool())
      return () => {
        offBench?.()
        offEvents()
        offFrame()
        created.dispose()
        audio?.dispose()
        fx = null
        host = null
      }
    },
  }
}
