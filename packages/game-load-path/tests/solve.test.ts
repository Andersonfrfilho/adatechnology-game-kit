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

describe('shares by contact', () => {
  it('carriers under one bearing (no contact points given): each takes the share of its contact', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    const graph = {
      size: 4, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false,
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 3 }, { on: 3, directed: true, weight: 1 }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const solution = solveSupports(graph)
    const loads = distributeLoads(solution, (k) => (k === 1 ? 8 : 0))
    expect(loads[2]).toBeCloseTo(6)
    expect(loads[3]).toBeCloseTo(2)
  })

  it('a bond beam on a concrete pillar and on brick infill: by contact times stiffness, the stiffer pillar takes its share of E A', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // contact 0.042 m² of concrete (28 GPa) and 0.65 m² of brick (2.35 GPa)
    const modulus = [0, 0, 28, 2.35]
    const graph = {
      size: 4, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, stiffness: (k: number) => modulus[k], upright: (k: number) => k > 1,
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 0.042 }, { on: 3, directed: true, weight: 0.65 }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 100 : 0))
    const pillar = (0.042 * 28) / (0.042 * 28 + 0.65 * 2.35)
    expect(loads[2]).toBeCloseTo(100 * pillar)
    expect(loads[3]).toBeCloseTo(100 * (1 - pillar))
  })

  it('a concrete lintel on a masonry pier is as stiff as the masonry: the beam over both shares by contact alone', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // 1 beam on 2 (concrete lintel, lying, on the pier 3) and on 4 (masonry wall): both paths are masonry
    const modulus = [0, 0, 28, 2.35, 2.35]
    const graph = {
      size: 5, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, stiffness: (k: number) => modulus[k], upright: (k: number) => k > 2,
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 1 }, { on: 4, directed: true, weight: 1 }] : k === 2 ? [{ on: 3, directed: true }] : k > 2 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 10 : 0))
    expect(loads[2]).toBeCloseTo(5)
    expect(loads[4]).toBeCloseTo(5)
  })

  it('a carrier with no known stiffness: the contact alone shares the load', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    const graph = {
      size: 4, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false,
      stiffness: (k: number) => (k === 2 ? 28 : undefined), upright: () => true,
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 3 }, { on: 3, directed: true, weight: 1 }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 8 : 0))
    expect(loads[2]).toBeCloseTo(6)
    expect(loads[3]).toBeCloseTo(2)
  })

  it('a lintel on two bearings of unequal length takes equal reactions: statics, not the bearing area', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // 1: a lintel from x 0 to 2.6 on 2 (bearing 0 to 0.2) and on 3 (bearing 2.2 to 2.6), its centroid at 1.3
    const graph = {
      size: 4, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, centre: (): [number, number] => [1.3, 0],
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 0.2, at: [0.1, 0] as [number, number] }, { on: 3, directed: true, weight: 0.4, at: [2.4, 0] as [number, number] }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 10 : 0))
    // lever rule on the bearing centres 0.1 and 2.4: 1.3 is 1.2 from the first, 1.1 from the second
    expect(loads[2]).toBeCloseTo((10 * 1.1) / 2.3)
    expect(loads[3]).toBeCloseTo((10 * 1.2) / 2.3)
  })

  it('a beam from a concrete pillar to a masonry wall takes half on each: the stiffness of the ends does not move a determinate reaction', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    const modulus = [0, 0, 28, 2.35]
    const graph = {
      size: 4, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, stiffness: (k: number) => modulus[k], upright: (k: number) => k > 1,
      height: () => 2.6, centre: (): [number, number] => [2, 0],
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 0.04, at: [0, 0] as [number, number] }, { on: 3, directed: true, weight: 0.03, at: [4, 0] as [number, number] }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 10 : 0))
    expect(loads[2]).toBeCloseTo(5)
    expect(loads[3]).toBeCloseTo(5)
  })

  it('a concrete pillar standing on a masonry pier is no stiffer than the pier: compliances add in series', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // 1 rests at one bearing on 2 (a concrete pillar 1 m on the masonry pier 4, 2 m) and on 3 (a masonry wall 3 m on the ground)
    const modulus = [0, 0, 28, 2.35, 2.35]
    const height = [0, 0, 1, 3, 2]
    const graph = {
      size: 5, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, stiffness: (k: number) => modulus[k], upright: (k: number) => k > 1,
      height: (k: number) => height[k]!,
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, weight: 1 }, { on: 3, directed: true, weight: 1 }] : k === 2 ? [{ on: 4, directed: true }] : k > 2 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 10 : 0))
    const pillar = 1 / (1 / 28 + 2 / 2.35), wall = 1 / (3 / 2.35)
    expect(loads[2]).toBeCloseTo((10 * pillar) / (pillar + wall))
  })
  it('a rigid slab on four pillars under a centred load: a quarter each, whatever the stiffness of the paths under them (statics before stiffness)', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // 1 a tank slab 1.34 x 1.34 m on the pillars 2, 3 (on concrete, 28 GPa) and 4, 5 (on masonry, 2.35 GPa), its centroid in the middle
    const modulus = [0, 0, 28, 28, 2.35, 2.35]
    const corners: [number, number][] = [[0, 0], [1.34, 0], [0, 1.34], [1.34, 1.34]]
    const graph = {
      size: 6, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, stiffness: (k: number) => modulus[k], upright: (k: number) => k > 1,
      height: () => 2.6, centre: (): [number, number] => [0.67, 0.67],
      supportsOf: (k: number) => (k === 1 ? corners.map((at, i) => ({ on: [2, 4, 3, 5][i]!, directed: true, weight: 0.04, at })) : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 1000 : 0))
    for (const k of [2, 3, 4, 5]) expect(loads[k]).toBeCloseTo(250)
  })

  it('a rigid slab on three pillars takes its load by statics: the centroid over a third of the way gives the reactions of the lever', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // pillars at (0, 0), (3, 0) and (0, 3); the centroid at (1, 0.5): R2 = 1000 x 0.5 / 3 ... by moments, R3 = 1000 x 1 / 3, R4 = 1000 x 0.5 / 3, R2 the rest
    const graph = {
      size: 5, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, upright: (k: number) => k > 1, centre: (): [number, number] => [1, 0.5],
      supportsOf: (k: number) => (k === 1 ? [{ on: 2, directed: true, at: [0, 0] as [number, number] }, { on: 3, directed: true, at: [3, 0] as [number, number] }, { on: 4, directed: true, at: [0, 3] as [number, number] }] : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 1000 : 0))
    expect(loads[3]).toBeCloseTo(1000 / 3)
    expect(loads[4]).toBeCloseTo(1000 / 6)
    expect(loads[2]).toBeCloseTo(1000 / 2)
  })

  it('a load outside its carriers lifts the far one: it carries nothing and the others share by statics', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // pillars at (0, 0), (1, 0), (0, 1) and (4, 4), the centroid at (0.2, 0.2): on four equal springs the far one would take -0.03 of the load (pulled
    // up); it carries nothing and the other three take it by statics, 0.6, 0.2 and 0.2
    const at: [number, number][] = [[0, 0], [1, 0], [0, 1], [4, 4]]
    const graph = {
      size: 6, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, upright: (k: number) => k > 1, centre: (): [number, number] => [0.2, 0.2],
      supportsOf: (k: number) => (k === 1 ? at.map((p, i) => ({ on: 2 + i, directed: true, at: p })) : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 10 : 0))
    expect(loads[5]).toBeCloseTo(0)
    expect(loads[2]).toBeCloseTo(6)
    expect(loads[3]).toBeCloseTo(2)
    expect(loads[4]).toBeCloseTo(2)
  })

  it('a slab panel on four beams is no rigid body: it bends with them and shares by contact and stiffness, as before', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // the four edge beams (lying) of a panel, contact 3 on the long edges and 1 on the short ones, the centroid in the middle: 3 : 1 : 3 : 1
    const at: [number, number][] = [[2, 0], [4, 1], [2, 2], [0, 1]]
    const graph = {
      size: 6, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, upright: () => false, centre: (): [number, number] => [2, 1],
      supportsOf: (k: number) => (k === 1 ? at.map((p, i) => ({ on: 2 + i, directed: true, weight: i % 2 ? 1 : 3, at: p })) : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 8 : 0))
    expect([loads[2], loads[3], loads[4], loads[5]].map((x) => Math.round(x! * 100) / 100)).toEqual([3, 1, 3, 1])
  })

  it('a beam over a row of pillars is no rigid body: it shares by the stiffness of each, as before', async () => {
    const { distributeLoads, solveSupports } = await import('../src')
    // three equal pillars on a line at x 0, 1 and 4, the centroid at 0.2: equal thirds (a rigid beam would lift the far one)
    const graph = {
      size: 5, sharing: 'all' as const, anchored: (k: number) => k === 0, active: () => true, partition: () => false, upright: (k: number) => k > 1, centre: (): [number, number] => [0.2, 0],
      supportsOf: (k: number) => (k === 1 ? [0, 1, 4].map((x, i) => ({ on: 2 + i, directed: true, at: [x, 0] as [number, number] })) : k > 1 ? [{ on: 0, directed: true }] : []),
    }
    const loads = distributeLoads(solveSupports(graph), (k) => (k === 1 ? 9 : 0))
    for (const k of [2, 3, 4]) expect(loads[k]).toBeCloseTo(3)
  })
})
