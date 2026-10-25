import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { PartSpec } from '../src'

/** The generic penetration input: `Hit.penetration` is millimetres by material class; the world reads no calibre names. */
const plate = (material: string, mm: number): PartSpec => ({ id: 'p', material, shape: { kind: 'box', size: [mm / 1000, 1, 1] }, position: [0, 0.5, 0], thickness: mm / 1000, ...(material === 'steel' ? { mass: 20 } : {}) })
const shoot = (spec: PartSpec, penetration: Record<string, number> | undefined, energy = 3000) => {
  const world = createDestruction({ seed: 1 })
  world.add({ parts: [spec] })
  return world.shoot([2, 0.5, 0], [-1, 0, 0], energy, 7.8, 'test', penetration ? { penetration } : undefined)[0]!
}

describe('Hit.penetration', () => {
  it('a part as thick as the round goes through (scaled by the material) stops it, a thinner one does not', () => {
    // structural steel is penetrated 1.3 mm per mm of the table's steel: 6 mm of the table is 7.8 mm of this steel
    expect(shoot(plate('steel', 7), { steel: 6 }).penetrated).toBe(true)
    expect(shoot(plate('steel', 8.5), { steel: 6 }).penetrated).toBe(false)
    expect(shoot(plate('steel', 8.5), { steel: 18 }).penetrated).toBe(true)
  })

  it('the energy alone does not decide when the round carries its table', () => {
    expect(shoot(plate('steel', 8.5), undefined).penetrated).toBe(true)
    expect(shoot(plate('steel', 8.5), { steel: 5 }).penetrated).toBe(false)
  })

  it('the class and the scale come from the material: softwood is gone through 1.5 mm per mm of hardwood, aluminium 3 mm per mm of steel', () => {
    expect(shoot(plate('wood_hard', 101), { wood: 100 }, 1).penetrated).toBe(false)
    expect(shoot(plate('wood_hard', 99), { wood: 100 }, 1).penetrated).toBe(true)
    expect(shoot(plate('wood_soft', 151), { wood: 100 }, 1).penetrated).toBe(false)
    expect(shoot(plate('wood_soft', 149), { wood: 100 }, 1).penetrated).toBe(true)
    expect(shoot(plate('aluminium', 29), { steel: 10 }).penetrated).toBe(true)
    expect(shoot(plate('aluminium', 31), { steel: 8 }).penetrated).toBe(false)
  })

  it('a material the table does not name falls back to the energy rule', () => {
    expect(shoot(plate('glass', 6), { steel: 1 }, 500).penetrated).toBe(true)
    expect(shoot(plate('glass', 6), { steel: 1 }, 1).penetrated).toBe(false)
  })

  it('what is left after the part shrinks with the thickness', () => {
    const thin = shoot(plate('steel', 2), { steel: 10 })
    const thick = shoot(plate('steel', 12), { steel: 10 })
    expect(thin.exitEnergy).toBeGreaterThan(thick.exitEnergy)
    expect(thick.exitEnergy).toBeGreaterThan(0)
  })

  it('a bare number is still the piercing factor of the energy rule', () => {
    const world = createDestruction({ seed: 1 })
    world.add({ parts: [plate('steel', 8.5)] })
    expect(world.shoot([2, 0.5, 0], [-1, 0, 0], 3000, 7.8, 'test', 0.25)[0]!.penetrated).toBe(false)
  })
})
