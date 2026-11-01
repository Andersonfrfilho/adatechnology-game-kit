import { createFloorplan, engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { describe, expect, it } from 'vitest'

describe('T5.2 floorplan: the old global engine, called as before, matches an engine made by instance', () => {
  registerResidential(engine, { region: 'br' })
  const made = createFloorplan({ packs: [(target) => registerResidential(target, { region: 'br' })] })

  it('generates the same plans for the same seeds', () => {
    for (const seed of [1, 7, 42]) {
      const options = { seed, locale: 'en' }
      expect(JSON.stringify(made.generate('single_storey_a', options))).toBe(JSON.stringify(engine.generate('single_storey_a', options)))
    }
  })

  it('shares nothing with the global engine', () => {
    const lonely = createFloorplan()
    expect(Object.keys(lonely.templates)).toEqual([])
    expect(Object.keys(engine.templates).length).toBeGreaterThan(0)
  })
})
