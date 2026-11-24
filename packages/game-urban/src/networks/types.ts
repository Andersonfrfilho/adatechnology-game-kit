import type { NetworkRules } from './rules'

/** The networks of a street. `power_lv` is the low voltage the houses take; `lighting` is the street lights fed by it. */
export type NetworkKind = 'power_mv' | 'power_lv' | 'lighting' | 'telecom' | 'sewer' | 'storm' | 'water'

export type NetworkNodeKind =
  | 'feed'
  | 'pole'
  | 'transformer'
  | 'light'
  | 'splice'
  | 'manhole'
  | 'cleanout'
  | 'inlet'
  | 'outfall'
  | 'valve'
  | 'hydrant'
  | 'reservoir'
  | 'treatment'
  | 'connection'

/** A point of a network, in world metres. */
export type NetworkNode = {
  /** Stable: 'pole:main_street:07', 'pv:main_street:03', 'lot:street_south_3:sewer'. */
  readonly id: string
  readonly kind: NetworkNodeKind
  /** `y` is the fixing height of an aerial point, or the level of the cover of a buried one (the ground there). */
  readonly at: readonly [number, number, number]
  /** Buried: the level of the bottom of the pipe at this node. */
  readonly invert?: number
  readonly carries: readonly NetworkKind[]
  /** Id in a registry: the pole `concrete_distribution`, the transformer `t45`, the cover `pv_600`. */
  readonly spec?: string
  /** A connection node: the lot it serves. */
  readonly lot?: string
  /** A guy wire holds the pole (corner and end of line). */
  readonly guyed?: boolean
}

export type NetworkEdgeKind =
  | 'mv_span'
  | 'lv_span'
  | 'telecom_span'
  | 'service_drop'
  | 'telecom_drop'
  | 'light_feed'
  | 'sewer_main'
  | 'sewer_lateral'
  | 'storm_gallery'
  | 'storm_lateral'
  | 'storm_gutter'
  | 'water_main'
  | 'water_service'

/** An aerial edge: a span between poles or a drop to a lot. */
export type AerialEdgeKind = 'mv_span' | 'lv_span' | 'telecom_span' | 'service_drop' | 'telecom_drop' | 'light_feed'
/** A buried edge: a pipe. */
export type BuriedEdgeKind = Exclude<NetworkEdgeKind, AerialEdgeKind>

/**
 * The class a rule reads an edge by: the clearance of a conductor, the slope and cover of a pipe. A service drop has the clearance of the
 * low voltage, a light feed is the short link from the pole to its lamp.
 */
export type NetworkClass = 'power_mv' | 'power_lv' | 'street_light' | 'service_drop' | 'telecom' | 'sewer' | 'storm' | 'water'
/** The classes of the conductors in the air. */
export type AerialClass = Extract<NetworkClass, 'power_mv' | 'power_lv' | 'street_light' | 'service_drop' | 'telecom'>

/** A link between two nodes, in the direction of the flow: from the source to the load, and from the house to the destination. */
export type NetworkEdge = {
  readonly id: string
  readonly kind: NetworkEdgeKind
  readonly from: string
  readonly to: string
  /** Buried: metres. */
  readonly diameter?: number
  /** Gravity networks: m/m, positive along the flow. When the inverts are known the validator reads the slope from them. */
  readonly slope?: number
  /** Aerial: metres of sag at mid span. */
  readonly sag?: number
  /** 3 phases of medium voltage, 4 of low voltage, 1..n telecom cables. */
  readonly conductors?: number
  /** Aerial: the fixing heights at `from` and `to` when they are not the nodes' own (a pole carries each network at its own band). */
  readonly heights?: readonly [number, number]
  /** Buried: the inverts at `from` and `to` when they are not the nodes' own (a lateral entering a main from above). */
  readonly inverts?: readonly [number, number]
}

/** The networks of a district, as data. */
export type UtilityNetworks = {
  readonly nodes: readonly NetworkNode[]
  readonly edges: readonly NetworkEdge[]
  readonly seed: number
  readonly rules: NetworkRules
}

/** What lies under a point of an aerial span, for the clearance table. */
export type NetworkSurface = 'road' | 'sidewalk' | 'lot'

/** A building a span must not cross, by its plan outline (world x, z) and height. */
export type NetworkBuilding = {
  readonly id: string
  /** The lot it stands on: a drop to a connection of the same lot may end over it. */
  readonly lot?: string
  readonly outline: readonly (readonly [number, number])[]
  readonly height: number
}

/** A tree crown a span must not go through: a vertical cylinder from `bottom` to `top`. */
export type NetworkCrown = { readonly x: number; readonly z: number; readonly radius: number; readonly bottom: number; readonly top: number }
