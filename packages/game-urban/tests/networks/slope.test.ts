import { describe, expect, it } from 'vitest'

import { validateNetworks } from '../../src/networks'
import { CONNECTIONS, replaceEdge, replaceNode, streetNetworks, streetOptions } from './fixture'

const codesOf = (networks: ReturnType<typeof streetNetworks>): string[] => validateNetworks(networks, streetOptions()).map((violation) => `${violation.code} ${violation.id}`)

describe('pipes under the street', () => {
  it('wants the inverts and the diameter of every pipe', () => {
    expect(codesOf(streetNetworks({ nodes: replaceNode('valve:1', { invert: undefined }) }))).toEqual(['missing_invert water:1', 'missing_invert water:a'])
    expect(codesOf(streetNetworks({ edges: replaceEdge('storm:1', { diameter: undefined }) }))).toEqual(['missing_diameter storm:1'])
  })

  it('finds a gravity pipe flatter than its least slope, and one that runs uphill', () => {
    const flat = validateNetworks(streetNetworks({ nodes: replaceNode('pv:2', { invert: -2.1 }) }), streetOptions())
    expect(flat).toContainEqual({ code: 'slope', id: 'sewer:1', value: expect.closeTo(0.002, 6) as number, limit: 0.005 })
    expect(codesOf(streetNetworks({ edges: replaceEdge('sewer:a', { inverts: [-0.65, -0.5] }) }))).toContain('slope sewer:a')
  })

  it('finds a declared slope the inverts do not agree with', () => {
    expect(codesOf(streetNetworks({ edges: replaceEdge('sewer:1', { slope: 0.02 }) }))).toEqual(['slope_mismatch sewer:1'])
  })

  it('finds a pipe with too little or too much cover', () => {
    expect(codesOf(streetNetworks({ nodes: (nodes) => replaceNode('valve:1', { invert: -0.5 })(replaceNode('reservoir', { invert: -0.5 })(nodes)) }))).toContain('cover water:1')
    expect(codesOf(streetNetworks({ nodes: (nodes) => replaceNode('valve:1', { invert: -1.2 })(replaceNode('reservoir', { invert: -1.2 })(nodes)) }))).toContain('cover water:1')
    expect(codesOf(streetNetworks({ nodes: replaceNode('gallery:1', { invert: -1.6 }) }))).toContain('cover storm:1')
  })

  it('puts a sewer main under a street with a storm gallery at 1.8 m of cover, and at 0.9 m without', () => {
    const shallow = streetNetworks({ nodes: replaceNode('pv:1', { invert: -1.8 }) })
    expect(validateNetworks(shallow, streetOptions())).toContainEqual({ code: 'cover', id: 'sewer:1', detail: 'min', value: expect.closeTo(1.65, 6) as number, limit: 1.8 })
    const noGallery = streetNetworks({ nodes: replaceNode('pv:1', { invert: -1.8 }), edges: (edges) => edges.filter((edge) => edge.kind !== 'storm_gallery' && edge.kind !== 'storm_lateral') })
    expect(validateNetworks(noGallery, streetOptions()).filter((violation) => violation.code === 'cover')).toEqual([])
  })

  it('keeps a sewer lateral no deeper than 0.85 m where it crosses the gallery', () => {
    const lot = (inverts: readonly [number, number]) =>
      streetNetworks({
        nodes: (nodes) => [...nodes, { id: 'lot:c:sewer', kind: 'connection', at: [60, 0, 9], invert: -0.5, carries: ['sewer'], lot: 'c' }],
        edges: (edges) => [...edges, { id: 'sewer:c', kind: 'sewer_lateral', from: 'lot:c:sewer', to: 'pv:2', diameter: 0.1, inverts }],
      })
    const options = streetOptions({ connections: [...CONNECTIONS, { lot: 'c', network: 'sewer', frame: 'world', at: [60, 0, 9], invert: -0.5 }] })
    expect(validateNetworks(lot([-0.5, -0.9]), options)).toEqual([])
    const deep = validateNetworks(lot([-0.5, -1.3]), options)
    expect(deep).toEqual([{ code: 'lateral_too_deep', id: 'storm:2xsewer:c', value: expect.closeTo(0.5 + 0.8 * (7 / 9), 6) as number, limit: 0.85 }])
  })

  it('wants a manhole at most every 80 m of sewer main', () => {
    expect(codesOf(streetNetworks({ nodes: (nodes) => replaceNode('treatment', { at: [150, 0, 0], invert: -3 })(nodes) }))).toEqual(['manhole_spacing sewer:2'])
  })

  it('finds a sewer deeper than the pumping limit', () => {
    expect(codesOf(streetNetworks({ nodes: replaceNode('treatment', { invert: -5 }) }))).toEqual(['too_deep sewer:2'])
  })

  it('keeps the gap where two pipes cross', () => {
    const close = streetNetworks({ edges: replaceEdge('storm:inlet:2', { inverts: [-1.5, -2.05] }) })
    const found = validateNetworks(close, streetOptions()).filter((violation) => violation.code === 'crossing_too_close')
    expect(found).toEqual([{ code: 'crossing_too_close', id: 'sewer:1xstorm:inlet:2', value: expect.closeTo(-1.5 - 0.55 * (4.5 / 6.5) + 2.03, 6) as number, limit: 0.2 }])
  })

  it('puts the drainage above the sewer main where they cross', () => {
    const under = streetNetworks({ edges: replaceEdge('storm:inlet:2', { inverts: [-2.6, -2.65] }) })
    const found = validateNetworks(under, streetOptions({ groundAt: () => 0 })).filter((violation) => violation.code === 'crossing_order')
    expect(found).toEqual([{ code: 'crossing_order', id: 'sewer:1xstorm:inlet:2', detail: 'sewer:1 above storm:inlet:2' }])
  })
})
