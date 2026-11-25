import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { NETWORK_VIOLATION, breachOf, generateNetworks, isAerialEdgeKind, leaksOf, pipePiecesOf, powerOutageOf, surfacePiecesOf, validateNetworks } from '../../src/networks'
import type { GeneratedNetworks, NetworkEdge, NetworkNode, UtilityNetworks } from '../../src/networks'
import { LOTS, PLAN } from './district'

const generate = (): GeneratedNetworks => generateNetworks({ plan: PLAN, lots: LOTS, seed: 11, power: { districts: { centre: 'underground' } } })
const validate = (out: GeneratedNetworks, networks: UtilityNetworks = out.networks) =>
  validateNetworks(networks, { connections: out.connections, surfaceAt: out.surfaceAt, frontages: out.frontages, undergroundAt: out.undergroundAt })
const codesOf = (out: GeneratedNetworks, networks: UtilityNetworks): string[] => validate(out, networks).map((violation) => violation.code)
const CENTRE = LOTS.filter((lot) => lot.id.startsWith('centre_'))
const PERIPHERY = LOTS.filter((lot) => !lot.id.startsWith('centre_'))

describe('underground power', () => {
  const out = generate()
  const { nodes, edges } = out.networks
  const node = (id: string): NetworkNode => nodes.find((entry) => entry.id === id) as NetworkNode

  it('lays a district with an underground centre and an overhead periphery that passes every rule, with no warning', () => {
    expect(validate(out)).toEqual([])
    expect(out.warnings).toEqual([])
  })

  it('stands no distribution pole and hangs no conductor over an underground street: only the light columns, their lamps on their arms', () => {
    const centre = nodes.filter((entry) => out.undergroundAt(entry.at[0], entry.at[2]))
    const poles = centre.filter((entry) => entry.kind === 'pole')
    expect(poles.length).toBeGreaterThan(4)
    for (const pole of poles) expect(pole.carries).toEqual(['lighting'])
    for (const pole of poles) expect(nodes.some((entry) => entry.id === `light:${pole.id}`)).toBe(true)
    const aerial = edges.filter((edge) => isAerialEdgeKind(edge.kind) && edge.kind !== 'light_feed' && out.undergroundAt(node(edge.to).at[0], node(edge.to).at[2]))
    expect(aerial).toEqual([])
    expect(nodes.filter((entry) => entry.kind === 'pole' && entry.carries.includes('power_mv')).length).toBeGreaterThan(4)
  })

  it('feeds every centre lot by a power lateral and a telecom lateral from its box, and the periphery by drops', () => {
    for (const lot of CENTRE) {
      expect(edges.filter((edge) => edge.kind === 'service_lateral' && edge.to === `lot:${lot.id}:power`)).toHaveLength(1)
      expect(edges.filter((edge) => edge.kind === 'telecom_lateral' && edge.to === `lot:${lot.id}:telecom`)).toHaveLength(1)
      expect(edges.some((edge) => edge.kind === 'service_drop' && edge.to === `lot:${lot.id}:power`)).toBe(false)
    }
    for (const lot of PERIPHERY) expect(edges.filter((edge) => edge.kind === 'service_drop' && edge.to === `lot:${lot.id}:power`)).toHaveLength(1)
  })

  it('puts the transformers on pads on the sidewalk, fed by the medium voltage of the bank, and the bank in layers: low voltage on top, medium voltage deepest', () => {
    const pads = nodes.filter((entry) => entry.mount === 'pad')
    expect(pads.length).toBeGreaterThan(0)
    for (const pad of pads) expect(out.surfaceAt(pad.at[0], pad.at[2])).toBe('sidewalk')
    const layer = (kind: NetworkEdge['kind']): number => (edges.find((edge) => edge.kind === kind && edge.width !== undefined)?.inverts?.[0] ?? 0)
    expect(layer('lv_duct')).toBeGreaterThan(layer('telecom_duct'))
    expect(layer('telecom_duct')).toBeGreaterThan(layer('mv_duct'))
    const pieces = surfacePiecesOf(out.networks, { surfaceAt: out.surfaceAt })
    expect(pieces.filter((piece) => piece.kind === 'pad_transformer')).toHaveLength(pads.length)
    expect(pieces.filter((piece) => piece.kind === 'power_box_cover').length).toBeGreaterThan(CENTRE.length)
  })

  it('takes the sewer laterals of the lots on the bank side under it, through a box with a drop', () => {
    const falls = nodes.filter((entry) => entry.spec === 'fall')
    expect(falls.length).toBeGreaterThan(0)
  })

  it('gives the same bytes for the same input', () => {
    const bytes = (networks: UtilityNetworks): string => createHash('sha256').update(JSON.stringify(networks)).digest('hex')
    expect(bytes(generate().networks)).toBe(bytes(out.networks))
  })
})

