import { describe, expect, it } from 'vitest'

import { validateNetworks } from '../../src/networks'
import type { NetworkViolation } from '../../src/networks'
import { replaceEdge, replaceNode, streetNetworks, streetOptions } from './fixture'

const only = (violations: readonly NetworkViolation[], code: string): NetworkViolation[] => violations.filter((violation) => violation.code === code)

describe('spans in the air', () => {
  it('finds a service drop and a telecom drop longer than the reach', () => {
    const networks = streetNetworks({ nodes: (nodes) => replaceNode('lot:a:telecom', { at: [-10, 5.1, 12] })(replaceNode('lot:a:power', { at: [-10, 5.7, 12] })(nodes)) })
    const options = streetOptions({ connections: [] })
    expect(only(validateNetworks(networks, options), 'drop_too_long').map((violation) => violation.id)).toEqual(['drop:a', 'telecom:a'])
  })

  it('wants the sag of every span', () => {
    const networks = streetNetworks({ edges: replaceEdge('lv:1', { sag: undefined }) })
    expect(validateNetworks(networks, streetOptions())).toEqual([{ code: 'missing_sag', id: 'lv:1' }])
  })

  it('reads the clearance of the lowest point of the sag by class and surface', () => {
    const sagging = streetNetworks({ edges: replaceEdge('lv:1', { sag: 3 }) })
    expect(validateNetworks(sagging, streetOptions())).toEqual([{ code: 'clearance', id: 'lv:1', detail: 'sidewalk', value: expect.closeTo(4.3, 6) as number, limit: 4.5 }])
    const overRoad = streetNetworks({ edges: replaceEdge('telecom:2', { sag: 1.2 }) })
    expect(validateNetworks(overRoad, streetOptions({ surfaceAt: () => 'road' }))).toEqual([{ code: 'clearance', id: 'telecom:2', detail: 'road', value: expect.closeTo(4.9, 6) as number, limit: 5 }])
  })

  it('takes the ground under the span', () => {
    const raised = validateNetworks(streetNetworks(), streetOptions({ groundAt: (x) => (x > 10 && x < 20 ? 3 : 0) }))
    expect(raised.map((violation) => `${violation.code} ${violation.id}`)).toContain('clearance lv:1')
  })

  it('keeps the medium voltage out of the lots', () => {
    const networks = streetNetworks({ edges: replaceEdge('mv:1', { sag: 0.4 }), nodes: replaceNode('feed:mv', { at: [-30, 9.25, 20] }) })
    expect(only(validateNetworks(networks, streetOptions()), 'mv_over_lot')).toEqual([{ code: 'mv_over_lot', id: 'mv:1', detail: 'lot' }])
  })

  it('finds a span over a building, but lets a drop end over the house of its own lot', () => {
    const over = streetNetworks({ nodes: replaceNode('lot:a:power', { at: [40, 5.7, 18] }) })
    const found = validateNetworks(over, streetOptions({ connections: [] }))
    expect(only(found, 'span_over_building')).toEqual([{ code: 'span_over_building', id: 'drop:a', detail: 'house:b' }])
    const own = streetNetworks({ nodes: replaceNode('lot:a:power', { at: [10, 5.7, 16] }) })
    expect(only(validateNetworks(own, streetOptions({ connections: [] })), 'span_over_building')).toEqual([])
  })

  it('finds a span through a tree crown and passes one above it', () => {
    const crown = { x: 15, z: 5.6, radius: 2, bottom: 3, top: 8 }
    expect(validateNetworks(streetNetworks(), streetOptions({ obstacles: { crowns: [crown] } })).map((violation) => violation.id)).toEqual(['lv:1', 'telecom:2'])
    const low = { ...crown, top: 4 }
    expect(validateNetworks(streetNetworks(), streetOptions({ obstacles: { crowns: [low] } }))).toEqual([])
  })
})
