import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { PartSpec } from '../src'

const plate = (id: string, mm: number, x: number): PartSpec => ({ id, material: 'steel', shape: { kind: 'box', size: [mm / 1000, 1, 1] }, position: [x, 0.5, 0], thickness: mm / 1000, mass: 20 })

/** Two steel plates of `mm` in a row, shot with a round that carries `penetration` mm of steel at its muzzle energy. */
const shootTwoPlates = (mm: number, penetration: number) => {
  const world = createDestruction({ seed: 1 })
  world.add({ parts: [plate('first', mm, 0), plate('second', mm, -0.5)] })
  return world.shoot([2, 0.5, 0], [-1, 0, 0], 3000, 7.8, 'test', { penetration: { steel: penetration } })
}

describe('penetration past a world part', () => {
  it('the round keeps its muzzle penetration only for the first part: the second one stops it', () => {
    const hits = shootTwoPlates(7, 8)
    expect(hits).toHaveLength(2)
    expect(hits[0]!.penetrated).toBe(true)
    // below 7/8 of the muzzle energy the 8 mm of steel scale under the 7 mm plate
    expect(hits[0]!.exitEnergy).toBeLessThan((3000 * 7) / 8)
    expect(hits[1]!.penetrated).toBe(false)
  })

  it('a single plate of the same thickness is still gone through at the muzzle energy', () => {
    const world = createDestruction({ seed: 1 })
    world.add({ parts: [plate('only', 7, 0)] })
    expect(world.shoot([2, 0.5, 0], [-1, 0, 0], 3000, 7.8, 'test', { penetration: { steel: 8 } })[0]!.penetrated).toBe(true)
  })
})