describe('the validator of underground power', () => {
  const out = generate()
  const { nodes, edges } = out.networks
  const withEdges = (change: (edge: NetworkEdge) => NetworkEdge): UtilityNetworks => ({ ...out.networks, edges: edges.map(change) })

  it(`reports ${NETWORK_VIOLATION.PARALLEL_TOO_CLOSE}: a power lateral laid 0.2 m beside a water main`, () => {
    const main = edges.find((edge) => edge.kind === 'water_main' && out.undergroundAt(nodes.find((entry) => entry.id === edge.from)!.at[0], nodes.find((entry) => entry.id === edge.from)!.at[2]))!
    const [a, b] = [nodes.find((entry) => entry.id === main.from)!, nodes.find((entry) => entry.id === main.to)!]
    const [dx, dz] = [b.at[0] - a.at[0], b.at[2] - a.at[2]]
    const length = Math.hypot(dx, dz)
    const beside = (end: NetworkNode, id: string): NetworkNode => ({ id, kind: 'box', at: [end.at[0] - (dz / length) * 0.2, end.at[1], end.at[2] + (dx / length) * 0.2], carries: ['power_lv'] })
    const box = nodes.find((entry) => entry.kind === 'box' && entry.carries.includes('power_lv'))!
    const networks = {
      ...out.networks,
      nodes: [...nodes, beside(a, 'beside_a'), beside(b, 'beside_b')],
      edges: [...edges, { id: 'beside_feed', kind: 'service_lateral' as const, from: box.id, to: 'beside_a', diameter: 0.1, inverts: [-1, -1] as const }, { id: 'beside', kind: 'service_lateral' as const, from: 'beside_a', to: 'beside_b', diameter: 0.1, inverts: [-1.1, -1.1] as const }],
    }
    expect(validate(out, networks).filter((violation) => violation.code === NETWORK_VIOLATION.PARALLEL_TOO_CLOSE).map((violation) => violation.id)).toContain(`beside|${main.id}`)
  })

  it(`reports ${NETWORK_VIOLATION.POWER_BELOW_SEWER}: a lateral that dives under a sewer lateral it crosses`, () => {
    const fall = edges.find((edge) => edge.id.startsWith('sewer:fall:')) as NetworkEdge
    const networks = withEdges((edge) => (edge.id === fall.id ? { ...edge, inverts: [-0.3, -0.35] } : edge))
    expect(codesOf(out, networks)).toContain(NETWORK_VIOLATION.POWER_BELOW_SEWER)
  })

  it(`reports ${NETWORK_VIOLATION.BOX_SPACING}: a duct of the bank longer than the spacing of its boxes`, () => {
    const networks = { ...out.networks, rules: { ...out.networks.rules, underground: { ...out.networks.rules.underground, boxSpacing: 5 } } }
    expect(codesOf(out, networks)).toContain(NETWORK_VIOLATION.BOX_SPACING)
  })

  it(`reports ${NETWORK_VIOLATION.AERIAL_ON_UNDERGROUND}: a distribution pole on an underground street`, () => {
    const networks = { ...out.networks, nodes: nodes.map((entry) => (entry.kind === 'pole' && out.undergroundAt(entry.at[0], entry.at[2]) ? { ...entry, carries: ['lighting', 'power_lv'] as const } : entry)) }
    expect(codesOf(out, networks)).toContain(NETWORK_VIOLATION.AERIAL_ON_UNDERGROUND)
  })

  it(`reports ${NETWORK_VIOLATION.COVER}: a low voltage duct deeper than its cover allows`, () => {
    const networks = withEdges((edge) => (edge.kind === 'lv_duct' ? { ...edge, inverts: [(edge.inverts?.[0] ?? 0) - 1, (edge.inverts?.[1] ?? 0) - 1] } : edge))
    expect(codesOf(out, networks)).toContain(NETWORK_VIOLATION.COVER)
  })
})

describe('a crater on the duct bank', () => {
  const out = generate()
  const { networks } = out
  const pipes = pipePiecesOf(networks)
  const hit = (id: string) => {
    const pipe = pipes.find((entry) => entry.id === id)!
    const at = [(pipe.from[0] + pipe.to[0]) / 2, (pipe.from[2] + pipe.to[2]) / 2] as const
    return breachOf({ pipes, surface: [] }, { x: at[0], z: at[1], radius: 1.5, depth: 2 })
  }

  it('cuts the low voltage past the break: the lots and lamps downstream go dark, and nothing leaks', () => {
    const lv = networks.edges.find((edge) => edge.kind === 'lv_duct' && edge.width !== undefined && networks.edges.some((next) => next.from === edge.to && next.kind === 'service_lateral'))!
    const breach = hit(lv.id)
    const severed = breach.pipes.filter((pipe) => pipe.severed).map((pipe) => pipe.id)
    expect(severed).toContain(lv.id)
    expect(breach.leaks.filter((content) => (content as string) === 'power')).toEqual([])
    expect(leaksOf(networks, { ...breach, pipes: breach.pipes.filter((pipe) => pipe.content === 'power') }, { isRaining: false })).toEqual([])
    const outage = powerOutageOf(networks, { before: [], after: severed })
    expect(outage?.network).toBe('power')
    expect(outage?.lots.length).toBeGreaterThan(0)
    for (const lot of outage?.lots ?? []) expect(lot.startsWith('centre_')).toBe(true)
  })

  it('darkens every circuit past a cut in the medium voltage, and nothing before it', () => {
    const feed = networks.nodes.find((entry) => entry.kind === 'feed' && entry.spec === 'underground_feed')!
    const first = networks.edges.find((edge) => edge.kind === 'mv_duct' && edge.from === feed.id)!
    const outage = powerOutageOf(networks, { before: [], after: [first.id] })
    expect(outage?.lots.sort()).toEqual(CENTRE.map((lot) => lot.id).sort())
    expect(outage?.lights?.length).toBeGreaterThan(0)
    expect(powerOutageOf(networks, { before: [first.id], after: [first.id] })).toBeUndefined()
  })
})
