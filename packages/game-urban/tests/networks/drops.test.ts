import { describe, expect, it } from 'vitest'

import { NETWORK_VIOLATION, generateNetworks, validateNetworks } from '../../src/networks'
import type { NetworkEdge, NetworkNode, UtilityNetworks } from '../../src/networks'
import { LOTS, PLAN } from './district'

const out = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const options = { connections: out.connections, surfaceAt: out.surfaceAt, frontages: out.frontages }
const codes = (networks: UtilityNetworks): string[] => validateNetworks(networks, options).map((violation) => violation.code)
const nodes = new Map(out.networks.nodes.map((node) => [node.id, node]))
const drops = out.networks.edges.filter((edge) => edge.kind === 'service_drop')
/** The networks with one node moved. */
const moved = (id: string, at: readonly [number, number, number]): UtilityNetworks => ({ ...out.networks, nodes: out.networks.nodes.map((node): NetworkNode => (node.id === id ? { ...node, at } : node)) })

describe('the drops follow the street\'s practice', () => {
  it('the generated cut breaks none of them: each lot from a pole in front of it or straight across, over no other lot, at most 4 drops a pole', () => {
    expect(validateNetworks(out.networks, options)).toEqual([])
    const perPole = new Map<string, number>()
    for (const edge of drops) perPole.set(edge.from, (perPole.get(edge.from) ?? 0) + 1)
    expect(Math.max(...perPole.values())).toBeLessThanOrEqual(4)
    expect(out.warnings).toEqual([])
  })

  it('a drop that crosses the street on a slant is skewed', () => {
    const edge = drops.find((item) => item.to === 'lot:south_3:power')!
    const pole = nodes.get(edge.from)!
    const anchor = nodes.get(edge.to)!
    expect(codes(moved(anchor.id, [pole.at[0] + 12, anchor.at[1], anchor.at[2]]))).toContain(NETWORK_VIOLATION.DROP_SKEWED)
  })

  it('a drop from a pole on the lot\'s own side but past its frontage is off the frontage', () => {
    const edge = drops.find((item) => item.to === 'lot:north_3:power')!
    const pole = nodes.get(edge.from)!
    const lot = LOTS.find((item) => item.id === 'north_3')!
    const anchor = nodes.get(edge.to)!
    const off = moved(pole.id, [lot.rect[2] + 3, pole.at[1], pole.at[2]])
    expect(validateNetworks(off, options).filter((violation) => violation.id === edge.id).map((violation) => violation.code)).toContain(NETWORK_VIOLATION.DROP_OFF_FRONTAGE)
    expect(anchor.lot).toBe('north_3')
  })

  it('a drop that passes over another lot is reported with that lot', () => {
    const edge = drops.find((item) => item.to === 'lot:north_3:power')!
    const anchor = nodes.get(edge.to)!
    const deep = moved(anchor.id, [anchor.at[0] - 14, anchor.at[1], anchor.at[2] - 10])
    const found = validateNetworks(deep, options).find((violation) => violation.code === NETWORK_VIOLATION.DROP_OVER_OTHER_LOT && violation.id === edge.id)
    expect(found?.detail).toBe('north_2')
  })

  it('a pole with more than 4 drops is reported', () => {
    const pole = drops[0]!.from
    const extra = drops.slice(1, 6).map((edge): NetworkEdge => ({ ...edge, from: pole }))
    const crowded: UtilityNetworks = { ...out.networks, edges: out.networks.edges.map((edge) => extra.find((item) => item.id === edge.id) ?? edge) }
    expect(validateNetworks(crowded, {}).map((violation) => violation.code)).toContain(NETWORK_VIOLATION.POLE_TOO_MANY_DROPS)
  })
})
