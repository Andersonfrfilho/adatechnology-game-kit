import { describe, expect, it } from 'vitest'

import { createReferenceUrban, referencePlan } from '../src/game/plan'
import { plan, site } from './helpers'

const urban = createReferenceUrban()
const layout = urban.cities.layout(referencePlan.id)

/** Edges of the grid of blocks of a district: each block has its centre and a side `size` less the street. */
function blockEdges(districtId: string, street = 10): { x: number[]; z: number[] } {
  const x = new Set<number>()
  const z = new Set<number>()
  for (const block of layout.blocks(districtId)) {
    const half = (block.size[0] + street) / 2
    for (const edge of [block.x - half, block.x + half]) x.add(edge)
    for (const edge of [block.z - half, block.z + half]) z.add(edge)
  }
  return { x: [...x].sort((a, b) => a - b), z: [...z].sort((a, b) => a - b) }
}

describe('the plan in game-urban', () => {
  it('registers by packs.cityPlans and resolves to the two districts', () => {
    expect(urban.cities.plans.has(plan.id)).toBe(true)
    expect(site.plan).toBe(plan.id)
    expect(layout.districts.map((district) => district.id)).toEqual(['downtown_edge', 'popular_quarter'])
    expect(layout.districts.map((district) => district.zone)).toEqual(['zr3_zm', 'zr2'])
  })

  it('the downtown edge has 3 x 4 blocks of 60 m with the edges of the design', () => {
    const edges = blockEdges('downtown_edge')
    expect(layout.blocks('downtown_edge')).toHaveLength(12)
    expect(edges.x).toEqual([-220, -160, -100, -40])
    expect(edges.z).toEqual([-120, -60, 0, 60, 120])
  })

  it('the popular quarter has 5 x 6 blocks of 45 m with the edges of the design', () => {
    const edges = blockEdges('popular_quarter')
    expect(layout.blocks('popular_quarter')).toHaveLength(30)
    expect(edges.x).toEqual([0, 45, 90, 135, 180, 225])
    expect(edges.z).toEqual([-135, -90, -45, 0, 45, 90, 135])
  })

  it('the street of the script (z = 0) is a block edge of both districts', () => {
    expect(blockEdges('downtown_edge').z).toContain(0)
    expect(blockEdges('popular_quarter').z).toContain(0)
  })

  it('the crossing of the caos script (-100, 0) is on block edges of the downtown edge', () => {
    const edges = blockEdges('downtown_edge')
    expect(edges.x).toContain(-100)
    expect(edges.z).toContain(0)
  })

  it('every line of the plan runs along an edge of the blocks', () => {
    const downtown = blockEdges('downtown_edge')
    const quarter = blockEdges('popular_quarter')
    const main = layout.lines.find((line) => line.id === 'main_street')!
    expect(main.points.every((point) => point[1] === 0)).toBe(true)
    expect(downtown.z.concat(quarter.z)).toContain(main.points[0]![1])
    const crossing = layout.lines.find((line) => line.id === 'crossing_street')!
    expect(downtown.x).toContain(crossing.points[0]![0])
  })
})
