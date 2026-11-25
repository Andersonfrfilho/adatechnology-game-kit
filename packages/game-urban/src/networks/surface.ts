import { buildNetworkGraph } from './graph'
import type { NetworkGraph } from './graph'
import type { NetworkEdge, NetworkNode, NetworkSurface, UtilityNetworks } from './types'

/** What shows of the buried networks: each one a piece standing at a node of the ground. */
export type SurfaceKind = 'manhole_cover' | 'cleanout_cover' | 'inlet_grate' | 'valve_cover' | 'hydrant' | 'wing_wall' | 'inspection_cover' | 'meter_box' | 'downspout_mouth'

/** Ids of `game-destruction` materials. */
export type SurfaceMaterial = 'cast_iron' | 'concrete' | 'plastic'

/** The pit under a cover, from the ground down to the pipe's bottom: round (a PV, a valve) or square (an inlet box, an inspection box). */
export type Shaft = { readonly shape: 'round' | 'square'; readonly width: number; readonly depth: number; readonly top: number; readonly bottom: number; readonly material: SurfaceMaterial }

export type SurfacePiece = {
  /** The id of the node it stands at. */
  readonly id: string
  readonly kind: SurfaceKind
  /** Ground level at the node. */
  readonly at: readonly [number, number, number]
  /** Turn about y: the piece's local x runs along the street (the kerb), its local z (the wing wall's front) across it. */
  readonly ry: number
  readonly spec: string | undefined
  readonly shape: 'round' | 'square'
  /** Width along the street, height over the ground, depth across it (a round piece: its diameter twice). */
  readonly size: readonly [number, number, number]
  readonly material: SurfaceMaterial
  /** It blocks a body (a hydrant, a wing wall, a meter box). A cover and a grate are ground: they are walked on and carry a vehicle. */
  readonly solid: boolean
  readonly shaft?: Shaft
}

type PieceSpec = Pick<SurfacePiece, 'kind' | 'shape' | 'size' | 'material' | 'solid'> & { readonly shaft?: Pick<Shaft, 'shape' | 'width' | 'depth' | 'material'> }

const COVER = 0.6
const SHAFT_PV = { shape: 'round', width: 0.9, depth: 0.9, material: 'concrete' } as const

/** The piece of each node by its kind and spec; a node that shows nothing (a saddle, a tee, the plant) has none. */
function specOf(node: NetworkNode): PieceSpec | undefined {
  const network = node.carries[0]
  switch (node.kind) {
    case 'manhole':
      return node.spec === 'gallery_box'
        ? { kind: 'manhole_cover', shape: 'square', size: [COVER, 0.03, COVER], material: 'cast_iron', solid: false, shaft: { shape: 'square', width: 0.9, depth: 0.9, material: 'concrete' } }
        : { kind: 'manhole_cover', shape: 'round', size: [COVER, 0.03, COVER], material: 'cast_iron', solid: false, shaft: SHAFT_PV }
    case 'pumping_station':
      return { kind: 'manhole_cover', shape: 'round', size: [0.9, 0.03, 0.9], material: 'cast_iron', solid: false, shaft: { shape: 'round', width: 1.5, depth: 1.5, material: 'concrete' } }
    case 'cleanout':
      return { kind: 'cleanout_cover', shape: 'round', size: [0.25, 0.03, 0.25], material: 'cast_iron', solid: false, shaft: { shape: 'round', width: 0.2, depth: 0.2, material: 'plastic' } }
    case 'inlet':
      return { kind: 'inlet_grate', shape: 'square', size: [0.9, 0.03, 0.5], material: 'cast_iron', solid: false, shaft: { shape: 'square', width: 0.8, depth: 0.5, material: 'concrete' } }
    case 'valve':
      return { kind: 'valve_cover', shape: 'round', size: [0.2, 0.03, 0.2], material: 'cast_iron', solid: false, shaft: { shape: 'round', width: 0.1, depth: 0.1, material: 'cast_iron' } }
    case 'hydrant':
      return { kind: 'hydrant', shape: 'round', size: [0.2, 0.8, 0.2], material: 'cast_iron', solid: true, shaft: { shape: 'round', width: 0.1, depth: 0.1, material: 'cast_iron' } }
    case 'outfall':
      return { kind: 'wing_wall', shape: 'square', size: [3, 0.8, 1.6], material: 'concrete', solid: true }
    case 'connection':
      if (network === 'sewer') return { kind: 'inspection_cover', shape: 'square', size: [0.6, 0.03, 0.6], material: 'concrete', solid: false, shaft: { shape: 'square', width: 0.6, depth: 0.6, material: 'concrete' } }
      if (network === 'water') return { kind: 'meter_box', shape: 'square', size: [0.4, 0.3, 0.25], material: 'concrete', solid: true, shaft: { shape: 'round', width: 0.04, depth: 0.04, material: 'plastic' } }
      return network === 'storm' ? { kind: 'downspout_mouth', shape: 'square', size: [0.3, 0.02, 0.2], material: 'concrete', solid: false } : undefined
    default:
      return undefined
  }
}

