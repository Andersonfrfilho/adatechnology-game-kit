import { describe, expect, it } from 'vitest'

import { resolveNetworkRules, validateNetworks } from '../../src/networks'
import type { NetworkEdge, NetworkNode } from '../../src/networks'
import { CONNECTIONS, replaceNode, streetNetworks, streetOptions } from './fixture'

// Twenty more lots on pole:2, each with a short drop: 21 consumers of 8 kVA installed = 21 x 2.0 by the table, plus one lamp.
const LOTS = Array.from({ length: 20 }, (_, index) => `lot:extra:${index}`)
const moreLots = {
  nodes: (nodes: NetworkNode[]): NetworkNode[] => [...nodes, ...LOTS.map((id, index): NetworkNode => ({ id, kind: 'connection', at: [26 + index * 0.4, 0, 9], carries: ['power_lv'], lot: id }))],
  edges: (edges: NetworkEdge[]): NetworkEdge[] => [...edges, ...LOTS.map((id): NetworkEdge => ({ id: `drop:${id}`, kind: 'service_drop', from: 'pole:2', to: id, sag: 0.1, heights: [7.3, 7.3] }))],
}
const heavy = [...CONNECTIONS.map((connection) => (connection.network === 'power' ? { ...connection, installedKva: 8 } : connection)), ...LOTS.map((lot) => ({ lot, network: 'power' as const, frame: 'world' as const, at: [0, 0, 0] as const, installedKva: 8 }))]

describe('transformers', () => {
  it('loads a transformer with the diversified demand of its consumers and its lamps', () => {
    const networks = streetNetworks(moreLots)
    const found = validateNetworks(networks, streetOptions({ connections: heavy })).filter((violation) => violation.code === 'transformer_overloaded')
    expect(found).toEqual([{ code: 'transformer_overloaded', id: 'trafo:1', value: expect.closeTo((21 * 2 + 0.15) / 45, 6) as number, limit: 0.8 }])
  })

  it('passes the same circuit on the next rating up', () => {
    const networks = streetNetworks({ ...moreLots, nodes: (nodes) => replaceNode('trafo:1', { spec: 't75' })(moreLots.nodes(nodes)) })
    expect(validateNetworks(networks, streetOptions({ connections: heavy })).filter((violation) => violation.code === 'transformer_overloaded')).toEqual([])
  })

  it('finds a transformer of a rating the rules do not know', () => {
    expect(validateNetworks(streetNetworks({ nodes: replaceNode('trafo:1', { spec: 't999' }) }), streetOptions())).toEqual([{ code: 'unknown_transformer', id: 'trafo:1', detail: 't999' }])
  })

  it('finds a low voltage circuit longer than the limit', () => {
    const networks = { ...streetNetworks(), rules: resolveNetworkRules({ power: { lvCircuitMaxLength: 20 } }) }
    expect(validateNetworks(networks, streetOptions())).toEqual([{ code: 'lv_circuit_too_long', id: 'trafo:1', value: expect.closeTo(30, 6) as number, limit: 20 }])
  })
})
