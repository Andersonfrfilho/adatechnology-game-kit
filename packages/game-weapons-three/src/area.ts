import type * as THREE_NS from 'three'
import type { AreaPlacement, DestructibleSpec, ModuleArea, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal } from '@adatechnology/game-weapons'
import { createWeaponAudio } from './audio'
import type { WeaponAudio } from './audio'
import { createWeaponFx } from './fx'
import type { WeaponFx } from './fx'
import { BODY_ACTIONS, buildProp, weaponProp } from './props'
import type { WeaponProp } from './props'

export interface WeaponsTestModuleOptions {
  /** `en` or `pt-BR` (default). */
  locale?: string
  /** The arsenal to lay out (default `createArsenal` with the locale). */
  arsenal?: Arsenal
  /** Play sounds (default true; silent anyway where there is no AudioContext). */
  sound?: boolean
}

/** Prefix of the item ids of the weapon props (`weapon_pistol_9mm`). */
export const WEAPON_ITEM_PREFIX = 'weapon_'
// must not start with WEAPON_ITEM_PREFIX: hosts and tests tell the props apart by it
export const COUNTER_ITEM_ID = 'counter_weapons'

const COUNTER = { length: 4.8, depth: 1.6, height: 0.9 }
const COUNTER_X = [-6.5, -9, -11.5]
const COUNTER_Z = -1
// props closer than this to a counter end have nothing next to them on one side
const END_MARGIN = 0.6
const SLOT_GAP = 0.3
// targets in front of the brick wall of the room, at shooting distances
const TARGETS: Array<{ id: string; at: Vec3 }> = [
  { id: 'target_steel_plate', at: [-1.5, 0, -7] },
  { id: 'target_plywood', at: [0, 0, -7] },
  { id: 'target_concrete', at: [1.5, 0, -7] },
]

const TEXT: Record<string, { group: string; name: string; counter: string; targets: Record<string, string>; reloadStart: string; reloadEnd: string }> = {
  en: {
    group: 'Weapons',
    name: 'Weapons area',
    counter: 'Weapon counter',
    targets: { target_steel_plate: 'Steel plate target', target_plywood: 'Plywood target', target_concrete: 'Concrete block target' },
    reloadStart: 'Reload started: {weapon} ({ammo}/{capacity})',
    reloadEnd: 'Reload done: {weapon} ({ammo}/{capacity})',
  },
  'pt-BR': {
    group: 'Armas',
    name: 'Área de armas',
    counter: 'Balcão de armas',
    targets: { target_steel_plate: 'Alvo: chapa de aço', target_plywood: 'Alvo: compensado', target_concrete: 'Alvo: bloco de concreto' },
    reloadStart: 'Recarga iniciada: {weapon} ({ammo}/{capacity})',
    reloadEnd: 'Recarga completa: {weapon} ({ammo}/{capacity})',
  },
}
const textOf = (locale: string): (typeof TEXT)['en'] => TEXT[locale] ?? TEXT.en
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

const asItem = (id: string, name: string, prop: WeaponProp, extra: Partial<TestableItem> = {}): TestableItem => ({
  id,
  name,
  build: (THREE: unknown) => buildProp(THREE as typeof THREE_NS, prop),
  spec: prop.spec,
  ...extra,
})

/** Where the counters go and where each weapon lies on them: three counters on the free left side of the room, props across them. */
export function weaponsLayout(weaponItemIds: string[]): AreaPlacement[] {
  const perCounter = Math.floor((COUNTER.length - 2 * END_MARGIN) / SLOT_GAP) + 1
  const counters = COUNTER_X.slice(0, Math.max(1, Math.ceil(weaponItemIds.length / perCounter)))
  const placements: AreaPlacement[] = counters.map((x) => ({ item: COUNTER_ITEM_ID, position: [x, 0, COUNTER_Z], surface: { halfSize: [COUNTER.depth / 2, COUNTER.length / 2], height: COUNTER.height } }))
  weaponItemIds.forEach((item, index) => {
    const x = counters[Math.min(counters.length - 1, Math.floor(index / perCounter))]
    const z = COUNTER_Z - COUNTER.length / 2 + END_MARGIN + (index % perCounter) * SLOT_GAP
    // long props side by side overlap in the gentle piece separation of the renderer: asleep, they stay until grabbed
    placements.push({ item, position: [x, COUNTER.height + 0.01, z], asleep: true })
  })
  for (const target of TARGETS) placements.push({ item: target.id, position: target.at })
  return placements
}

/**
 * The weapons test area as a `TestableModule` of @adatechnology/game-contracts: one prop per weapon of the arsenal on counters (aim at one and
 * press H to equip it), targets at shooting distance, and, through `attach`, the weapon in the hands with its fire and reload motion,
 * ejected casings, dropped magazines and sounds, driven by the host's tool events.
 */
export function createWeaponsTestModule(options: WeaponsTestModuleOptions = {}): TestableModule & { readonly audio: WeaponAudio | null; readonly fx: WeaponFx | null } {
  const locale = options.locale ?? 'pt-BR'
  const arsenal = options.arsenal ?? createArsenal({ locale })
  const text = textOf(locale)
  const audio = options.sound === false ? null : createWeaponAudio()
  const weaponDefs = [...arsenal.weapons.values()].filter((def) => !BODY_ACTIONS.has(def.id))
  const weaponIds = weaponDefs.map((def) => `${WEAPON_ITEM_PREFIX}${def.id}`)
  let fx: WeaponFx | null = null
  return {
    id: 'weapons_area',
    name: text.name,
    group: text.group,
    audio,
    get fx() {
      return fx
    },
    items: () => [
      ...weaponDefs.map((def) => asItem(`${WEAPON_ITEM_PREFIX}${def.id}`, arsenal.name(def.id), weaponProp(def, arsenal.name(def.id)), { weapon: def.id, movable: true })),
      asItem(COUNTER_ITEM_ID, text.counter, counterProp(text.counter), { movable: false }),
      ...TARGETS.map((target) => asItem(target.id, text.targets[target.id], targetProp(target.id, text.targets[target.id]), { movable: false })),
    ],
    area: (): ModuleArea => ({ placements: weaponsLayout(weaponIds), view: { eye: [-3.4, 1.7, 2.6], target: [-9, 0.9, -1.2] } }),
    attach(host) {
      const created = createWeaponFx({
        THREE: host.THREE as typeof THREE_NS,
        scene: host.scene as THREE_NS.Scene,
        camera: host.camera as THREE_NS.Camera,
        arsenal,
        groundAt: host.groundAt,
        audio,
      })
      fx = created
      const offEvents = host.on((event) => {
        const tool = host.tool()
        created.handle(event, tool)
        if (event.type === 'reload') host.log(fill(event.phase === 'start' ? text.reloadStart : text.reloadEnd, { weapon: arsenal.name(event.weapon), ammo: tool.ammo, capacity: tool.capacity }), { weapon: event.weapon, phase: event.phase })
      })
      const offFrame = host.onFrame((dt) => created.update(dt))
      created.handle({ type: 'tool', weapon: host.tool().weapon }, host.tool())
      return () => {
        offEvents()
        offFrame()
        created.dispose()
        audio?.dispose()
        fx = null
      }
    },
  }
}
