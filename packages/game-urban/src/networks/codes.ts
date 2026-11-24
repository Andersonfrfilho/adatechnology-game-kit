/** Stable codes of what `validateNetworks` finds wrong, as the `STRUCTURAL_VIOLATION` of game-floorplan-structure. */
export const NETWORK_VIOLATION = {
  DUPLICATE_ID: 'duplicate_id',
  UNKNOWN_NODE: 'unknown_node',
  NOT_CARRIED: 'not_carried',
  NOT_RADIAL: 'not_radial',
  DISCONNECTED: 'disconnected',
  CONNECTION_IN_PLAN_FRAME: 'connection_in_plan_frame',
  LOT_UNCONNECTED: 'lot_unconnected',
  LOT_CONNECTED_TWICE: 'lot_connected_twice',
  CONNECTION_MOVED: 'connection_moved',
  DROP_TOO_LONG: 'drop_too_long',
  MISSING_SAG: 'missing_sag',
  CLEARANCE: 'clearance',
  MV_OVER_LOT: 'mv_over_lot',
  SPAN_OVER_BUILDING: 'span_over_building',
  SPAN_THROUGH_CROWN: 'span_through_crown',
  MISSING_INVERT: 'missing_invert',
  MISSING_DIAMETER: 'missing_diameter',
  SLOPE: 'slope',
  SLOPE_MISMATCH: 'slope_mismatch',
  COVER: 'cover',
  TOO_DEEP: 'too_deep',
  CROSSING_TOO_CLOSE: 'crossing_too_close',
  CROSSING_ORDER: 'crossing_order',
  UNKNOWN_TRANSFORMER: 'unknown_transformer',
  TRANSFORMER_OVERLOADED: 'transformer_overloaded',
  LV_CIRCUIT_TOO_LONG: 'lv_circuit_too_long',
} as const

export type NetworkViolationCode = (typeof NETWORK_VIOLATION)[keyof typeof NETWORK_VIOLATION]

/** One finding: the id of the node, edge or lot, and the number against its limit when there is one. */
export type NetworkViolation = {
  readonly code: NetworkViolationCode
  readonly id: string
  readonly detail?: string
  readonly value?: number
  readonly limit?: number
}
