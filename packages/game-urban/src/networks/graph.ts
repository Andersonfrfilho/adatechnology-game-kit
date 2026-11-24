import { EDGE_NETWORK, NETWORK_ENDS, NETWORK_FLOW } from './classes'
import type { NetworkEdge, NetworkKind, NetworkNode } from './types'

/** The networks indexed: nodes and edges by id, and the edges in and out of each node. Edges whose ends are missing are kept but link nothing. */
export type NetworkGraph = {
  readonly nodes: ReadonlyMap<string, NetworkNode>
  readonly edges: ReadonlyMap<string, NetworkEdge>
  /** Edges leaving a node, of one network or all. */
  outgoing(nodeId: string, network?: NetworkKind): readonly NetworkEdge[]
  /** Edges reaching a node, of one network or all. */
  incoming(nodeId: string, network?: NetworkKind): readonly NetworkEdge[]
}

const NONE: readonly NetworkEdge[] = []

const ofNetwork = (edges: readonly NetworkEdge[] | undefined, network: NetworkKind | undefined): readonly NetworkEdge[] => {
  if (edges === undefined) return NONE
  return network === undefined ? edges : edges.filter((edge) => EDGE_NETWORK[edge.kind] === network)
}

/** Indexes nodes and edges. The first of two entries with the same id wins (the validator reports the second). */
export function buildNetworkGraph(input: { readonly nodes: readonly NetworkNode[]; readonly edges: readonly NetworkEdge[] }): NetworkGraph {
  const nodes = new Map<string, NetworkNode>()
  for (const node of input.nodes) if (!nodes.has(node.id)) nodes.set(node.id, node)
  const edges = new Map<string, NetworkEdge>()
  const out = new Map<string, NetworkEdge[]>()
  const into = new Map<string, NetworkEdge[]>()
  for (const edge of input.edges) {
    if (edges.has(edge.id)) continue
    edges.set(edge.id, edge)
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue
    out.set(edge.from, [...(out.get(edge.from) ?? []), edge])
    into.set(edge.to, [...(into.get(edge.to) ?? []), edge])
  }
  return {
    nodes,
    edges,
    outgoing: (nodeId, network) => ofNetwork(out.get(nodeId), network),
    incoming: (nodeId, network) => ofNetwork(into.get(nodeId), network),
  }
}

function sourcesOf(graph: NetworkGraph, network: NetworkKind): string[] {
  if (network === 'lighting') return [...connectedNodes(graph, 'power_lv')]
  const kinds = NETWORK_ENDS[network]
  const ends = [...graph.nodes.values()].filter((node) => kinds.includes(node.kind) && node.carries.includes(network)).map((node) => node.id)
  if (network !== 'power_lv') return ends
  const medium = connectedNodes(graph, 'power_mv')
  return ends.filter((id) => medium.has(id))
}

/**
 * The nodes linked to their source by the edges of `network`: walked from the sources along the flow (supply), or back from the
 * destinations against it (drain). The low voltage starts only at transformers the medium voltage reaches.
 */
export function connectedNodes(graph: NetworkGraph, network: NetworkKind): ReadonlySet<string> {
  const reached = new Set<string>()
  const pending = sourcesOf(graph, network)
  const forward = NETWORK_FLOW[network] === 'supply'
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (reached.has(id)) continue
    reached.add(id)
    const next = forward ? graph.outgoing(id, network).map((edge) => edge.to) : graph.incoming(id, network).map((edge) => edge.from)
    for (const nextId of next) if (!reached.has(nextId)) pending.push(nextId)
  }
  return reached
}

/** Horizontal length of an edge, metres (0 when an end is missing). */
export function edgeLength(graph: NetworkGraph, edge: NetworkEdge): number {
  const from = graph.nodes.get(edge.from)
  const to = graph.nodes.get(edge.to)
  if (from === undefined || to === undefined) return 0
  return Math.hypot(to.at[0] - from.at[0], to.at[2] - from.at[2])
}

/** The low voltage nodes a transformer feeds, with the length of the path from it to each one. */
export function circuitOf(graph: NetworkGraph, transformerId: string): ReadonlyMap<string, number> {
  const distance = new Map<string, number>([[transformerId, 0]])
  const pending = [transformerId]
  while (pending.length > 0) {
    const id = pending.pop() as string
    const base = distance.get(id) ?? 0
    for (const edge of graph.outgoing(id, 'power_lv')) {
      if (distance.has(edge.to)) continue
      distance.set(edge.to, base + edgeLength(graph, edge))
      pending.push(edge.to)
    }
  }
  return distance
}
