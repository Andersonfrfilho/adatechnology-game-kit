import { describe, expect, it } from 'vitest'

import { buildNetworkGraph, circuitOf, connectedNodes, edgeLength } from '../../src/networks'
import { streetNetworks } from './fixture'

describe('network graph', () => {
  const graph = buildNetworkGraph(streetNetworks())

  it('indexes nodes and edges and the edges in and out of each node, by network', () => {
    expect(graph.nodes.size).toBe(20)
    expect(graph.edges.size).toBe(18)
    expect(graph.outgoing('pole:1').map((edge) => edge.id)).toEqual(['mv:trafo', 'lv:1', 'light_feed:1', 'telecom:2'])
    expect(graph.outgoing('pole:1', 'power_lv').map((edge) => edge.id)).toEqual(['lv:1'])
    expect(graph.incoming('pole:1', 'power_mv').map((edge) => edge.id)).toEqual(['mv:1'])
    expect(graph.incoming('nowhere')).toEqual([])
  })

  it('reaches each supply network from its source, the low voltage from a transformer the medium voltage feeds', () => {
    expect([...connectedNodes(graph, 'power_mv')].sort()).toEqual(['feed:mv', 'pole:1', 'trafo:1'])
    expect([...connectedNodes(graph, 'power_lv')].sort()).toEqual(['lot:a:power', 'pole:1', 'pole:2', 'trafo:1'])
    expect(connectedNodes(graph, 'lighting').has('light:1')).toBe(true)
    expect([...connectedNodes(graph, 'water')].sort()).toEqual(['lot:a:water', 'reservoir', 'valve:1'])
  })

  it('reaches each drain network back from its destination', () => {
    expect([...connectedNodes(graph, 'sewer')].sort()).toEqual(['lot:a:sewer', 'pv:1', 'pv:2', 'treatment'])
    expect(connectedNodes(graph, 'storm').size).toBe(5)
  })

  it('cuts the low voltage and the lights when the medium voltage does not reach the transformer', () => {
    const cut = buildNetworkGraph(streetNetworks({ edges: (edges) => edges.filter((edge) => edge.id !== 'mv:trafo') }))
    expect(connectedNodes(cut, 'power_lv').size).toBe(0)
    expect(connectedNodes(cut, 'lighting').size).toBe(0)
  })

  it('links nothing through an edge to a missing node', () => {
    const broken = buildNetworkGraph(streetNetworks({ edges: (edges) => edges.map((edge) => (edge.id === 'lv:1' ? { ...edge, to: 'ghost' } : edge)) }))
    expect(broken.edges.has('lv:1')).toBe(true)
    expect(broken.outgoing('pole:1', 'power_lv')).toEqual([])
    expect(connectedNodes(broken, 'power_lv').has('lot:a:power')).toBe(false)
  })

  it('measures the low voltage circuit of a transformer along its line, without the service drops', () => {
    const circuit = circuitOf(graph, 'trafo:1')
    expect(circuit.get('pole:2')).toBeCloseTo(30)
    expect(circuit.get('lot:a:power')).toBeCloseTo(30)
    const sewer = graph.edges.get('sewer:1')
    expect(sewer === undefined ? 0 : edgeLength(graph, sewer)).toBeCloseTo(50)
  })
})
