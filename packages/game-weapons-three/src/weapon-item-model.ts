import type * as THREE_NS from 'three'
import type { WeaponDef } from '@adatechnology/game-weapons'

import { drawItemWeapon } from './item-weapon-draw'
import { DEFAULT_ITEM_MODELS } from './item-models'
import type { ItemModels } from './item-models'
import { buildExplosiveModel, hasExplosiveModel } from './models/explosives'
import { buildMeleeModel, hasMeleeModel } from './models/melee'
import { buildProp, weaponProp } from './props'

/** How a weapon is drawn from an item model of game-items-three: the item (default the weapon id), and the turns the laying-down rule gets wrong. */
export interface WeaponItemModel {
  /** Catalog id of the item model; the weapon id when absent. */
  readonly item?: string
  /** Quarter turns about y after the long axis is laid along x (a crossbow's stock is shorter than its limbs). */
  readonly turn?: number
  /** Turn it end for end after the head is found (the head is the narrow end: a knife's blade, a screwdriver's tip, an extinguisher's nozzle). */
  readonly flip?: boolean
}

// the weapons whose item has another id, or that the laying-down rule turns the wrong way
export const SHIPPED_WEAPON_ITEM_MODELS: ReadonlyArray<readonly [string, WeaponItemModel]> = [
  ['wrench', { item: 'adjustable_wrench' }],
  ['extinguisher', { item: 'fire_extinguisher', flip: true }],
  ['blowtorch', { item: 'gas_torch', flip: true }],
  ['crossbow', { turn: 1 }],
  ['knife', { flip: true }],
  ['meat_cleaver', { flip: true }],
  ['screwdriver', { flip: true }],
  // the Itens do Vale Cinzento hammer is a claw hammer: the head and the two-pronged claw
  ['claw_hammer', { item: 'hammer' }],
]

/** The weapons whose item model has another id or turns another way, with the draw that reads them: one set, with no other set sharing it. */
export interface WeaponProps {
  /** Draws a weapon the gallery did not model with an item model of game-items-three (a game adds its own or corrects one; `null` keeps the low-poly prop). */
  register(weaponId: string, model: WeaponItemModel | null): void
  /** The override of a weapon, if the set has one. */
  get(weaponId: string): WeaponItemModel | undefined
  /** The item model of game-items-three that draws a weapon, or undefined when there is none. */
  itemModelOf(weaponId: string, items?: ItemModels): string | undefined
  /** `buildItemWeaponModel` with this set's overrides. */
  buildItemModel(THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>, items?: ItemModels): THREE_NS.Group | undefined
  /** `buildWeaponModel` with this set's overrides. */
  buildModel(THREE: typeof THREE_NS, def: WeaponModelDef, items?: ItemModels): THREE_NS.Group
}

/** What a weapon model is drawn from: the id, the category and mass of the low-poly prop, and the action that names a throwable's explosive. */
export type WeaponModelDef = Pick<WeaponDef, 'id' | 'category' | 'mass'> & Partial<Pick<WeaponDef, 'action'>>

/** The gallery model of the explosive a throwable carries (the frag grenade's M67, the molotov, the dynamite...), or undefined for any other weapon. */
/** Whether the gallery drew the explosive a throwable carries. */
export const hasThrowableModel = (def: Partial<Pick<WeaponDef, 'action'>>): boolean => def.action?.kind === 'throwable' && def.action.explosive !== undefined && hasExplosiveModel(def.action.explosive)

/** Whether the kit drew the melee weapon itself (the KA-BAR, the katana, the brass knuckles). */
export const hasHandheldModel = (def: Pick<WeaponDef, 'id'>): boolean => hasMeleeModel(def.id)

/** The model of a melee weapon the kit drew, lying as the item models do (see `buildMeleeModel`), or undefined for any other weapon. */
export const buildHandheldModel = (THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>): THREE_NS.Group | undefined => buildMeleeModel(THREE, def.id)

export const buildThrowableModel = (THREE: typeof THREE_NS, def: Partial<Pick<WeaponDef, 'action'>>): THREE_NS.Group | undefined =>
  def.action?.kind === 'throwable' && def.action.explosive !== undefined ? buildExplosiveModel(THREE, def.action.explosive) : undefined

export const weaponPropsOver = (models: Map<string, WeaponItemModel>): WeaponProps => {
  const itemModelOf = (weaponId: string, items?: ItemModels): string | undefined => {
    const id = models.get(weaponId)?.item ?? weaponId
    return id && (items ?? DEFAULT_ITEM_MODELS).has(id) ? id : undefined
  }
  const buildItemModel = (THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>, items?: ItemModels): THREE_NS.Group | undefined => {
    const itemId = itemModelOf(def.id, items)
    if (!itemId) return undefined
    return drawItemWeapon({ THREE, def, items, itemId, turn: models.get(def.id)?.turn ?? 0, flip: models.get(def.id)?.flip === true })
  }
  return {
    register: (weaponId, model) => void models.set(weaponId, model ?? { item: '' }),
    get: (weaponId) => models.get(weaponId),
    itemModelOf,
    buildItemModel,
    buildModel: (THREE, def, items) => buildItemModel(THREE, def, items) ?? buildHandheldModel(THREE, def) ?? buildThrowableModel(THREE, def) ?? buildProp(THREE, weaponProp(def)),
  }
}

let defaultProps: WeaponProps | undefined

/** The set behind `registerWeaponItemModel`, `itemModelOfWeapon`, `buildItemWeaponModel` and `buildWeaponModel`, created on first use. */
export const defaultWeaponProps = (): WeaponProps => (defaultProps ??= weaponPropsOver(new Map(SHIPPED_WEAPON_ITEM_MODELS)))

/** @deprecated use `createWeaponProps(...).register`. */
export const registerWeaponItemModel = (weaponId: string, model: WeaponItemModel | null): void => defaultWeaponProps().register(weaponId, model)

/** The item model of game-items-three that draws a weapon (`baseball_bat`, `axe`, `fire_extinguisher`...), or undefined when there is none. @deprecated use `createWeaponProps(...).itemModelOf`. */
export const itemModelOfWeapon = (weaponId: string, items?: ItemModels): string | undefined => defaultWeaponProps().itemModelOf(weaponId, items)

/**
 * A weapon the gallery did not draw, with the team's item model (Itens do Vale Cinzento: the bat, the axe, the machete, the extinguisher...): its long axis turned
 * along +x and laid flat, the wider end (the head) at +x unless `registerWeaponItemModel` says otherwise, the origin at the bottom centre, an empty `handle` at the narrow end where the hand closes. Undefined
 * when `items` (the item models of game-items-three, lent by the host; default `itemModels` there) has none of it.
 * @deprecated use `createWeaponProps(...).buildItemModel`.
 */
export const buildItemWeaponModel = (THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>, items?: ItemModels): THREE_NS.Group | undefined => defaultWeaponProps().buildItemModel(THREE, def, items)

/** The model of a weapon for the hands or a shelf: the team's item model when the kit has one (`buildItemWeaponModel`), the gallery model of a throwable's explosive, the low-poly prop the counters show otherwise. @deprecated use `createWeaponProps(...).buildModel`. */
export const buildWeaponModel = (THREE: typeof THREE_NS, def: WeaponModelDef, items?: ItemModels): THREE_NS.Group => defaultWeaponProps().buildModel(THREE, def, items)