const unit = (dx: number, dz: number): readonly [number, number] => {
  const length = Math.hypot(dx, dz)
  return length === 0 ? [1, 0] : [dx / length, dz / length]
}

const planOf = (graph: NetworkGraph, id: string, from: NetworkNode): readonly [number, number] => {
  const other = graph.nodes.get(id)
  return other === undefined ? [0, 0] : [other.at[0] - from.at[0], other.at[2] - from.at[2]]
}

/** The way the street runs at a node, from the pipe that leaves it: a lateral or a service leaves square to the street, a gutter or a main runs along it. */
function alongOf(graph: NetworkGraph, node: NetworkNode): readonly [number, number] {
  const edges: readonly NetworkEdge[] = [...graph.outgoing(node.id), ...graph.incoming(node.id)]
  const square = edges.find((edge) => edge.kind === 'storm_lateral' || edge.kind === 'sewer_lateral' || edge.kind === 'water_service')
  if (square !== undefined) {
    const [dx, dz] = planOf(graph, square.from === node.id ? square.to : square.from, node)
    return unit(-dz, dx)
  }
  const along = edges.find((edge) => edge.kind === 'storm_gutter' || edge.kind === 'storm_gallery' || edge.kind === 'sewer_main')
  if (along === undefined) return [1, 0]
  const [dx, dz] = planOf(graph, along.from === node.id ? along.to : along.from, node)
  return unit(dx, dz)
}

/** The wing wall faces the way the gallery flows into it: its local z along the flow. */
function headingOf(graph: NetworkGraph, node: NetworkNode): number {
  if (node.kind === 'outfall') {
    const into = graph.incoming(node.id).find((edge) => edge.kind === 'storm_gallery')
    const [bx, bz] = into === undefined ? ([0, -1] as const) : planOf(graph, into.from, node)
    const [fx, fz] = unit(-bx, -bz)
    return Math.atan2(fx, fz)
  }
  const [dx, dz] = alongOf(graph, node)
  return Math.atan2(-dz, dx)
}

/** Where `drawRoad` lays the asphalt over the terrain (`game-urban` streets): a cover on the road stands on it, not on the ground under it. */
export const ROAD_SURFACE_LEVEL = 0.02

export type SurfacePiecesOptions = {
  /** What lies under a point (`GeneratedNetworks.surfaceAt`): a piece on the road stands `roadLevel` higher. Without it every piece stands on the ground. */
  readonly surfaceAt?: (x: number, z: number) => NetworkSurface | undefined
  /** Default `ROAD_SURFACE_LEVEL`. */
  readonly roadLevel?: number
}

/**
 * What shows of the buried networks, a piece at each node that has a face on the ground: the PV and gallery box covers, the cleanout and valve
 * covers, the inlets' grates at the kerb, the hydrants, the wing walls at the outfalls, and at each lot the inspection box cover, the meter box
 * and the downspout's mouth. Each carries its pit down to the pipe's bottom.
 */
export function surfacePiecesOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>, options: SurfacePiecesOptions = {}): SurfacePiece[] {
  const graph = buildNetworkGraph(networks)
  const lift = (node: NetworkNode): number => (options.surfaceAt?.(node.at[0], node.at[2]) === 'road' ? (options.roadLevel ?? ROAD_SURFACE_LEVEL) : 0)
  const taken: Array<{ readonly kind: SurfaceKind; readonly x: number; readonly z: number }> = []
  return networks.nodes.flatMap((node): SurfacePiece[] => {
    const spec = specOf(node)
    if (spec === undefined) return []
    // two pieces of one kind closer than their frame is wide (the galleries of the two kerbs meeting a main at one station, inlets at the end of a street) show as one
    const reach = spec.size[0] + 0.12
    if (taken.some((other) => other.kind === spec.kind && Math.hypot(other.x - node.at[0], other.z - node.at[2]) < reach)) return []
    taken.push({ kind: spec.kind, x: node.at[0], z: node.at[2] })
    const { shaft, ...piece } = spec
    const bottom = node.invert
    return [{ id: node.id, ...piece, at: [node.at[0], node.at[1] + lift(node), node.at[2]], ry: headingOf(graph, node), spec: node.spec, ...(shaft === undefined || bottom === undefined ? {} : { shaft: { ...shaft, top: node.at[1] + lift(node), bottom } }) }]
  })
}
