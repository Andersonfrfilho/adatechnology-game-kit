// The layout of the whole-house area: every catalogue id of what a house of the kit can hold, each with its name on the floor in front of it. The goods the house
// keeps (the pools of game-items-goods) lie on the items area's tables at the front; the household pieces and the furniture of the house plans stand in labelled
// slots, line after line behind them; what hangs on a wall hangs on the room's target wall. Pure given the room's `measure` and names.
import { HOUSEHOLD_TYPES } from '@adatechnology/game-interactables-household'
import { GOODS_HOUSE_POOLS } from '@adatechnology/game-items-goods'
import { FINDS_TABLE_ID, ITEM_PREFIX } from '@adatechnology/game-items-three'
import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import type { AreaPlacement, GroundLayout, GroundZone, ModuleArea } from '@adatechnology/game-contracts'
import type { ItemSize } from '@adatechnology/game-test-room'

import { ON_THE_WALL, SECTIONS } from './house-tables-data.js'
import type { HouseSection, Locale } from './house-tables-data.js'
import { layHouseTables } from './house-tables-layout.js'

/** Prefix of the catalogue ids the houses area gives the furniture of the plans (`furniture_<type>` of game-floorplan-three's test area). */
export const PLAN_FURNITURE_PREFIX = 'furniture_'

/** Every catalogue id of what a house of the kit can hold, by the module that owns it. Derived from the SDK's own lists: an item added there shows here. */
export interface HouseCatalogue {
  /** The interactive household pieces (game-interactables-household). */
  readonly household: readonly string[]
  /** The furniture of the house plans (the residential catalogue, drawn by game-floorplan-three). */
  readonly furniture: readonly string[]
  /** The goods a house keeps in its furniture (the house pools of game-items-goods). */
  readonly goods: readonly string[]
}

/**
 * Types of the residential catalogue that `furnitureSpec` (the public way to draw one piece of furniture) cannot draw on its own, with why. They are not laid and
 * the check counts them as declared: a type added to the catalogue that does not draw fails the check until it draws or is declared here.
 */
export const PLAN_FURNITURE_WITHOUT_PIECE: Readonly<Record<string, string>> = {
  stairs: 'the stairs are part of the plan (the house draws them between its floors); furnitureSpec has no builder for a loose flight',
  bbq_grill: 'at the catalogue height (1.4 m) the builder draws the chimney 0 m tall, a part the destruction contract refuses; drawing it only when taller changes the houses\' bit-for-bit goldens',
}

/** Every furniture type of the house plans (the residential catalogue the kit's preset gives `furnitureSpec`). */
export const planCatalogueTypes = (): string[] => [...new Set(defaultFurnitureCatalog().map((entry) => entry.type))]

/** The furniture types of the house plans that draw as a piece of their own: the catalogue but the declared ones. */
export const planFurnitureTypes = (): string[] => planCatalogueTypes().filter((type) => !(type in PLAN_FURNITURE_WITHOUT_PIECE))

export function houseCatalogue(): HouseCatalogue {
  const goods = new Set<string>()
  for (const pool of Object.values(GOODS_HOUSE_POOLS.pools)) for (const entry of pool) goods.add(`${ITEM_PREFIX}${entry.item}`)
  return { household: [...HOUSEHOLD_TYPES], furniture: planFurnitureTypes().map((type) => `${PLAN_FURNITURE_PREFIX}${type}`), goods: [...goods] }
}

/** Every id of the catalogue, once. */
export const houseCatalogueIds = (catalogue: HouseCatalogue = houseCatalogue()): string[] => [...new Set([...catalogue.household, ...catalogue.furniture, ...catalogue.goods])]

/** What the layout made: the area, its labelled floor, the ids the room does not have (left out) and where each kind went. */
export interface HouseCompleteLayout {
  readonly area: ModuleArea
  readonly ground: GroundLayout
  readonly missing: readonly string[]
  readonly onTables: ReadonlySet<string>
  readonly onFloor: ReadonlySet<string>
  readonly onWall: ReadonlySet<string>
}

export interface HouseCompletePlan {
  readonly halfX: number
  readonly firstZ: number
  readonly floorFront: number
}

export interface LayHouseCompleteOptions {
  readonly measure: (itemId: string) => ItemSize | null
  readonly nameOf: (itemId: string) => string
  readonly locale: Locale
  readonly plan: HouseCompletePlan
  readonly catalogue?: HouseCatalogue
}

/**
 * What a house stands on a counter (a microwave), piece id to the id it stands on, from the rooms of the house: the household catalogue draws it at the counter's
 * height (the microwave's base 0.9 m up), so laid in a slot of its own on the floor it would hang in the air. It goes over its counter instead, as in the kitchen.
 */
export const ON_TOP_OF: Readonly<Record<string, string>> = Object.assign({}, ...SECTIONS.map((section) => section.onTopOf ?? {}))

/** The height of the top of a placed piece: where it stands plus its measured height. */
export function topOf(measure: LayHouseCompleteOptions['measure'], placement: AreaPlacement): number {
  return placement.position[1] + (measureOf(measure, placement.item)?.h ?? 0)
}

/** Least width of a labelled slot (the sign is 3 m at most and shrinks to the slot), metres. */
const SLOT_MIN = 1.7
const SLOT_GAP = 0.6
const LINE_GAP = 1.6
/** Depth of the strip in front of a piece where its sign lies. */
const SIGN_STRIP = 0.6
const TABLE_AISLE = 2.2

