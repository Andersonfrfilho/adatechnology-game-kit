import type { UtilityConnection } from '@adatechnology/game-contracts'

import { DEFAULT_NETWORK_RULES } from '../../src/networks'
import type { NetworkBuilding, NetworkEdge, NetworkNode, NetworkSurface, UtilityNetworks, ValidateNetworksOptions } from '../../src/networks'

// A street along x at z = 0: road |z| < 5, sidewalk to 8, lots beyond; ground at 0. Poles on the north sidewalk (z = 5.6), water under the south one.
export const surfaceAt = (_x: number, z: number): NetworkSurface => (Math.abs(z) < 5 ? 'road' : Math.abs(z) < 8 ? 'sidewalk' : 'lot')

const NODES: readonly NetworkNode[] = [
  { id: 'feed:mv', kind: 'feed', at: [-30, 9.25, 5.6], carries: ['power_mv'] },
  { id: 'feed:telecom', kind: 'feed', at: [-30, 6.1, 5.6], carries: ['telecom'] },
  { id: 'pole:1', kind: 'pole', at: [0, 0, 5.6], carries: ['power_mv', 'power_lv', 'lighting', 'telecom'], spec: 'concrete_distribution' },
  { id: 'pole:2', kind: 'pole', at: [30, 0, 5.6], carries: ['power_lv', 'telecom'], spec: 'concrete_distribution', guyed: true },
  { id: 'trafo:1', kind: 'transformer', at: [0, 8.2, 5.6], carries: ['power_mv', 'power_lv'], spec: 't45' },
  { id: 'light:1', kind: 'light', at: [0, 6.6, 4], carries: ['lighting'] },
  { id: 'lot:a:power', kind: 'connection', at: [10, 5.7, 12], carries: ['power_lv'], lot: 'a' },
  { id: 'lot:a:telecom', kind: 'connection', at: [10, 5.1, 12], carries: ['telecom'], lot: 'a' },
  { id: 'lot:a:sewer', kind: 'connection', at: [10, 0, 9], invert: -0.5, carries: ['sewer'], lot: 'a' },
  { id: 'pv:1', kind: 'manhole', at: [10, 0, 0], invert: -2, carries: ['sewer'], spec: 'pv_600' },
  { id: 'pv:2', kind: 'manhole', at: [60, 0, 0], invert: -2.3, carries: ['sewer'], spec: 'pv_600' },
  { id: 'treatment', kind: 'treatment', at: [100, 0, 0], invert: -2.6, carries: ['sewer'] },
  { id: 'inlet:1', kind: 'inlet', at: [20, 0, 4.5], invert: -1.5, carries: ['storm'] },
  { id: 'inlet:2', kind: 'inlet', at: [40, 0, -4.5], invert: -1.5, carries: ['storm'] },
  { id: 'gallery:1', kind: 'manhole', at: [20, 0, 2], invert: -1.9, carries: ['storm'] },
  { id: 'gallery:2', kind: 'manhole', at: [40, 0, 2], invert: -2.05, carries: ['storm'] },
  { id: 'outfall', kind: 'outfall', at: [100, 0, 2], invert: -2.5, carries: ['storm'] },
  { id: 'reservoir', kind: 'reservoir', at: [-30, 0, -6.5], invert: -0.75, carries: ['water'] },
  { id: 'valve:1', kind: 'valve', at: [12, 0, -6.5], invert: -0.75, carries: ['water'] },
  { id: 'lot:a:water', kind: 'connection', at: [12, 0, 10], invert: -0.75, carries: ['water'], lot: 'a' },
]

