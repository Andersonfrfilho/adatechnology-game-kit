import { describe, expect, it } from 'vitest'

import { DEFAULT_NETWORK_RULES, buildNetworkGraph, generateNetworks } from '../../src/networks'
import type { NetworkEdge, NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'

const out = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const graph = buildNetworkGraph(out.networks)
const node = (id: string): NetworkNode => graph.nodes.get(id) as NetworkNode
const ofKind = (kind: NetworkEdge['kind']): NetworkEdge[] => out.networks.edges.filter((edge) => edge.kind === kind)
const length = (edge: NetworkEdge): number => Math.hypot(node(edge.to).at[0] - node(edge.from).at[0], node(edge.to).at[2] - node(edge.from).at[2])
const layout = DEFAULT_NETWORK_RULES.layout

/** Walks a drain main down from `id` to its end, the manholes (and cleanouts, treatment) it passes, saddles skipped. */
function manholesDown(id: string, kind: NetworkEdge['kind']): NetworkNode[] {
  const out: NetworkNode[] = []
  for (let current: string | undefined = id; current !== undefined; current = graph.outgoing(current).find((edge) => edge.kind === kind)?.to) {
    if (node(current).kind !== 'splice') out.push(node(current))
  }
  return out
}

describe('sewer', () => {
  it('puts a manhole at every crossing of two streets and at most 80 m apart along every main, saddles not counted', () => {
    expect(node('sewer:x:crossing_street:main_street_0')).toMatchObject({ kind: 'manhole', at: [-100, 0, 0] })
    const heads = out.networks.nodes.filter((entry) => entry.kind === 'cleanout' && entry.spec === 'terminal')
    expect(heads.length).toBe(4)
    for (const head of heads) {
      const stops = manholesDown(head.id, 'sewer_main')
      expect(stops[stops.length - 1]?.kind, head.id).toBe('treatment')
      for (let index = 1; index < stops.length; index++) {
        const [a, b] = [stops[index - 1] as NetworkNode, stops[index] as NetworkNode]
        expect(Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]), `${a.id} ${b.id}`).toBeLessThanOrEqual(80 + 1e-9)
      }
    }
  })

  it('takes the mains to an interceptor along each bank, south to a treatment node where the river leaves the map', () => {
    for (const treatment of out.networks.nodes.filter((entry) => entry.kind === 'treatment')) {
      expect(treatment.at[2]).toBe(135)
      expect([-37, -3]).toContain(treatment.at[0])
    }
  })

  it('runs every lateral perpendicular to its street, from the inspection box to a drop and a saddle on the main', () => {
    for (const lateral of ofKind('sewer_lateral')) {
      const [a, b] = [node(lateral.from), node(lateral.to)]
      expect(Math.abs(a.at[0] - b.at[0]) < 1e-9 || Math.abs(a.at[2] - b.at[2]) < 1e-9, lateral.id).toBe(true)
    }
    expect(ofKind('sewer_lateral').length).toBe(2 * LOTS.length)
  })
})

describe('drainage', () => {
  it('sets an inlet at both ends of every kerb and at most 60 m apart', () => {
    const inlets = out.networks.nodes.filter((entry) => entry.kind === 'inlet')
    const kerbs = new Map<string, NetworkNode[]>()
    for (const inlet of inlets) {
      const key = inlet.id.split(':').slice(2, 5).join(':')
      kerbs.set(key, [...(kerbs.get(key) ?? []), inlet])
    }
    expect(kerbs.size).toBe(10)
    for (const [key, row] of kerbs) {
      const along = row.map((inlet) => (key.startsWith('crossing') ? inlet.at[2] : inlet.at[0])).sort((a, b) => a - b)
      for (let index = 1; index < along.length; index++) expect((along[index] as number) - (along[index - 1] as number), key).toBeLessThanOrEqual(layout.storm.inletSpacing + 1e-9)
      expect(along.length, key).toBeGreaterThanOrEqual(2)
    }
  })

  it('empties each gallery through a headwall on the river bank, its bottom above the water', () => {
    for (const outfall of out.networks.nodes.filter((entry) => entry.kind === 'outfall')) {
      expect(outfall.spec).toBe('headwall')
      expect([-35, -5]).toContain(outfall.at[0])
      expect(outfall.invert as number).toBeGreaterThan(layout.storm.riverLevel)
    }
  })

  it('takes every downspout down the gutter of its own kerb to an inlet', () => {
    for (const gutter of ofKind('storm_gutter')) {
      expect(node(gutter.to).kind, gutter.id).toBe('inlet')
      expect(Math.sign(node(gutter.from).at[2]) === Math.sign(node(gutter.to).at[2]) || Math.sign(node(gutter.from).at[0] + 100) === Math.sign(node(gutter.to).at[0] + 100), gutter.id).toBe(true)
    }
  })
})

describe('water', () => {
  it('runs the main under the sidewalk opposite the poles, a valve and a hydrant at the crossing, a service to every lot', () => {
    const mains = ofKind('water_main').filter((edge) => node(edge.to).kind !== 'hydrant')
    for (const main of mains) expect(out.surfaceAt(node(main.from).at[0], node(main.from).at[2]), main.id).toBe('sidewalk')
    expect(out.networks.nodes.filter((entry) => entry.kind === 'hydrant').length).toBe(1)
    expect(ofKind('water_service').length).toBe(LOTS.length)
    expect(Math.max(...ofKind('water_service').map(length))).toBeLessThan(30)
  })
})
