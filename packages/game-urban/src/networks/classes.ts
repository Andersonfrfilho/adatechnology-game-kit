import type { UtilityNetwork } from '@adatechnology/game-contracts'

import type { AerialEdgeKind, DuctEdgeKind, NetworkClass, NetworkEdgeKind, NetworkKind, NetworkNodeKind } from './types'

/** The network each edge belongs to. A service drop is low voltage: a lot is never linked to the medium voltage. */
export const EDGE_NETWORK: Readonly<Record<NetworkEdgeKind, NetworkKind>> = {
  mv_span: 'power_mv',
  lv_span: 'power_lv',
  service_drop: 'power_lv',
  light_feed: 'lighting',
  telecom_span: 'telecom',
  telecom_drop: 'telecom',
  sewer_main: 'sewer',
  sewer_lateral: 'sewer',
  storm_gallery: 'storm',
  storm_lateral: 'storm',
  storm_gutter: 'storm',
  water_main: 'water',
  water_service: 'water',
  mv_duct: 'power_mv',
  lv_duct: 'power_lv',
  service_lateral: 'power_lv',
  light_cable: 'lighting',
  telecom_duct: 'telecom',
  telecom_lateral: 'telecom',
}

/** The class the rules read each edge by. */
export const EDGE_CLASS: Readonly<Record<NetworkEdgeKind, NetworkClass>> = {
  mv_span: 'power_mv',
  lv_span: 'power_lv',
  service_drop: 'service_drop',
  light_feed: 'street_light',
  telecom_span: 'telecom',
  telecom_drop: 'telecom',
  sewer_main: 'sewer',
  sewer_lateral: 'sewer',
  storm_gallery: 'storm',
  storm_lateral: 'storm',
  storm_gutter: 'storm',
  water_main: 'water',
  water_service: 'water',
  mv_duct: 'power_mv',
  lv_duct: 'power_lv',
  service_lateral: 'service_drop',
  light_cable: 'street_light',
  telecom_duct: 'telecom',
  telecom_lateral: 'telecom',
}

const AERIAL: ReadonlySet<NetworkEdgeKind> = new Set<AerialEdgeKind>(['mv_span', 'lv_span', 'telecom_span', 'service_drop', 'telecom_drop', 'light_feed'])

export function isAerialEdgeKind(kind: NetworkEdgeKind): kind is AerialEdgeKind {
  return AERIAL.has(kind)
}

const DUCTS: ReadonlySet<NetworkEdgeKind> = new Set<DuctEdgeKind>(['mv_duct', 'lv_duct', 'telecom_duct', 'service_lateral', 'telecom_lateral', 'light_cable'])

export function isDuctEdgeKind(kind: NetworkEdgeKind): kind is DuctEdgeKind {
  return DUCTS.has(kind)
}

/** The ducts that carry power (the rules of separation from water, sewer and drainage hold them; telecom is not power). */
export const POWER_DUCTS: ReadonlySet<NetworkEdgeKind> = new Set<DuctEdgeKind>(['mv_duct', 'lv_duct', 'service_lateral', 'light_cable'])

/** The network of a street a lot connection links to: `power` takes the low voltage. */
export const CONNECTION_NETWORK: Readonly<Record<UtilityNetwork, NetworkKind>> = {
  power: 'power_lv',
  telecom: 'telecom',
  sewer: 'sewer',
  storm: 'storm',
  water: 'water',
}

/** Supply networks flow from their sources to the loads; drain networks flow from the houses to their destinations. */
export const NETWORK_FLOW: Readonly<Record<NetworkKind, 'supply' | 'drain'>> = {
  power_mv: 'supply',
  power_lv: 'supply',
  lighting: 'supply',
  telecom: 'supply',
  water: 'supply',
  sewer: 'drain',
  storm: 'drain',
}

/**
 * The nodes a network starts from (supply) or ends at (drain). The low voltage starts at the transformers the medium voltage reaches,
 * and the lighting at the low voltage nodes, so these two are resolved by the graph.
 */
export const NETWORK_ENDS: Readonly<Record<NetworkKind, readonly NetworkNodeKind[]>> = {
  power_mv: ['feed'],
  power_lv: ['transformer'],
  lighting: [],
  telecom: ['feed'],
  water: ['reservoir'],
  sewer: ['treatment', 'outfall'],
  storm: ['outfall'],
}