const EDGES: readonly NetworkEdge[] = [
  { id: 'mv:1', kind: 'mv_span', from: 'feed:mv', to: 'pole:1', sag: 0.4, heights: [9.25, 9.25], conductors: 3 },
  { id: 'mv:trafo', kind: 'mv_span', from: 'pole:1', to: 'trafo:1', sag: 0, heights: [9.25, 8.2] },
  { id: 'lv:trafo', kind: 'lv_span', from: 'trafo:1', to: 'pole:1', sag: 0, heights: [7.7, 7.3] },
  { id: 'lv:1', kind: 'lv_span', from: 'pole:1', to: 'pole:2', sag: 0.8, heights: [7.3, 7.3], conductors: 4 },
  { id: 'drop:a', kind: 'service_drop', from: 'pole:2', to: 'lot:a:power', sag: 0.3, heights: [7.3, 5.7] },
  { id: 'light_feed:1', kind: 'light_feed', from: 'pole:1', to: 'light:1', sag: 0, heights: [7.3, 6.6] },
  { id: 'telecom:1', kind: 'telecom_span', from: 'feed:telecom', to: 'pole:1', sag: 0.6, heights: [6.1, 6.1] },
  { id: 'telecom:2', kind: 'telecom_span', from: 'pole:1', to: 'pole:2', sag: 0.6, heights: [6.1, 6.1] },
  { id: 'telecom:a', kind: 'telecom_drop', from: 'pole:2', to: 'lot:a:telecom', sag: 0.2, heights: [6.1, 5.1] },
  { id: 'sewer:a', kind: 'sewer_lateral', from: 'lot:a:sewer', to: 'pv:1', diameter: 0.1, inverts: [-0.5, -0.65] },
  { id: 'sewer:1', kind: 'sewer_main', from: 'pv:1', to: 'pv:2', diameter: 0.15, slope: 0.006 },
  { id: 'sewer:2', kind: 'sewer_main', from: 'pv:2', to: 'treatment', diameter: 0.15 },
  { id: 'storm:inlet:1', kind: 'storm_lateral', from: 'inlet:1', to: 'gallery:1', diameter: 0.4, inverts: [-1.5, -1.52] },
  { id: 'storm:inlet:2', kind: 'storm_lateral', from: 'inlet:2', to: 'gallery:2', diameter: 0.4, inverts: [-1.5, -1.55] },
  { id: 'storm:1', kind: 'storm_gallery', from: 'gallery:1', to: 'gallery:2', diameter: 0.6 },
  { id: 'storm:2', kind: 'storm_gallery', from: 'gallery:2', to: 'outfall', diameter: 0.6 },
  { id: 'water:1', kind: 'water_main', from: 'reservoir', to: 'valve:1', diameter: 0.075 },
  { id: 'water:a', kind: 'water_service', from: 'valve:1', to: 'lot:a:water', diameter: 0.02 },
]

export const CONNECTIONS: readonly UtilityConnection[] = [
  { lot: 'a', network: 'power', frame: 'world', at: [10, 5.7, 12], installedKva: 3 },
  { lot: 'a', network: 'telecom', frame: 'world', at: [10, 5.1, 12] },
  { lot: 'a', network: 'sewer', frame: 'world', at: [10, 0, 9], invert: -0.5 },
  { lot: 'a', network: 'water', frame: 'world', at: [12, 0, 10] },
]

export const BUILDINGS: readonly NetworkBuilding[] = [
  { id: 'house:a', lot: 'a', height: 6, outline: [[5, 14], [15, 14], [15, 22], [5, 22]] },
  { id: 'house:b', lot: 'b', height: 6, outline: [[35, 14], [45, 14], [45, 22], [35, 22]] },
]

/** The street networks, valid by every rule; tests change one thing at a time. */
export function streetNetworks(change: { nodes?: (nodes: NetworkNode[]) => NetworkNode[]; edges?: (edges: NetworkEdge[]) => NetworkEdge[] } = {}): UtilityNetworks {
  const nodes = [...NODES]
  const edges = [...EDGES]
  return { nodes: change.nodes?.(nodes) ?? nodes, edges: change.edges?.(edges) ?? edges, seed: 7, rules: DEFAULT_NETWORK_RULES }
}

export const streetOptions = (extra: ValidateNetworksOptions = {}): ValidateNetworksOptions => ({ connections: CONNECTIONS, buildings: BUILDINGS, surfaceAt, ...extra })

export const replaceNode = (id: string, change: Partial<NetworkNode>) => (nodes: NetworkNode[]): NetworkNode[] => nodes.map((node) => (node.id === id ? { ...node, ...change } : node))
export const replaceEdge = (id: string, change: Partial<NetworkEdge>) => (edges: NetworkEdge[]): NetworkEdge[] => edges.map((edge) => (edge.id === id ? { ...edge, ...change } : edge))
