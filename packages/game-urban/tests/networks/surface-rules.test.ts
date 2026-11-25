import { describe, expect, it } from 'vitest'

import { validateNetworks } from '../../src/networks'
import type { NetworkEdge, NetworkNode } from '../../src/networks'
import { replaceNode, streetNetworks, streetOptions } from './fixture'

const found = (networks: ReturnType<typeof streetNetworks>, code: string): string[] => validateNetworks(networks, streetOptions()).filter((violation) => violation.code === code).map((violation) => violation.id)

const ARM: NetworkNode = { id: 'pv:3', kind: 'manhole', at: [10, 0, -40], invert: -1.7, carries: ['sewer'], spec: 'pv_600' }
const ARM_EDGE: NetworkEdge = { id: 'sewer:3', kind: 'sewer_main', from: 'pv:3', to: 'pv:1', diameter: 0.15 }
const withArm = (kind: NetworkNode['kind']) => streetNetworks({ nodes: (nodes) => [...replaceNode('pv:1', { kind })(nodes), ARM], edges: (edges) => [...edges, ARM_EDGE] })

describe('a PV at every crossing and change of direction', () => {
  it('accepts a manhole where two mains turn', () => {
    expect(found(withArm('manhole'), 'pv_missing')).toEqual([])
  })

  it('finds a turn of two mains with no pit', () => {
    expect(found(withArm('splice'), 'pv_missing')).toEqual(['pv:1'])
  })

  it('finds three mains that meet with no pit, and lets two that run straight on pass', () => {
    const straight = streetNetworks({ nodes: replaceNode('pv:1', { kind: 'splice' }) })
    expect(found(straight, 'pv_missing')).toEqual([])
    const crossing = streetNetworks({
      nodes: (nodes) => [...replaceNode('pv:1', { kind: 'splice' })(nodes), ARM, { ...ARM, id: 'pv:4', at: [10, 0, 40] }],
      edges: (edges) => [...edges, ARM_EDGE, { ...ARM_EDGE, id: 'sewer:4', from: 'pv:4' }],
    })
    expect(found(crossing, 'pv_missing')).toEqual(['pv:1'])
  })
})

describe('inlets along every kerb', () => {
  it('finds two inlets of a kerb farther apart than 60 m', () => {
    const far = streetNetworks({ nodes: (nodes) => [...nodes, { id: 'inlet:3', kind: 'inlet', at: [100, 0, 4.5], invert: -1.5, carries: ['storm'] }] })
    expect(found(far, 'inlet_spacing')).toEqual(['inlet:3'])
    const near = streetNetworks({ nodes: (nodes) => [...nodes, { id: 'inlet:3', kind: 'inlet', at: [90, 0, 4.5], invert: -1.5, carries: ['storm'] }] })
    expect(found(near, 'inlet_spacing')).toEqual([])
  })

  const arms = (inlets: readonly NetworkNode[]) =>
    streetNetworks({
      nodes: (nodes) => [...nodes, { id: 'gallery:0', kind: 'manhole', at: [-20, 0, 2], invert: -1.85, carries: ['storm'] }, { id: 'gallery:3', kind: 'manhole', at: [20, 0, -30], invert: -1.95, carries: ['storm'] }, ...inlets],
      edges: (edges) => [...edges, { id: 'storm:0', kind: 'storm_gallery', from: 'gallery:0', to: 'gallery:1', diameter: 0.6 }, { id: 'storm:3', kind: 'storm_gallery', from: 'gallery:3', to: 'gallery:1', diameter: 0.6 }],
    })
  const corner = (id: string, x: number, z: number): NetworkNode => ({ id, kind: 'inlet', at: [x, 0, z], invert: -1.5, carries: ['storm'] })

  it('finds a corner of a crossing with no inlet near it', () => {
    expect(validateNetworks(arms([]), streetOptions()).filter((violation) => violation.code === 'inlet_at_corner').map((violation) => violation.detail)).toEqual(['+x-z', '-x-z'])
  })

  it('accepts a crossing with an inlet in each of its corners', () => {
    expect(found(arms([corner('inlet:c1', 24, -3), corner('inlet:c2', 16, -3)]), 'inlet_at_corner')).toEqual([])
  })
})

describe('branches square to the street', () => {
  it('finds a house lateral that meets the main at a slant', () => {
    const slanted = streetNetworks({ nodes: replaceNode('lot:a:sewer', { at: [14, 0, 9] }) })
    expect(found(slanted, 'branch_skewed')).toEqual(['sewer:a'])
    expect(found(streetNetworks(), 'branch_skewed')).toEqual([])
  })

  it('finds an inlet lateral that meets the gallery at a slant', () => {
    const slanted = streetNetworks({ nodes: replaceNode('inlet:1', { at: [26, 0, 4.5] }) })
    expect(found(slanted, 'branch_skewed')).toEqual(['storm:inlet:1'])
  })
})
