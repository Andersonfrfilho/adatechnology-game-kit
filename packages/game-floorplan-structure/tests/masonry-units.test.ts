import { describe, expect, it } from 'vitest'

import { MASONRY_UNITS, MIN_PILLAR_AREA, MIN_PILLAR_SIDE, getMasonryUnit, pillarLoadFactor, pillarSectionOf, registerMasonryUnit, unitServes, wallThicknessOf } from '../src'

describe('masonry units: the catalog and what a wall of each unit is', () => {
  it('has the units of Brazilian masonry with their real sizes, each with the channel of its family where one is sold', () => {
    const sizes = Object.fromEntries([...MASONRY_UNITS.values()].map((u) => [u.id, [u.width, u.height, u.length]]))
    expect(sizes).toMatchObject({
      ceramic_block_9: [0.09, 0.19, 0.29], ceramic_block_14: [0.14, 0.19, 0.29], ceramic_block_19: [0.19, 0.19, 0.29],
      concrete_block_14: [0.14, 0.19, 0.39], concrete_block_19: [0.19, 0.19, 0.39], solid_brick: [0.1, 0.05, 0.2],
    })
    for (const unit of MASONRY_UNITS.values()) {
      expect(unit.mass, unit.id).toBeGreaterThan(0)
      if (unit.family !== 'solid_brick') expect(unit.channel?.length, unit.id).toBe(unit.length)
    }
  })

  it('a wall is the unit and 1.5 cm of render on each face', () => {
    expect(wallThicknessOf(getMasonryUnit('ceramic_block_14'))).toBe(0.17)
    expect(wallThicknessOf(getMasonryUnit('concrete_block_19'))).toBe(0.22)
  })

  it('a pillar is as wide as the units (its form) and long enough for the 360 cm² of NBR 6118, never under 14 cm', () => {
    expect(pillarSectionOf(getMasonryUnit('ceramic_block_14'))).toEqual({ across: 0.14, along: 0.3 })
    expect(pillarSectionOf(getMasonryUnit('ceramic_block_19'))).toEqual({ across: 0.19, along: 0.2 })
    expect(pillarSectionOf(getMasonryUnit('ceramic_block_9')).across).toBe(MIN_PILLAR_SIDE)
    for (const unit of MASONRY_UNITS.values()) {
      const { across, along } = pillarSectionOf(unit)
      expect(across * along, unit.id).toBeGreaterThanOrEqual(MIN_PILLAR_AREA - 1e-9)
    }
  })

  it('takes the factor γn of NBR 6118 13.2.3 under 19 cm', () => {
    expect(pillarLoadFactor(0.14)).toBe(1.25)
    expect(pillarLoadFactor(0.19)).toBe(1)
  })

  it('says which units can build a structural wall (NBR 16868) and lets a game add its own', () => {
    expect(unitServes(getMasonryUnit('concrete_block_14'), 'structural')).toBe(true)
    expect(unitServes(getMasonryUnit('ceramic_block_14'), 'structural')).toBe(false)
    registerMasonryUnit({ ...getMasonryUnit('ceramic_block_14'), id: 'test_block_11', width: 0.115 })
    expect(getMasonryUnit('test_block_11').width).toBe(0.115)
    expect(() => getMasonryUnit('nope')).toThrow(/registerMasonryUnit/)
  })
})
