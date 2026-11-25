import { describe, expect, it } from 'vitest'

import { generateNetworks, validateNetworks } from '../../src/networks'
import type { GenerateNetworksParams, NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'
import { AVENUE, DOUBLE, LONG_RIVER, T_JUNCTION } from './layouts'

const run = (params: Omit<GenerateNetworksParams, 'seed'> & { seed?: number }) => {
  const out = generateNetworks({ seed: 3, ...params })
  return { out, violations: validateNetworks(out.networks, { connections: out.connections, surfaceAt: out.surfaceAt, frontages: out.frontages }) }
}
const nodesOf = (out: ReturnType<typeof generateNetworks>, kind: NetworkNode['kind']): NetworkNode[] => out.networks.nodes.filter((node) => node.kind === kind)

describe.each([
  ['a T junction', T_JUNCTION],
  ['an avenue with the poles on opposite sides', AVENUE],
  ['the cut at twice its size', DOUBLE],
  ['a river three times as long', LONG_RIVER],
])('the networks of %s', (_, layout) => {
  for (const seed of [1, 7, 11]) {
    it(`pass every rule with no warning (seed ${seed})`, () => {
      const { out, violations } = run({ ...layout, seed })
      expect(violations).toEqual([])
      expect(out.warnings).toEqual([])
    })
  }

  it('stand every pole off every roadway, no span longer than 40 m', () => {
    const { out } = run(layout)
    const at = new Map(out.networks.nodes.map((node) => [node.id, node.at]))
    for (const pole of nodesOf(out, 'pole')) expect(out.surfaceAt(pole.at[0], pole.at[2]), pole.id).not.toBe('road')
    for (const span of out.networks.edges.filter((edge) => edge.kind === 'lv_span' || edge.kind === 'telecom_span')) {
      const [a, b] = [at.get(span.from), at.get(span.to)]
      if (a !== undefined && b !== undefined) expect(Math.hypot(a[0] - b[0], a[2] - b[2]), span.id).toBeLessThanOrEqual(40 + 1e-6)
    }
  })
})

describe('street ends and set-back lots', () => {
  it('treats the end of a street at another as a corner: a guyed pole on the sidewalk, none in the main roadway', () => {
    const { out } = run(T_JUNCTION)
    const poles = nodesOf(out, 'pole')
    expect(poles.find((pole) => Math.abs(pole.at[0] + 5.4) < 1e-6 && Math.abs(pole.at[2] + 5.4) < 1e-6)?.guyed).toBe(true)
    expect(poles.filter((pole) => Math.abs(pole.at[2]) < 5 && Math.abs(pole.at[0]) < 5)).toEqual([])
  })

  it('joins the corners of the two streets with a span, so one feed serves both', () => {
    const { out } = run(T_JUNCTION)
    expect(nodesOf(out, 'feed').length).toBe(2)
  })

  it('reaches a lot set back from its street through service poles, every drop within 30 m', () => {
    const { out, violations } = run(DOUBLE)
    expect(violations).toEqual([])
    const service = nodesOf(out, 'pole').filter((pole) => pole.id.includes(':lot:'))
    expect(service.length).toBeGreaterThan(0)
    expect(service.every((pole) => !pole.carries.includes('power_mv') && !pole.carries.includes('lighting'))).toBe(true)
  })
})

describe('the sewer and the drainage at their limits', () => {
  it('lifts a main that would go deeper than 4.5 m with a pumping station', () => {
    const { out, violations } = run(LONG_RIVER)
    expect(violations).toEqual([])
    expect(nodesOf(out, 'pumping_station').length).toBeGreaterThan(0)
    for (const node of out.networks.nodes.filter((entry) => entry.carries.includes('sewer') && entry.invert !== undefined)) expect(node.at[1] - (node.invert as number), node.id).toBeLessThanOrEqual(4.5)
  })

  it('keeps every outfall above the river, lifting the gallery when the river runs high', () => {
    const { out, violations } = run({ plan: PLAN, lots: LOTS, rules: { layout: { storm: { riverLevel: -2.5 } } } })
    expect(violations).toEqual([])
    for (const outfall of nodesOf(out, 'outfall')) expect(outfall.invert as number, outfall.id).toBeGreaterThan(-2.5)
    expect(nodesOf(out, 'pumping_station').some((node) => node.carries.includes('storm'))).toBe(true)
  })

  it('takes the sewer of a district with no river to a treatment node at the border', () => {
    const { out } = run(T_JUNCTION)
    const treatments = nodesOf(out, 'treatment')
    expect(treatments.length).toBe(1)
    expect(Math.max(Math.abs(treatments[0]?.at[0] ?? 0) - 200, Math.abs(treatments[0]?.at[2] ?? 0) - 125)).toBeGreaterThanOrEqual(0)
  })
})

describe('the circuits at their limits', () => {
  it('splits a circuit whose demand is over the largest transformer, and loads none over it', () => {
    const heavy = generateNetworks({ plan: PLAN, lots: LOTS, seed: 3 }).connections.map((connection) => (connection.network === 'power' ? { ...connection, installedKva: 40 } : connection))
    const rules = { power: { transformers: [{ id: 't15', kva: 15 }, { id: 't30', kva: 30 }] } }
    const { out, violations } = run({ plan: PLAN, lots: LOTS, connections: heavy, rules })
    expect(violations).toEqual([])
    expect(nodesOf(out, 'transformer').length).toBeGreaterThan(2)
  })

  it('never stands a pole in front of a gate: with no free ground in reach it says so', () => {
    const wall = [-300, -8, 300, 8] as const
    const { out } = run({ plan: PLAN, lots: LOTS, avoid: [wall] })
    expect(out.warnings.length).toBeGreaterThan(0)
    expect(out.warnings.some((warning) => warning.code === 'pole_on_avoid')).toBe(true)
    // with no free ground a pole cannot be added in front of a lot either: the drop is laid and told off the street's practice
    expect(out.warnings.every((warning) => warning.code === 'pole_on_avoid' || warning.code === 'drop_off_practice')).toBe(true)
  })
})
