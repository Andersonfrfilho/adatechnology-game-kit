import { describe, expect, it } from 'vitest'

import { NETWORK_VIOLATION, validateNetworks } from '../../src/networks'
import type { NetworkViolation } from '../../src/networks'
import { CONNECTIONS, replaceEdge, replaceNode, streetNetworks, streetOptions } from './fixture'

const codes = (violations: readonly NetworkViolation[]): string[] => violations.map((violation) => `${violation.code} ${violation.id}`)

describe('ids, trees and lots', () => {
  it('passes the hand-made street', () => {
    expect(validateNetworks(streetNetworks(), streetOptions())).toEqual([])
  })

  it('finds an id used twice and an edge to a missing node', () => {
    const networks = streetNetworks({ nodes: (nodes) => [...nodes, { id: 'pv:1', kind: 'manhole', at: [0, 0, 0], carries: ['sewer'], invert: -2 }], edges: replaceEdge('lv:1', { to: 'ghost' }) })
    const found = codes(validateNetworks(networks, streetOptions()))
    expect(found).toContain('duplicate_id pv:1')
    expect(found).toContain('unknown_node lv:1')
  })

  it('finds an edge whose end does not carry its network', () => {
    const networks = streetNetworks({ nodes: replaceNode('pole:2', { carries: ['power_lv'] }) })
    expect(codes(validateNetworks(networks, streetOptions()))).toContain('not_carried telecom:2')
  })

  it('finds a supply node fed twice (a loop) and a drain node that flows two ways', () => {
    const loop = streetNetworks({ edges: (edges) => [...edges, { id: 'lv:back', kind: 'lv_span', from: 'trafo:1', to: 'pole:2', sag: 0.5, heights: [7.3, 7.3] }] })
    expect(validateNetworks(loop, streetOptions()).filter((violation) => violation.code === NETWORK_VIOLATION.NOT_RADIAL)).toEqual([
      { code: 'not_radial', id: 'pole:2', detail: 'power_lv', value: 2, limit: 1 },
    ])
    const split = streetNetworks({ edges: (edges) => [...edges, { id: 'sewer:split', kind: 'sewer_main', from: 'pv:1', to: 'treatment', diameter: 0.15 }] })
    expect(codes(validateNetworks(split, streetOptions()))).toContain('not_radial pv:1')
  })

  it('finds a node cut from its source, and the transformer cut from the medium voltage', () => {
    const island = streetNetworks({ edges: (edges) => edges.filter((edge) => edge.id !== 'sewer:2') })
    expect(codes(validateNetworks(island, streetOptions()))).toEqual(expect.arrayContaining(['disconnected pv:2', 'disconnected lot:a:sewer', 'lot_unconnected a:sewer']))
    const dark = streetNetworks({ edges: (edges) => edges.filter((edge) => edge.id !== 'mv:trafo') })
    expect(codes(validateNetworks(dark, streetOptions()))).toEqual(expect.arrayContaining(['disconnected trafo:1', 'disconnected light:1', 'lot_unconnected a:power']))
  })

  it('finds a loop through the source of a supply network and through the destination of a drain network', () => {
    const loop = streetNetworks({ edges: (edges) => [...edges, { id: 'mv:back', kind: 'mv_span', from: 'pole:1', to: 'feed:mv', sag: 0.4, heights: [9.25, 9.25] }] })
    expect(codes(validateNetworks(loop, streetOptions()))).toEqual(['loop_at_end feed:mv'])
    const water = streetNetworks({ edges: (edges) => [...edges, { id: 'water:back', kind: 'water_main', from: 'valve:1', to: 'reservoir', diameter: 0.075 }] })
    expect(codes(validateNetworks(water, streetOptions()))).toEqual(expect.arrayContaining(['loop_at_end reservoir']))
    const drain = streetNetworks({ edges: (edges) => [...edges, { id: 'sewer:back', kind: 'sewer_main', from: 'treatment', to: 'pv:2', diameter: 0.15 }] })
    expect(codes(validateNetworks(drain, streetOptions()))).toContain('loop_at_end treatment')
  })

  it('finds a lot that declares a network twice and a connection node no lot declared', () => {
    const twice = streetOptions({ connections: [...CONNECTIONS, { lot: 'a', network: 'water', frame: 'world', at: [12, 0, 10] }] })
    expect(codes(validateNetworks(streetNetworks(), twice))).toEqual(['lot_declared_twice a:water'])
    const orphan = streetOptions({ connections: CONNECTIONS.filter((connection) => connection.network !== 'telecom') })
    expect(codes(validateNetworks(streetNetworks(), orphan))).toEqual(['orphan_connection lot:a:telecom'])
    expect(validateNetworks(streetNetworks(), streetOptions({ connections: undefined }))).toEqual([])
  })

  it('refuses a connection in the plan frame', () => {
    const options = streetOptions({ connections: CONNECTIONS.map((connection) => (connection.network === 'power' ? { ...connection, frame: 'plan' as const } : connection)) })
    expect(codes(validateNetworks(streetNetworks(), options))).toEqual(['connection_in_plan_frame a:power'])
  })

  it('links power to the low voltage, never to the medium voltage', () => {
    const networks = streetNetworks({ nodes: replaceNode('lot:a:power', { carries: ['power_mv'] }), edges: replaceEdge('drop:a', { kind: 'mv_span' }) })
    expect(codes(validateNetworks(networks, streetOptions()))).toContain('lot_unconnected a:power')
  })

  it('finds a lot with no connection node, one linked twice, and one moved from where the lot said', () => {
    const missing = streetOptions({ connections: [...CONNECTIONS, { lot: 'b', network: 'water', frame: 'world', at: [40, 0, 10] }] })
    expect(codes(validateNetworks(streetNetworks(), missing))).toEqual(['lot_unconnected b:water'])
    const twice = streetNetworks({
      nodes: (nodes) => [...nodes, { id: 'lot:a:water:2', kind: 'connection', at: [12, 0, 10], invert: -0.75, carries: ['water'], lot: 'a' }],
      edges: (edges) => [...edges, { id: 'water:a:2', kind: 'water_service', from: 'valve:1', to: 'lot:a:water:2', diameter: 0.02 }],
    })
    expect(codes(validateNetworks(twice, streetOptions()))).toContain('lot_connected_twice a:water')
    const moved = streetNetworks({ nodes: replaceNode('lot:a:telecom', { at: [10, 5.1, 12.5] }) })
    expect(validateNetworks(moved, streetOptions())).toEqual([{ code: 'connection_moved', id: 'a:telecom', value: 0.5, limit: 0.01 }])
  })
})
