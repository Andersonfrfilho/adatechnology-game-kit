import { describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register, defaultDistribution } from '../src'

registerResidential(engine)

describe('post-apocalyptic state plugin', () => {
  it('without the pack the engine only offers normal', () => {
    expect(engine.listStates()).toEqual(['normal'])
    expect(engine.generate('single_storey_a', { seed: 1 }).state).toBe('normal')
  })

  it('adds the fortified and abandoned states with the 35/45/20 default distribution', () => {
    register(engine)
    expect(engine.listStates().sort()).toEqual(['abandoned', 'fortified', 'normal'])
    expect(defaultDistribution).toEqual({ fortified: 0.35, abandoned: 0.45, normal: 0.2 })
    const count: Record<string, number> = { fortified: 0, abandoned: 0, normal: 0 }
    for (let s = 1; s <= 300; s++) count[engine.generate('single_storey_a', { seed: s }).state]++
    expect(count.abandoned).toBeGreaterThan(count.fortified * 0.9)
    expect(count.normal).toBeLessThan(count.fortified)
  })

  it('the distribution is configurable', () => {
    register(engine, { distribution: { fortified: 1, abandoned: 0, normal: 0 } })
    for (let s = 1; s <= 20; s++) expect(engine.generate('single_storey_a', { seed: s }).state).toBe('fortified')
    register(engine, { distribution: { fortified: 0, abandoned: 0, normal: 1 } })
    for (let s = 1; s <= 20; s++) expect(engine.generate('single_storey_a', { seed: s }).state).toBe('normal')
  })

  it('an explicit state always wins over the distribution', () => {
    expect(engine.generate('single_storey_a', { seed: 1, state: 'abandoned' }).state).toBe('abandoned')
  })

  it('normal plans carry no state items; the other states add some', () => {
    expect(engine.generate('townhouse', { seed: 2, state: 'normal' }).stateItems).toEqual([])
    expect(engine.generate('townhouse', { seed: 2, state: 'fortified' }).stateItems.length).toBeGreaterThan(0)
    expect(engine.generate('townhouse', { seed: 2, state: 'abandoned' }).stateItems.length).toBeGreaterThan(0)
  })
})
