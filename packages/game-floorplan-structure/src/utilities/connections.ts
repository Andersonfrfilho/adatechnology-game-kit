import type { UtilityConnection } from '@adatechnology/game-contracts'
import type { FloorplanResult, Plan, ResultItem } from '@adatechnology/game-floorplan'

import type { Electrical } from './electrical'
import { clamp, round2 } from './shared'

/**
 * Where the house takes one street network, in its plan: `at` is `[u, y, v]` (u along the width, y over the lot's floor, v into the depth), so `at[1]`
 * is a height as in a world point. `connectionsInWorld` turns it into the `UtilityConnection` a street network reads.
 */
export type HouseConnection = Omit<UtilityConnection, 'lot' | 'frame' | 'at'> & { readonly at: readonly [number, number, number] }

/** Load (kVA) of a general socket (NBR 5410, 100 VA) and of a light point. */
const SOCKET_KVA = 0.1
const LIGHT_KVA = 0.1
/** Underground: the telecom box stands this far beside the meter, toward the water stand. */
const TELECOM_BESIDE_METER = 0.3
/** The telecom anchor hangs this far under the power anchor, on the same post or facade. */
const TELECOM_BELOW_POWER = 0.6
/**
 * The inspection box (0.6 × 0.6 m) stands this far inside the lot's front edge, its outlet's bottom this deep (shallow: a lot set far back from its street still takes
 * its lateral over the storm gallery); `facadeClear` keeps it off the front wall (the thickest wall's face and a margin).
 */
export const INSPECTION_BOX = { inset: 1, depth: 0.4, half: 0.3, facadeClear: 0.15, gap: 0.02 } as const
/** From the side of the lot away from the entrance (metres): the inspection box, and the downspout outlet beside it. */
const BOX_FROM_SIDE = 1.2
const DOWNSPOUT_FROM_BOX = 1
/** The water meter stand (cavalete) beside the electric meter, on the side away from the gate. */
const WATER_FROM_METER = 0.6

/** The power (W) of an item's electric shower heater (`showerHeater.powerW`), 0 without one. */
function heaterPowerOf(heater: unknown): number {
  if (typeof heater !== 'object' || heater === null || !('powerW' in heater)) return 0
  return typeof heater.powerW === 'number' ? heater.powerW : 0
}

/** Where the inspection box stands along v: inside the front yard clear of the front wall, else on the sidewalk just outside the lot's front edge (never under the wall). */
export function inspectionBoxV(front: number): number {
  const { inset, half, facadeClear, gap } = INSPECTION_BOX
  const inside = Math.min(front + inset, -facadeClear - half)
  if (inside - half >= front) return round2(inside)
  return round2(Math.min(front, -facadeClear) - half - gap)
}

/** The load the house's circuits install, kVA: a socket and a light point each, and every electric shower heater by its power. */
export function installedKvaOf({ electrical, items }: { readonly electrical: Electrical; readonly items: readonly ResultItem[] }): number {
  const heaters = items.reduce((sum, item) => sum + heaterPowerOf(item.showerHeater), 0)
  return round2(electrical.outlets.length * SOCKET_KVA + electrical.lightPoints.length * LIGHT_KVA + heaters / 1000)
}

/**
 * The five points where a house on a street with a utility network (`street: 'network'`) takes it: the drop's anchor on the meter post (or the facade),
 * the telecom anchor under it, the inspection box outlet, the downspout outlet at the lot's front edge (`connectionsInWorld` carries it out to the kerb)
 * and the water meter stand beside the electric meter. None for a house with no lot or no service entrance.
 */
export function houseConnectionsOf({ plan, electrical, items }: { readonly plan: Plan; readonly electrical: Electrical; readonly items: readonly ResultItem[] }): HouseConnection[] {
  const entrance = electrical.serviceEntrance
  const anchor = entrance?.drop[0]
  const lot = plan.lot
  if (!lot || !entrance || !anchor) return []
  const [left, front, right] = lot.rect
  const gate = plan.gates.find((g) => g.type === 'pedestrian')
  const entranceU = gate?.u ?? anchor[0]
  const away = entranceU < (left + right) / 2 ? 1 : -1
  const boxU = round2(away > 0 ? right - BOX_FROM_SIDE : left + BOX_FROM_SIDE)
  const boxV = inspectionBoxV(front)
  const meter = entrance.meter ?? { u: anchor[0], v: anchor[1] }
  const water = clamp(meter.u + away * WATER_FROM_METER, left + 0.3, right - 0.3)
  // underground: the lateral comes up under the meter box and the telecom box stands beside it at the ground, between the meter and the water stand
  const underground = entrance.street === 'network_underground'
  const telecom: readonly [number, number, number] = underground ? [round2(clamp(anchor[0] + away * TELECOM_BESIDE_METER, left + 0.3, right - 0.3)), 0, anchor[1]] : [anchor[0], round2(anchor[2] - TELECOM_BELOW_POWER), anchor[1]]
  return [
    { network: 'power', at: [anchor[0], anchor[2], anchor[1]], installedKva: installedKvaOf({ electrical, items }) },
    { network: 'telecom', at: telecom },
    { network: 'sewer', at: [boxU, 0, boxV], invert: -INSPECTION_BOX.depth },
    { network: 'storm', at: [round2(boxU - away * DOWNSPOUT_FROM_BOX), 0, front] },
    { network: 'water', at: [round2(water), 0, Math.max(meter.v, front)] },
  ]
}

/** How a lot stands its house in the world: the plan's origin at `(x, y, z)`, turned `ry` about the vertical (as `Object3D.rotation.y`). */
export type ConnectionPlacement = { readonly x: number; readonly z: number; readonly ry: number; readonly y?: number }

export type ConnectionsInWorldParams = {
  /** A plan generated with `street: 'network'` (its `utilities.connections`); any other plan has none. */
  readonly plan: FloorplanResult
  /** The id of the lot of the site (`Lot.id`). */
  readonly lot: string
  readonly placement: ConnectionPlacement
  /** The sidewalk's width (metres): the downspout outlet runs under it from the lot's front edge to the kerb. Default 0, at the lot's edge. */
  readonly kerb?: number
}

/** The connections a plan's `utilities` carries (`street: 'network'`), none for any other plan. */
function connectionsOf(utilities: unknown): readonly HouseConnection[] {
  if (typeof utilities !== 'object' || utilities === null || !('connections' in utilities) || !Array.isArray(utilities.connections)) return []
  return utilities.connections.filter(isHouseConnection)
}

function isHouseConnection(value: unknown): value is HouseConnection {
  return typeof value === 'object' && value !== null && 'network' in value && typeof value.network === 'string' && 'at' in value && Array.isArray(value.at) && value.at.length === 3
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000

/** The plan's connections (`utilities.connections`) placed on the lot, `frame: 'world'`: what a street network (`game-urban/networks`) takes. */
export function connectionsInWorld({ plan, lot, placement, kerb = 0 }: ConnectionsInWorldParams): UtilityConnection[] {
  const cos = Math.cos(placement.ry)
  const sin = Math.sin(placement.ry)
  const base = placement.y ?? 0
  return connectionsOf(plan.utilities).map((connection): UtilityConnection => {
    const [u, y, v] = connection.at
    const along = connection.network === 'storm' ? v - kerb : v
    const at = [round3(placement.x + u * cos + along * sin), round3(base + y), round3(placement.z - u * sin + along * cos)] as const
    return { ...connection, lot, frame: 'world', at, ...(connection.invert === undefined ? {} : { invert: round3(base + connection.invert) }) }
  })
}
