/**
 * @adatechnology/game-urban/networks: the utility networks of a district as data, with no three.js. Nodes and edges of power, street
 * lighting, telecom, sewer, drainage and water, the graph that ties each one to its source, the rules as patchable numbers and the
 * validator. The lot side is the `UtilityConnection` of game-contracts.
 */
export { CONNECTION_NETWORK, EDGE_CLASS, EDGE_NETWORK, NETWORK_ENDS, NETWORK_FLOW, isAerialEdgeKind } from './classes'
export { buildNetworkGraph, circuitOf, connectedNodes, edgeLength } from './graph'
export type { NetworkGraph } from './graph'
export { DEFAULT_NETWORK_RULES, diversifiedDemand, pickTransformer, resolveNetworkRules } from './rules'
export type { ClearanceRow, CoverRange, DiversityBand, NetworkRules, PowerRules, TransformerRating } from './rules'
export { DEFAULT_POLE_SLOTS, POLE_SLOT_GAPS, POLE_SLOT_ORDER, checkPoleSlots, slotsOfPole } from './slots'
export type { PoleSlotViolation } from './slots'
export type { DistributionSpec, PoleSlotBand, PoleSlots } from '../poles'
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
