import { describe, expect, it } from 'vitest'

import { distributeLoads, solveSupports } from '../src'
import type { LoadSharing, SupportGraph } from '../src'

/** A structure by name: `rests` lays each part on its supports (one way), `ground` is anchored, `partitions` carry nothing. */
function graphOf(rests: Record<string, string[]>, options: { sharing?: LoadSharing; partitions?: string[]; masses?: Record<string, number> } = {}) {
  const names = [...new Set(['ground', ...Object.keys(rests), ...Object.values(rests).flat()])]
  const index = new Map(names.map((name, k) => [name, k]))
  const graph: SupportGraph = {
    size: names.length,
    sharing: options.sharing ?? 'all',
    anchored: (part) => names[part] === 'ground',
    active: () => true,
    partition: (part) => (options.partitions ?? []).includes(names[part]!),
    supportsOf: (part) => (rests[names[part]!] ?? []).map((on) => ({ on: index.get(on)!, directed: true })),
  }
  const solution = solveSupports(graph)
  const loads = distributeLoads(solution, (part) => (names[part] === 'ground' ? 0 : options.masses?.[names[part]!] ?? 1))
  const load = (name: string): number => loads[index.get(name)!]!
  const carriers = (name: string): string[] => (solution.carriers.get(index.get(name)!) ?? []).map((k) => names[k]!)
  return { load, carriers, solution }
}

describe('the load path: what carries what', () => {
  it('a simply supported beam shares its load between its two pillars', () => {
    const { load, carriers } = graphOf({ beam: ['p1', 'p2'], p1: ['ground'], p2: ['ground'] }, { masses: { beam: 10, p1: 1, p2: 1 } })
    expect(carriers('beam')).toEqual(['p1', 'p2'])
    expect(load('p1')).toBe(6)
    expect(load('p2')).toBe(6)
  })

  it('a beam framing into another rests on it (NBR 6118 18.3.7): the main beam takes half of it down to its pillars', () => {
    const rests = { secondary: ['p1', 'main'], main: ['p2', 'p3'], p1: ['ground'], p2: ['ground'], p3: ['ground'] }
    const all = graphOf(rests, { masses: { secondary: 10, main: 10, p1: 0, p2: 0, p3: 0 } })
    expect(all.carriers('secondary')).toEqual(['p1', 'main'])
    expect(all.load('main')).toBe(15)
    expect(all.load('p2') + all.load('p3') + all.load('p1')).toBe(20)
    // the Visor's rule: only the support nearest the ground carries, and the secondary beam hangs on its pillar alone
    const nearest = graphOf(rests, { sharing: 'nearest', masses: { secondary: 10, main: 10, p1: 0, p2: 0, p3: 0 } })
    expect(nearest.carriers('secondary')).toEqual(['p1'])
  })

  it('a two-way slab rests on the four beams of its edges, whatever their distance from the ground', () => {
    const rests = { slab: ['north', 'south', 'east', 'west'], north: ['c1', 'c2'], south: ['c3', 'c4'], east: ['north', 'south'], west: ['north', 'south'], c1: ['ground'], c2: ['ground'], c3: ['ground'], c4: ['ground'] }
    const { carriers, load } = graphOf(rests, { masses: { slab: 40, north: 0, south: 0, east: 0, west: 0, c1: 0, c2: 0, c3: 0, c4: 0 } })
    expect(carriers('slab').sort()).toEqual(['east', 'north', 'south', 'west'])
    expect(load('east')).toBe(10)
    expect(load('c1') + load('c2') + load('c3') + load('c4')).toBe(40)
  })

  it('a bearing wall carries the slab down to the ground; a partition under it carries nothing', () => {
    const { load, carriers } = graphOf({ slab: ['wall', 'partition'], wall: ['ground'], partition: ['ground'] }, { partitions: ['partition'], masses: { slab: 8, wall: 2, partition: 2 } })
    expect(carriers('slab')).toEqual(['wall'])
    expect(load('wall')).toBe(10)
  })

  it('two parts laid on each other: the joint that closes the cycle does not carry, and every load still reaches the ground', () => {
    const { solution, load } = graphOf({ a: ['b', 'p'], b: ['a', 'p'], p: ['ground'] }, { masses: { a: 1, b: 1, p: 0 } })
    expect(solution.order.length).toBe(4)
    expect(load('p')).toBe(2)
  })
})

describe('sizing from the loads', () => {
  it('a part uses its safety share at rest, and one that must hold a loss stays under the redundancy after the worst one', async () => {
    const { capacitiesByLoad } = await import('../src')
    const base = new Map([['p1', 10], ['p2', 10], ['beam', 5]])
    const lostP1 = new Map([['p2', 20], ['beam', 5]])
    const capacities = capacitiesByLoad({
      parts: ['p1', 'p2', 'beam'], loadOf: (part) => base.get(part), losses: [(part) => lostP1.get(part)], safety: (part) => (part === 'beam' ? 0.45 : 0.65), redundancy: 0.97,
      redundant: (part) => part !== 'beam',
    })
    expect(capacities.get('p1')).toBeCloseTo(10 / 0.65)
    expect(capacities.get('p2')).toBeCloseTo(20 / 0.97)
    expect(capacities.get('beam')).toBeCloseTo(5 / 0.45)
  })
})
