import type { ItemCatalog, LootTables, ObjectSpec, Strings, Vec3 } from '@adatechnology/game-interactables'
import type { Primitive, PropItem, PropsApi } from '@adatechnology/game-props3d'

export type { Vec3, ObjectSpec, Primitive }

/**
 * The api the host implements. It is the props3d api plus `part`: everything drawn inside `draw` belongs to a movable part and is
 * expressed in the part's frame (relative to `pivot`, then rotated by `ry`). The host makes one movable group per part.
 */
export interface HouseholdApi extends PropsApi {
  part(id: string, pivot: Vec3, ry: number, draw: () => void): void
}

export interface ContentsEntry {
  type: string
  qty: number
  data?: Record<string, unknown>
}

/** A props3d item plus the household extras. Front = local +z, origin at the footprint center on the floor. */
export interface HouseholdItem extends PropItem {
  /** Explicit contents per container id (`{ fridge: [{ type: 'milk_carton', qty: 1 }, null] }`). Wins over the loot table. */
  contents?: Record<string, Array<ContentsEntry | null>>
  /** Side of the door hinge for single-door types. Default depends on the type. */
  hinge?: 'left' | 'right'
  /** Circuit of the socket / lamp (`wall_socket`). */
  circuit?: string
  /** Device ids a `wall_switch` controls. */
  controls?: string[]
  /** `gas_bottle` placed in a cabinet: the valve interaction is available only while this part (world-wide object id) is open. */
  requires?: { object: string; part: string }
  /** `electrical_panel`: the circuits, one breaker each. Default: a single circuit `main`. */
  circuits?: Array<{ id: string; label?: string }>
  /** `conduit_run`: polyline in object-local coordinates. */
  points?: Vec3[]
  /** `service_entrance`: where the drop wire ends (the house attachment point), object-local. */
  house?: Vec3
  /** `service_entrance`: sag of the drop wire in meters. Default 0.35. */
  sag?: number
  /** `wood_stove`: height (item-local, meters) of the top of the flue pipe, and of the smoke emitter. Default: the item height. */
  flueHeight?: number
  /** `fireplace`: height of the chimney top and of the smoke emitter. Default: the item height. */
  chimneyHeight?: number
}

export type HouseholdGroup = 'storage' | 'kitchen' | 'bathroom' | 'electrical' | 'seating' | 'window' | 'yard' | 'rural' | 'camp'

export interface HouseholdTypeDef {
  id: string
  group: HouseholdGroup
  /** Default footprint width (x), depth (z) and height (y), in meters. */
  w: number
  d: number
  h: number
  /** Default mounting height of the base of the object. */
  y: number
  /** false = no collider for the host (wall items, wires). */
  solid: boolean
  /**
   * Real mass of the whole object, empty, in kg (a fridge 70, a camping table 4.5). The drawing is solid blocks, so a mass from its volume would be far off (a fridge of
   * two tonnes): a host that builds a physical body splits this mass over the pieces. Absent for what is built into the ground (a fireplace, a well).
   */
  massKg?: number
}

export interface HouseholdType extends HouseholdTypeDef {
  /** Localized display name. */
  name: string
}

export interface Region {
  id: string
  gas: { kind: string; capacityKg: number; diameter: number; height: number; color: string }
  /** Small camping gas canister (`gas_canister`). */
  canister: { kind: string; capacityKg: number; diameter: number; height: number; color: string }
  socket: { standard: string; pins: number; layout: 'br' | 'us'; voltage: number[]; hz: number }
  mailbox: { style: 'wall' | 'post'; color: string }
  clothesline: { style: string; wires: number }
}

export interface HouseholdOptions {
  /** `en` or `pt-BR`. Default `en`. */
  locale?: string
  /** Region id (`br`, `us`). Default `br` for `pt-BR`, `us` otherwise. */
  region?: string
}

export interface Household {
  types: HouseholdType[]
  items: ItemCatalog
  loot: LootTables
  strings: Record<'en' | 'pt-BR', Strings>
  region: Region
  locale: string
  /** Draws the object through `api` and returns its spec. Deterministic for the same `item.seed`. */
  build(type: string, item: HouseholdItem, api: HouseholdApi): ObjectSpec
}

export type BuilderFn = (c: import('./ctx').Ctx) => void

export type { PropItem }
