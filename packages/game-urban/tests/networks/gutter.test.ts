import { describe, expect, it } from 'vitest'

import { validateNetworks } from '../../src/networks'
import type { NetworkEdge, NetworkNode } from '../../src/networks'
import { CONNECTIONS, streetNetworks, streetOptions } from './fixture'

// Lot a's downspout outlet at the kerb, down the gutter to inlet:1 (the gutter is an open channel: diameter 0, its bottom at the ground).
const withGutter = (inverts: readonly [number, number]) =>
  streetNetworks({
    nodes: (nodes: NetworkNode[]): NetworkNode[] => [...nodes, { id: 'lot:a:storm', kind: 'connection', at: [8, 0, 5], carries: ['storm'], lot: 'a' }],
    edges: (edges: NetworkEdge[]): NetworkEdge[] => [...edges, { id: 'gutter:a', kind: 'storm_gutter', from: 'lot:a:storm', to: 'inlet:1', diameter: 0, inverts }],
  })
const options = streetOptions({ connections: [...CONNECTIONS, { lot: 'a', network: 'storm', frame: 'world', at: [8, 0, 5] }] })

describe('the gutter', () => {
  it('takes a downspout to an inlet at the least slope, on or under the ground', () => {
    expect(validateNetworks(withGutter([0, -0.07]), options)).toEqual([])
  })

  it('finds a gutter too flat and one above the ground', () => {
    expect(validateNetworks(withGutter([0, -0.01]), options).map((violation) => violation.code)).toEqual(['slope'])
    expect(validateNetworks(withGutter([0.2, 0.1]), options).map((violation) => [violation.code, violation.detail])).toEqual([['cover', 'min']])
  })
})
