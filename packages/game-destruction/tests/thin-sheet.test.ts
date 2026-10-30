import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { PartSpec } from '../src'

/** A drink can: an aluminium shell 6.6 cm wide whose wall is a tenth of a millimetre (its box says nothing of that). */
const can = (thickness: number): PartSpec => ({ id: 'shell', material: 'aluminium', shape: { kind: 'box', size: [0.066, 0.12, 0.066] }, position: [0, 0.06, 0], thickness, mass: 0.37 })
const blow = (thickness: number, type: 'blunt' | 'slash', energy: number, radius = 0.1) => {
  const world = createDestruction({ seed: 1 })
  const id = world.add({ parts: [can(thickness)] })
  world.hit(id, { type, point: [0, 0.06, 0.033], direction: [0, 0, -1], energy, radius, source: 'test' })
  return world.state(id).parts[0]!
}

describe('a foil-thin sheet (a can)', () => {
  it('folds where a fist lands: deeper than a plate for the same blow, on a patch the size of the fist, not of the whole reach', () => {
    const sheet = blow(0.0001, 'blunt', 25).dents[0]!
    const plate = blow(0.003, 'blunt', 25).dents[0]!
    expect(sheet.depth).toBeGreaterThan(plate.depth * 3)
    expect(sheet.radius).toBeLessThanOrEqual(0.025)
    expect(plate.radius).toBe(0.1)
  })

  it('never folds in past near its middle, however hard the kick', () => {
    expect(blow(0.0001, 'blunt', 2000).dents[0]!.depth).toBeLessThanOrEqual(0.066 * 0.45 + 1e-9)
  })

  it('is cut through by a blade that only scratches a plate', () => {
    expect(blow(0.0001, 'slash', 40, 0.03).holes.some((hole) => hole.through)).toBe(true)
    expect(blow(0.003, 'slash', 40, 0.03).holes).toHaveLength(0)
  })

  it('is shot through on its top as on its side, even at a slant', () => {
    const world = createDestruction({ seed: 1 })
    const id = world.add({ parts: [can(0.00025)] })
    const [shot] = world.shoot([0, 0.6, 0.5], [0, -0.54, -0.5], 500, 9, 'test')
    expect(shot?.penetrated).toBe(true)
    expect(world.state(id).parts[0]!.holes.length).toBeGreaterThan(0)
  })
})
