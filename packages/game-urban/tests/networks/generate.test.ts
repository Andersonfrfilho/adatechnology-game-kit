import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { generateNetworks, validateNetworks } from '../../src/networks'
import type { GenerateNetworksParams, NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'

const generate = (extra: Partial<GenerateNetworksParams> = {}) => generateNetworks({ plan: PLAN, lots: LOTS, seed: 11, ...extra })
const validate = (out: ReturnType<typeof generate>) => validateNetworks(out.networks, { connections: out.connections, surfaceAt: out.surfaceAt, frontages: out.frontages })
const bytes = (out: ReturnType<typeof generate>): string => createHash('sha256').update(JSON.stringify(out.networks)).digest('hex')
/** The bytes of the cut's networks with seed 11: a change to the generator that moves anything shows here, and is recorded on purpose. */
// re-recorded when the rules the output carries gained `layout.poles.minGap` (nodes and edges unchanged)
const RECORDED = '36e926ebc71b730eb26b14a51f3db6afff15bab1ed81302eacf0320eb6751f6a'
const count = (nodes: readonly NetworkNode[], kind: NetworkNode['kind']): number => nodes.filter((node) => node.kind === kind).length

describe('generateNetworks', () => {
  const out = generate()

  it('lays networks that pass every rule of the validator, with no warning', () => {
    expect(validate(out)).toEqual([])
    expect(out.warnings).toEqual([])
  })

  it('links every lot to the five networks once, power to the low voltage', () => {
    for (const lot of LOTS) {
      for (const network of ['power', 'telecom', 'sewer', 'storm', 'water'] as const) {
        const nodes = out.networks.nodes.filter((node) => node.kind === 'connection' && node.lot === lot.id && node.id.endsWith(`:${network}`))
        expect(nodes.length, `${lot.id} ${network}`).toBe(1)
      }
      expect(out.networks.edges.filter((edge) => edge.kind === 'service_drop' && edge.to === `lot:${lot.id}:power`).length, lot.id).toBe(1)
    }
  })

  it('feeds each side of the river from its own border, with no span over the water', () => {
    expect(count(out.networks.nodes, 'feed')).toBe(4)
    expect(count(out.networks.nodes, 'reservoir')).toBe(2)
    expect(count(out.networks.nodes, 'treatment')).toBe(2)
    expect(count(out.networks.nodes, 'outfall')).toBe(2)
    const at = new Map(out.networks.nodes.map((node) => [node.id, node.at]))
    for (const edge of out.networks.edges.filter((entry) => entry.kind.endsWith('_span'))) {
      const [a, b] = [at.get(edge.from), at.get(edge.to)]
      expect(a !== undefined && b !== undefined && Math.min(a[0], b[0]) < -20 && Math.max(a[0], b[0]) > -20, edge.id).toBe(false)
    }
  })

  it('gives the same bytes for the same input and seed, the bytes recorded', () => {
    expect(bytes(generate())).toBe(bytes(out))
    expect(bytes(out)).toBe(RECORDED)
  })

  it('draws the hookups and the telecom bundles from the seed only: another seed keeps the layout', () => {
    const other = generate({ seed: 12 })
    const layout = (result: ReturnType<typeof generate>): string => JSON.stringify(result.networks.nodes.map((node) => [node.id, node.at]))
    expect(layout(other)).toBe(layout(out))
    expect(validate(other)).toEqual([])
  })

  it('uses a connection the lot declared instead of the default point', () => {
    const declared = { lot: 'south_2', network: 'power' as const, frame: 'world' as const, at: [70, 5.5, 8] as const, installedKva: 6 }
    const result = generate({ connections: [declared] })
    expect(result.networks.nodes.find((node) => node.id === 'lot:south_2:power')?.at).toEqual(declared.at)
    expect(validate(result)).toEqual([])
  })

  it('stands the poles on a pole of the given spec, and the surface under a point is road, sidewalk or lot', () => {
    expect(out.networks.nodes.filter((node) => node.kind === 'pole').every((node) => node.spec === 'concrete_distribution')).toBe(true)
    expect([out.surfaceAt(60, 0), out.surfaceAt(60, 6), out.surfaceAt(60, 20)]).toEqual(['road', 'sidewalk', 'lot'])
  })

  it('refuses a street that is not along x or z', () => {
    const plan = { ...PLAN, lines: [{ id: 'diagonal', kind: 'street', width: 10, points: [[0, 0], [50, 50]] as const }] }
    expect(() => generateNetworks({ plan, lots: [], seed: 1 })).toThrow(/diagonal/)
  })
})