interface Slot {
  readonly item: string
  readonly size: ItemSize
  readonly width: number
}

const goodsSection = (): HouseSection => ({
  id: 'house_goods',
  name: ['Utensílios e coisas da casa', 'House goods and utensils'],
  pools: Object.keys(GOODS_HOUSE_POOLS.pools),
  onTable: [],
  floor: [],
  surface: 'tile_floor',
})

/** Packs slots left to right in lines `2 * halfX` long. */
function linesOf(slots: readonly Slot[], halfX: number): Slot[][] {
  const lines: Slot[][] = []
  let used = 0
  for (const slot of slots) {
    const line = lines.at(-1)
    if (!line || used + slot.width > 2 * halfX) {
      lines.push([slot])
      used = slot.width
      continue
    }
    line.push(slot)
    used += slot.width
  }
  return lines
}

/** The front edge (largest z) the floor lines start at: behind the last line of tables. */
function floorStart(placements: readonly AreaPlacement[], tableDepth: number, firstZ: number): number {
  const tables = placements.filter((placement) => placement.surface)
  if (tables.length === 0) return firstZ
  return Math.min(...tables.map((placement) => placement.position[2])) - tableDepth / 2 - TABLE_AISLE
}

/** The room's measure of a piece, null when the room does not have it or cannot draw it (its builder throws). */
function measureOf(measure: LayHouseCompleteOptions['measure'], item: string): ItemSize | null {
  try {
    return measure(item)
  } catch {
    return null
  }
}

/** The slots of the floor pieces: every household piece and plan furniture but what hangs on the wall; an id the room does not have goes to `missing`. */
function slotsOf(catalogue: HouseCatalogue, measure: LayHouseCompleteOptions['measure'], missing: string[]): Slot[] {
  const onTheWall = new Set(ON_THE_WALL)
  const slots: Slot[] = []
  for (const item of [...catalogue.household, ...catalogue.furniture]) {
    if (onTheWall.has(item) || (item in ON_TOP_OF && [...catalogue.household, ...catalogue.furniture].includes(ON_TOP_OF[item] as string))) continue
    const size = measureOf(measure, item)
    if (!size) {
      missing.push(item)
      continue
    }
    slots.push({ item, size, width: Math.max(size.w, SLOT_MIN) + SLOT_GAP })
  }
  return slots
}

/**
 * Lays the whole house: the goods on tables (the house-on-tables layout), the wall pieces on the target wall, and every other piece of the catalogue in a slot of
 * its own with its name on the floor in front. `measure` is the room's: an id it did not load is left out and listed in `missing`.
 */
export function layHouseComplete(options: LayHouseCompleteOptions): HouseCompleteLayout {
  const { measure, nameOf, locale, plan } = options
  const catalogue = options.catalogue ?? houseCatalogue()
  const tables = layHouseTables(measure, locale, { sections: [goodsSection()], halfX: plan.halfX, firstZ: plan.firstZ, wall: ON_THE_WALL, floorFront: plan.floorFront })
  const missing = [...tables.missing]
  const onWall = new Set(ON_THE_WALL.filter((item) => tables.area.placements.some((placement) => placement.item === item)))
  const placements: AreaPlacement[] = [...tables.area.placements]
  const zones: GroundZone[] = [...(tables.ground.zones ?? [])]
  const onFloor = new Set<string>()
  // a counter's sign names what stands on it too
  const labelOf = (item: string): string => [item, ...Object.keys(ON_TOP_OF).filter((top) => ON_TOP_OF[top] === item)].map(nameOf).join(' + ')
  let z = floorStart(placements, measure(FINDS_TABLE_ID)?.d ?? 0, plan.firstZ)
  for (const line of linesOf(slotsOf(catalogue, measure, missing), plan.halfX)) {
    const depth = Math.max(...line.map((slot) => slot.size.d))
    const centreZ = z - SIGN_STRIP - depth / 2
    let x = -plan.halfX
    for (const slot of line) {
      placements.push({ item: slot.item, position: [x + slot.width / 2, 0, centreZ] })
      zones.push({ rect: [x + SLOT_GAP / 4, centreZ - depth / 2 - 0.1, x + slot.width - SLOT_GAP / 4, z], surface: 'tile_floor', label: labelOf(slot.item) })
      onFloor.add(slot.item)
      x += slot.width
    }
    z = centreZ - depth / 2 - LINE_GAP
  }
  // what stands on a counter is laid over the counter's slot, on its top: it is a loose body the room sets down by the bottom of what it draws, so it stands on the
  // counter (never inside it on the floor) and goes with it
  for (const [item, base] of Object.entries(ON_TOP_OF)) {
    const under = placements.find((placement) => placement.item === base)
    if (!under || onFloor.has(item)) continue
    if (!measureOf(measure, item)) {
      missing.push(item)
      continue
    }
    placements.push({ item, position: [under.position[0], topOf(measure, under), under.position[2]] })
    onFloor.add(item)
  }
  return {
    area: { placements, ...(tables.area.view ? { view: tables.area.view } : {}) },
    ground: { surface: tables.ground.surface, zones },
    missing,
    onTables: tables.onTables,
    onFloor,
    onWall,
  }
}
