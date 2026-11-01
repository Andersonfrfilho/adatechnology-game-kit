import { checkDestructible } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createTerrain, createTerrainImpl } from '../src'

describe('the terrain as a DestructibleImpl', () => {
  it('describe() and state() hold the cost contract and an update gives the same description', () => {
    const terrain = createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface: 'dirt' } })
    const impl = createTerrainImpl(terrain, { id: 'ground' })
    const report = checkDestructible(impl, { cost: true })
    expect(report.problems.filter((problem) => problem.includes('cost contract'))).toEqual([])
    const first = impl.describe()
    expect(impl.describe()).toBe(first)
    impl.update?.(1 / 60)
    expect(impl.describe()).toEqual(first)
  })
})
