import { describe, expect, it } from 'vitest'

import { generateNetworks } from '../../src/networks'
import type { NetworkNode } from '../../src/networks'
import { LOTS, PLAN } from './district'

const out = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const poles = out.networks.nodes.filter((node) => node.kind === 'pole')
const byId = new Map(out.networks.nodes.map((node) => [node.id, node]))
const plan = (node: NetworkNode): readonly [number, number] => [node.at[0], node.at[2]]
const spans = out.networks.edges.filter((edge) => edge.kind === 'lv_span' && byId.get(edge.from)?.kind === 'pole')

describe('pole placement', () => {
  it('stands every pole on the service strip, 0.4 m from the kerb of its street, never on a road, a lot or the river', () => {
    for (const pole of poles) {
      const [x, z] = plan(pole)
      const fromMain = Math.abs(z) - 5
      const fromCross = Math.abs(x + 100) - 5
      const onStrip = Math.abs(fromMain - 0.4) < 1e-6 || Math.abs(fromCross - 0.4) < 1e-6
      expect(onStrip, pole.id).toBe(true)
      expect(out.surfaceAt(x, z), pole.id).toBe('sidewalk')
      expect(x > -35 && x < -5, pole.id).toBe(false)
    }
  })

  it('keeps one side per street: the side with more lots, on a tie the north or west', () => {
    const sideOf = (prefix: string): number[] => [...new Set(poles.filter((pole) => pole.id.startsWith(`pole:${prefix}:`)).map((pole) => Math.sign(prefix === 'crossing_street' ? pole.at[0] + 100 : pole.at[2])))]
    expect(sideOf('main_street_1')).toEqual([-1])
    expect(sideOf('main_street_0')).toEqual([1])
    expect(sideOf('crossing_street')).toEqual([-1])
  })

  it('spans 40 m at most, and stands a pole on a lot boundary when one is in reach', () => {
    for (const span of spans) {
      const [a, b] = [byId.get(span.from) as NetworkNode, byId.get(span.to) as NetworkNode]
      expect(Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]), span.id).toBeLessThanOrEqual(40 + 1e-9)
    }
    const boundaries = new Set(LOTS.flatMap((lot) => [lot.rect[0], lot.rect[2]]))
    expect(poles.some((pole) => pole.id.startsWith('pole:main_street_1:') && boundaries.has(pole.at[0]))).toBe(true)
  })

  it('guys the corner and end poles, and keeps the in-line ones 5 m from the roadway of a cross street', () => {
    const corners = poles.filter((pole) => Math.abs(Math.abs(pole.at[0] + 100) - 5.4) < 1e-6 && Math.abs(Math.abs(pole.at[2]) - 5.4) < 1e-6)
    expect(corners.length).toBe(3)
    expect(corners.every((pole) => pole.guyed)).toBe(true)
    for (const pole of poles.filter((entry) => !entry.guyed)) {
      const [x, z] = plan(pole)
      const alongMain = Math.abs(Math.abs(z) - 5.4) < 1e-6
      if (alongMain && x < -35) expect(Math.abs(x + 100) - 5, pole.id).toBeGreaterThanOrEqual(5)
      if (!alongMain) expect(Math.abs(z) - 5, pole.id).toBeGreaterThanOrEqual(5)
    }
    const ends = poles.filter((pole) => Math.abs(pole.at[0]) > 218 || Math.abs(pole.at[2]) > 118 || Math.abs(pole.at[0] + 20) < 17)
    expect(ends.length).toBe(6)
    expect(ends.every((pole) => pole.guyed)).toBe(true)
  })

  it('slides a pole clear of a gate in front of it', () => {
    const free = poles.find((pole) => !pole.guyed && pole.id.startsWith('pole:main_street_1:')) as NetworkNode
    const [x, z] = plan(free)
    const gate = [x - 1, z - 1, x + 1, z + 1] as const
    const moved = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11, avoid: [gate] }).networks.nodes.filter((node) => node.kind === 'pole')
    for (const pole of moved) expect(pole.at[0] > gate[0] && pole.at[0] < gate[2] && pole.at[2] > gate[1] && pole.at[2] < gate[3], pole.id).toBe(false)
    expect(moved.length).toBe(poles.length)
  })

  it('hangs a lamp over the road from every pole, fed by its low voltage', () => {
    for (const pole of poles) {
      const lamp = byId.get(`light:${pole.id}`) as NetworkNode
      expect(out.surfaceAt(lamp.at[0], lamp.at[2]), pole.id).toBe('road')
      expect(lamp.at[1]).toBeCloseTo(6.6, 6)
    }
  })
})
