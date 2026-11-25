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
export { frontagesOf, generateNetworks, surfaceOf } from './generate'
export { dropMisfitOf, lotUnderDrop } from './drop-rules'
export type { DropMisfit, LotFrontage } from './drop-rules'
export type { GenerateNetworksParams, GeneratedNetworks } from './generate'
export { defaultConnectionsOf } from './connections'
export type { GroundAt } from './connections'
export { DEFAULT_NETWORK_LAYOUT } from './layout-rules'
export type { DefaultConnectionRules, NetworkLayoutRules } from './layout-rules'
export type { NetworkLot, RunEnd, ServedLot, StreetRun } from './runs'
export type { NetworkWarning } from './warnings'
export type { ValidateNetworksOptions } from './validate-context'
export { networkLampsOf } from './lamps'
export type { NetworkLamp, NetworkLampsParams } from './lamps'
export { distributionHardwareOf } from '../pole-hardware'
export type { HardwareBox, HardwareCylinder, HardwareRole, PoleAttachments, PoleHardware, PoleHardwareOptions, PolePoint } from '../pole-hardware'
export { DISTRIBUTION } from '../pole-distribution'
export { poleHeightsOf } from './aerial'
export type { PoleHeights } from './aerial'
export { ROAD_SURFACE_LEVEL, surfacePiecesOf } from './surface'
export type { Shaft, SurfaceKind, SurfaceMaterial, SurfacePiece, SurfacePiecesOptions } from './surface'
export { coverOf, pipePiecesOf } from './pipes'
export type { PipeContent, PipePiece } from './pipes'
export { bowlDepthAt, breachOf } from './breach'
export type { Breach, Crater, PipeBreach } from './breach'
export { COVER_PLATE_PART, coverBodyOf, coverThrowOf, openingOf } from './cover'
export type { CoverBody } from './cover'
export { DEFAULT_LEAK_RULES, drainLeak, leaksOf, startLeak, waterOutageOf } from './leaks'
export type { LeakRule, LeakRules, LeaksOptions, LeakState, NetworkEvent, NetworkLeak, NetworkOutage } from './leaks'
