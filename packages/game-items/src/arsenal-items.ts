import type { CategoryDef, ItemDef, ItemPack, Rarity } from './types'

/** The part of a weapon definition the bridge reads; `WeaponDef` of `@adatechnology/game-weapons` fits it without importing the package. */
export interface ArsenalWeaponLike {
  readonly id: string
  readonly mass: number
  readonly action: { readonly kind: string; readonly explosive?: string }
  readonly dimensions?: { readonly length: number }
}

/** The part of a calibre definition the bridge reads; `CaliberDef` fits it. */
export interface ArsenalCaliberLike {
  readonly id: string
  readonly bulletGrams: number
  readonly pellets?: number
  readonly caseType?: string
  readonly cartridge?: { readonly caseDiameter: number; readonly overallLength: number }
}

/** The part of an `Arsenal` the bridge reads. */
export interface ArsenalLike {
  readonly weapons: ReadonlyMap<string, ArsenalWeaponLike>
  readonly calibers: ReadonlyMap<string, ArsenalCaliberLike>
}

/** What the team's game says of a box or an arsenal item (`ammo-boxes.json`, from its `EXTRA` table); it wins over the estimates below. */
export interface ArsenalItemRecord {
  /** Id of the item; without it the bridge uses `ammo_<caliber>`, `firearm_<weapon>` or `throwable_<weapon>`. */
  id?: string
  kind: 'ammo_box' | 'firearm' | 'throwable'
  /** Calibre id of a box. */
  caliber?: string
  /** Weapon id of a firearm or throwable; for a throwable also the explosive it uses. */
  weapon?: string
  rounds?: number
  weight: number
  rarity: Rarity
}

export interface ArsenalItemsOptions {
  records?: readonly ArsenalItemRecord[]
}

export const ARSENAL_CATEGORIES: readonly CategoryDef[] = [
  { id: 'ammo', name: 'Ammo' },
  { id: 'firearms', name: 'Firearms' },
  { id: 'throwables', name: 'Throwables' },
]

const MM = 0.001
const BOX_TARE_KG = 0.03
const BOX_WALL = 6 * MM
const ROUNDS_BY_CASE: Readonly<Record<string, number>> = { tiny: 50, pistol: 50, rifle: 20, shell: 25, big: 10 }
const DEFAULT_ROUNDS = 12
const CARTRIDGE_MASS_FACTOR = 2.3
const SHELL_MASS_FACTOR = 1.5
const BOX_DENSITY_KG_PER_M3 = 600
const THROWABLE_DENSITY_KG_PER_M3 = 1500

const cubeSide = (mass: number, density: number): number => Math.cbrt(mass / density)

/** Estimates (REF) for a calibre the game has no box for: rounds by case type, mass of the rounds plus a tare, a box that packs them in a near-square tray. */
const estimateBox = (caliber: ArsenalCaliberLike): { rounds: number; weight: number; size: [number, number, number] } => {
  const rounds = ROUNDS_BY_CASE[caliber.caseType ?? ''] ?? DEFAULT_ROUNDS
  const factor = caliber.caseType === 'shell' ? SHELL_MASS_FACTOR : CARTRIDGE_MASS_FACTOR
  const weight = Number((rounds * caliber.bulletGrams * (caliber.pellets ?? 1) * factor * 0.001 + BOX_TARE_KG).toFixed(3))
  return { rounds, weight, size: boxSize(caliber, rounds, weight) }
}

const boxSize = (caliber: ArsenalCaliberLike, rounds: number, weight: number): [number, number, number] => {
  if (!caliber.cartridge) {
    const side = cubeSide(weight, BOX_DENSITY_KG_PER_M3)
    return [side, side, side]
  }
  const rows = Math.ceil(Math.sqrt(rounds))
  const columns = Math.ceil(rounds / rows)
  const { caseDiameter, overallLength } = caliber.cartridge
  return [rows * caseDiameter * MM + BOX_WALL, overallLength * MM + BOX_WALL, columns * caseDiameter * MM + BOX_WALL]
}

const ammoItem = (caliber: ArsenalCaliberLike, record: ArsenalItemRecord | undefined): ItemDef => {
  const estimate = estimateBox(caliber)
  const weight = record?.weight ?? estimate.weight
  return {
    id: record?.id ?? `ammo_${caliber.id}`,
    category: 'ammo',
    size: record?.weight === undefined ? estimate.size : boxSize(caliber, record.rounds ?? estimate.rounds, weight),
    weight,
    stack: 4,
    shape: 'box',
    rarity: record?.rarity ?? 'uncommon',
  }
}

/** A firearm's size from its length: height and thickness grow with it (a pistol 0.2 m is 0.10 x 0.03, a rifle 1 m is 0.20 x 0.05). Without a length, one from the mass. */
const firearmSize = (weapon: ArsenalWeaponLike): [number, number, number] => {
  const length = weapon.dimensions?.length ?? 0.15 + 0.2 * weapon.mass
  return [length, 0.08 + 0.12 * length, 0.02 + 0.03 * length]
}

const weaponItem = (weapon: ArsenalWeaponLike, record: ArsenalItemRecord | undefined): ItemDef => {
  const isFirearm = weapon.action.kind === 'firearm'
  const side = cubeSide(weapon.mass, THROWABLE_DENSITY_KG_PER_M3)
  return {
    id: record?.id ?? `${isFirearm ? 'firearm' : 'throwable'}_${weapon.id}`,
    category: isFirearm ? 'firearms' : 'throwables',
    size: isFirearm ? firearmSize(weapon) : [side, side, side],
    weight: record?.weight ?? weapon.mass,
    stack: 1,
    shape: isFirearm ? 'long_tool' : 'jar',
    rarity: record?.rarity ?? 'unique',
    weapon: weapon.id,
  }
}

const recordFor = (records: readonly ArsenalItemRecord[], match: (record: ArsenalItemRecord) => boolean): ArsenalItemRecord | undefined => records.find(match)

/**
 * The arsenal as items, so a bag can carry it: a box `ammo_<caliber>` for every calibre, `firearm_<id>` for every firearm and `throwable_<id>` for every
 * throwable, with the mass and the real dimensions of the `WeaponDef` (`mass`, `dimensions.length`). A record from the team's game (`records`) gives the rounds
 * per box, the weight and the rarity of what it listed (9x19: 20 rounds, 0.24 kg); the rest are estimated from the calibre (REF): rounds by case type,
 * weight from the bullet. Returns a pack (with the `ammo`, `firearms` and `throwables` categories) for `createItems({ packs })`.
 */
export const itemsFromArsenal = (arsenal: ArsenalLike, options: ArsenalItemsOptions = {}): ItemPack => {
  const records = options.records ?? []
  const items: ItemDef[] = []
  for (const caliber of arsenal.calibers.values()) items.push(ammoItem(caliber, recordFor(records, (record) => record.kind === 'ammo_box' && record.caliber === caliber.id)))
  for (const weapon of arsenal.weapons.values()) {
    const kind = weapon.action.kind
    if (kind !== 'firearm' && kind !== 'throwable') continue
    items.push(weaponItem(weapon, recordFor(records, (record) => record.kind === kind && (record.weapon === weapon.id || record.weapon === weapon.action.explosive))))
  }
  return { id: 'arsenal', items, categories: ARSENAL_CATEGORIES }
}
