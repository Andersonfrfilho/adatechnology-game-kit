import { NETWORK_VIOLATION } from './codes'
import { circuitOf } from './graph'
import { diversifiedDemand } from './rules'
import type { ValidationContext } from './validate-context'

/** kVA of the low voltage circuit of a transformer: the diversified demand of its consumers plus its street lights. */
export function circuitDemand(context: ValidationContext, transformerId: string): number {
  const circuit = circuitOf(context.graph, transformerId)
  const installed = new Map((context.options.connections ?? []).filter((connection) => connection.network === 'power').map((connection) => [connection.lot, connection.installedKva]))
  const consumers: number[] = []
  let lights = 0
  for (const id of circuit.keys()) {
    const node = context.graph.nodes.get(id)
    if (node?.kind === 'connection' && node.lot !== undefined) consumers.push(installed.get(node.lot) ?? 0)
    lights += context.graph.outgoing(id, 'lighting').length
  }
  return diversifiedDemand(consumers, context.rules.power) + lights * context.rules.lighting.lampKva
}

/** Each transformer has a known rating, its demand within the loading limit, and its circuit no longer than the limit each way. */
export function validateLoad(context: ValidationContext): void {
  const power = context.rules.power
  for (const node of context.graph.nodes.values()) {
    if (node.kind !== 'transformer') continue
    const rating = power.transformers.find((entry) => entry.id === node.spec)
    if (rating === undefined) context.report({ code: NETWORK_VIOLATION.UNKNOWN_TRANSFORMER, id: node.id, detail: node.spec ?? 'none' })
    else {
      const loading = circuitDemand(context, node.id) / rating.kva
      if (loading > power.maxLoading) context.report({ code: NETWORK_VIOLATION.TRANSFORMER_OVERLOADED, id: node.id, value: loading, limit: power.maxLoading })
    }
    const longest = Math.max(0, ...circuitOf(context.graph, node.id).values())
    if (longest > power.lvCircuitMaxLength) context.report({ code: NETWORK_VIOLATION.LV_CIRCUIT_TOO_LONG, id: node.id, value: longest, limit: power.lvCircuitMaxLength })
  }
}
