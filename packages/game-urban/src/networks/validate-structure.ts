import { CONNECTION_NETWORK, EDGE_NETWORK, NETWORK_ENDS, NETWORK_FLOW } from './classes'
import { NETWORK_VIOLATION } from './codes'
import { connectedNodes } from './graph'
import type { NetworkKind, UtilityNetworks } from './types'
import type { ValidationContext } from './validate-context'

const NETWORKS: readonly NetworkKind[] = ['power_mv', 'power_lv', 'lighting', 'telecom', 'sewer', 'storm', 'water']

/** Ids used twice, edges to missing nodes, edges whose ends do not carry their network. */
export function validateIds(context: ValidationContext, networks: UtilityNetworks): void {
  const seen = new Set<string>()
  for (const entry of [...networks.nodes, ...networks.edges]) {
    if (seen.has(entry.id)) context.report({ code: NETWORK_VIOLATION.DUPLICATE_ID, id: entry.id })
    seen.add(entry.id)
  }
  for (const edge of context.graph.edges.values()) {
    const network = EDGE_NETWORK[edge.kind]
    for (const end of [edge.from, edge.to]) {
      const node = context.graph.nodes.get(end)
      if (node === undefined) context.report({ code: NETWORK_VIOLATION.UNKNOWN_NODE, id: edge.id, detail: end })
      else if (!node.carries.includes(network)) context.report({ code: NETWORK_VIOLATION.NOT_CARRIED, id: edge.id, detail: `${end} does not carry ${network}` })
    }
  }
}

/**
 * Each network is a tree tied to its source: a supply node is fed by one edge of a network, a drain node flows out through one, and every
 * node that carries a network is reached from its source (or reaches its destination). A loop or an island is never reached, and a loop
 * through the source itself shows as a source with an edge coming in (or a destination with one going out).
 */
export function validateTrees(context: ValidationContext): void {
  for (const network of NETWORKS) {
    const supply = NETWORK_FLOW[network] === 'supply'
    const connected = connectedNodes(context.graph, network)
    for (const node of context.graph.nodes.values()) {
      if (!node.carries.includes(network)) continue
      const links = supply ? context.graph.incoming(node.id, network) : context.graph.outgoing(node.id, network)
      if (links.length > 1) context.report({ code: NETWORK_VIOLATION.NOT_RADIAL, id: node.id, detail: network, value: links.length, limit: 1 })
      if (!connected.has(node.id)) context.report({ code: NETWORK_VIOLATION.DISCONNECTED, id: node.id, detail: network })
      const back = supply ? context.graph.incoming(node.id, network) : context.graph.outgoing(node.id, network)
      if (NETWORK_ENDS[network].includes(node.kind) && back.length > 0) context.report({ code: NETWORK_VIOLATION.LOOP_AT_END, id: node.id, detail: network })
    }
  }
}

/** Every connection a lot declared is in the world frame, has one connection node on its network, and that node is tied to the source. */
export function validateLots(context: ValidationContext): void {
  const connections = context.options.connections ?? []
  const connectedByNetwork = new Map<NetworkKind, ReadonlySet<string>>()
  const nodes = [...context.graph.nodes.values()]
  const declared = new Set<string>()
  for (const connection of connections) {
    const id = `${connection.lot}:${connection.network}`
    if (declared.has(id)) {
      context.report({ code: NETWORK_VIOLATION.LOT_DECLARED_TWICE, id })
      continue
    }
    declared.add(id)
    if (connection.frame !== 'world') {
      context.report({ code: NETWORK_VIOLATION.CONNECTION_IN_PLAN_FRAME, id })
      continue
    }
    const network = CONNECTION_NETWORK[connection.network]
    const matches = nodes.filter((node) => node.kind === 'connection' && node.lot === connection.lot && node.carries.includes(network))
    if (matches.length > 1) context.report({ code: NETWORK_VIOLATION.LOT_CONNECTED_TWICE, id, value: matches.length, limit: 1 })
    const node = matches[0]
    const connected = connectedByNetwork.get(network) ?? connectedNodes(context.graph, network)
    connectedByNetwork.set(network, connected)
    if (node === undefined || !connected.has(node.id)) {
      context.report({ code: NETWORK_VIOLATION.LOT_UNCONNECTED, id, detail: network })
      continue
    }
    const moved = Math.hypot(node.at[0] - connection.at[0], node.at[1] - connection.at[1], node.at[2] - connection.at[2])
    if (moved > context.rules.connectionTolerance) context.report({ code: NETWORK_VIOLATION.CONNECTION_MOVED, id, value: moved, limit: context.rules.connectionTolerance })
  }
}

/** With the lots' connections given, every connection node answers one of them. */
export function validateOrphans(context: ValidationContext): void {
  const connections = context.options.connections
  if (connections === undefined) return
  const declared = new Set(connections.map((connection) => `${connection.lot}:${CONNECTION_NETWORK[connection.network]}`))
  for (const node of context.graph.nodes.values()) {
    if (node.kind !== 'connection') continue
    if (!node.carries.some((network) => declared.has(`${node.lot ?? ''}:${network}`))) context.report({ code: NETWORK_VIOLATION.ORPHAN_CONNECTION, id: node.id })
  }
}
