/**
 * @adatechnology/game-urban/networks: the utility networks of a district as data, with no three.js. Nodes and edges of power, street
 * lighting, telecom, sewer, drainage and water, the graph that ties each one to its source, the rules as patchable numbers and the
 * validator. The lot side is the `UtilityConnection` of game-contracts.
 */
export { CONNECTION_NETWORK, EDGE_CLASS, EDGE_NETWORK, NETWORK_ENDS, NETWORK_FLOW, isAerialEdgeKind } from './classes'
export { NETWORK_VIOLATION } from './codes'
export type { NetworkViolation, NetworkViolationCode } from './codes'
export { buildNetworkGraph, circuitOf, connectedNodes, edgeLength } from './graph'
export type { NetworkGraph } from './graph'
export { DEFAULT_NETWORK_RULES, diversifiedDemand, pickTransformer, resolveNetworkRules } from './rules'
export type { ClearanceRow, CoverRange, DiversityBand, NetworkRules, PowerRules, TransformerRating } from './rules'
export { DEFAULT_POLE_SLOTS, POLE_SLOT_GAPS, POLE_SLOT_ORDER, checkPoleSlots, slotsOfPole } from './slots'
export type { PoleSlotViolation } from './slots'
export type { DistributionPoleDef, DistributionSpec, PoleSlotBand, PoleSlots } from '../pole-specs'
export type {
  AerialClass,
  AerialEdgeKind,
  BuriedEdgeKind,
  NetworkBuilding,
  NetworkClass,
  NetworkCrown,
  NetworkEdge,
  NetworkEdgeKind,
  NetworkKind,
  NetworkNode,
  NetworkNodeKind,
  NetworkSurface,
  UtilityNetworks,
} from './types'
export { validateNetworks } from './validate'
export { generateNetworks, surfaceOf } from './generate'
export type { GenerateNetworksParams, GeneratedNetworks } from './generate'
export { defaultConnectionsOf } from './connections'
export type { GroundAt } from './connections'
export { DEFAULT_NETWORK_LAYOUT } from './layout-rules'
export type { DefaultConnectionRules, NetworkLayoutRules } from './layout-rules'
export type { NetworkLot, RunEnd, ServedLot, StreetRun } from './runs'
export type { ValidateNetworksOptions } from './validate-context'
