import { describe, expect, it } from 'vitest'

import { buildNetworkGraph, circuitOf, diversifiedDemand, generateNetworks, pickTransformer, validateNetworks } from '../../src/networks'
import type { GenerateNetworksParams, NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'

const generate = (extra: Partial<GenerateNetworksParams> = {}) => generateNetworks({ plan: PLAN, lots: LOTS, seed: 11, ...extra })
const validate = (out: ReturnType<typeof generate>) => validateNetworks(out.networks, { connections: out.connections, surfaceAt: out.surfaceAt, frontages: out.frontages })
const transformers = (out: ReturnType<typeof generate>): NetworkNode[] => out.networks.nodes.filter((node) => node.kind === 'transformer')

describe('power from the generator', () => {
  const out = generate()

  it('sizes each transformer as the smallest rating that takes the diversified demand of its circuit and its lamps', () => {
    const graph = buildNetworkGraph(out.networks)
    const rules = out.networks.rules
    expect(transformers(out).length).toBe(2)
    for (const transformer of transformers(out)) {
      const circuit = [...circuitOf(graph, transformer.id).keys()].map((id) => graph.nodes.get(id) as NetworkNode)
      const consumers = circuit.filter((node) => node.kind === 'connection').map(() => 0)
      const lamps = circuit.filter((node) => node.kind === 'pole').length
      expect(transformer.spec).toBe(pickTransformer(diversifiedDemand(consumers, rules.power) + lamps * rules.lighting.lampKva, rules.power)?.id)
    }
  })

  it('runs the medium voltage along every street pole of the feeder, and to each transformer', () => {
    const graph = buildNetworkGraph(out.networks)
    const street = out.networks.nodes.filter((node) => node.kind === 'pole' && !node.id.includes(':lot:'))
    expect(street.length).toBeGreaterThan(10)
    for (const pole of street) expect(pole.carries.includes('power_mv'), pole.id).toBe(true)
    for (const transformer of transformers(out)) expect(graph.incoming(transformer.id, 'power_mv').length, transformer.id).toBe(1)
  })

  it('splits a circuit longer than the limit into more transformers, still valid', () => {
    const short = generate({ rules: { power: { lvCircuitMaxLength: 80 } } })
    expect(transformers(short).length).toBeGreaterThan(2)
    expect(validate(short)).toEqual([])
  })

  it('takes a larger rating when the lots install more load', () => {
    const heavy = out.connections.filter((connection) => connection.network === 'power').map((connection) => ({ ...connection, installedKva: 12 }))
    const result = generate({ connections: heavy })
    expect(transformers(result).map((node) => node.spec)).not.toEqual(transformers(out).map((node) => node.spec))
    expect(validateNetworks(result.networks, { connections: result.connections, surfaceAt: result.surfaceAt, frontages: result.frontages })).toEqual([])
  })
})

describe('the periphery', () => {
  it('links a few lots of the periphery with no meter, by the seed, and counts them in the load', () => {
    const all = generate({ rules: { layout: { periphery: { hookupShare: 1 } } } })
    const unmetered = all.networks.nodes.filter((node) => node.spec === 'unmetered').map((node) => node.lot)
    expect(unmetered.sort()).toEqual(LOTS.filter((lot) => lot.rect[0] >= 0).map((lot) => lot.id).sort())
    expect(validate(all)).toEqual([])
    const few = [11, 12, 13, 14, 15, 16, 17, 18].map((seed) => generate({ seed }).networks.nodes.filter((node) => node.spec === 'unmetered').length)
    expect(Math.max(...few)).toBeLessThanOrEqual(4)
    expect(few.some((value) => value > 0)).toBe(true)
  })

  it('bundles 3 to 5 telecom cables in the periphery and 1 or 2 in the centre', () => {
    const result = generate()
    const spans = result.networks.edges.filter((edge) => edge.kind === 'telecom_span' && edge.id.startsWith('telecom:pole:'))
    for (const span of spans) {
      const east = (result.networks.nodes.find((node) => node.id === span.to)?.at[0] ?? 0) >= 0
      expect(span.conductors as number, span.id).toBeGreaterThanOrEqual(east ? 3 : 1)
      expect(span.conductors as number, span.id).toBeLessThanOrEqual(east ? 5 : 2)
    }
  })

  it('keeps a splice box with its reserve coil every 4 spans', () => {
    const splices = generate().networks.nodes.filter((node) => node.spec === 'splice_reserve')
    expect(splices.length).toBeGreaterThan(0)
    expect(splices.every((node) => node.carries.includes('telecom'))).toBe(true)
  })
})
