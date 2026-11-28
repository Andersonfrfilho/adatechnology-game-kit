import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import { MATERIALS, partMass } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { FABRIC_DENSITY, FOAM_DENSITY, structureFill } from '../src/furniture/structure-fill'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

const material = new Map(MATERIALS.map((m) => [m.id, m]))
const massOf = (type: string): number =>
  furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } }).spec.parts.reduce((sum, part) => {
    const def = material.get(part.material)
    return sum + (def ? partMass(part, def) : 0)
  }, 0)

describe('the mass of the furniture comes from how it is built, not from solid blocks', () => {
  it('a thick block is a shell of its skin; a board, a leg and a pane are solid', () => {
    expect(structureFill('wood_hard', { kind: 'box', size: [0.6, 2, 1.6] })).toBeLessThan(0.15)
    expect(structureFill('wood_hard', { kind: 'box', size: [0.018, 2, 0.6] })).toBe(1)
    expect(structureFill('glass', { kind: 'box', size: [0.008, 2, 0.9] })).toBe(1)
    expect(structureFill('paper', { kind: 'box', size: [0.2, 0.3, 0.05] })).toBe(1)
  })

  it('a cushion is foam in a cloth cover', () => {
    const fill = structureFill('fabric', { kind: 'box', size: [0.6, 0.2, 0.6] })
    expect(fill).toBeGreaterThan(FOAM_DENSITY / FABRIC_DENSITY)
    expect(fill).toBeLessThan(0.2)
  })

  it('the pieces of the plans weigh what the real ones do (within a wide band)', () => {
    const bands: Array<[string, number, number]> = [
      ['sofa_3seat', 40, 120],
      ['sofa_2seat', 30, 90],
      ['armchair', 15, 50],
      ['wardrobe', 80, 250],
      ['double_bed', 60, 250],
      ['dresser', 25, 80],
      ['nightstand', 8, 30],
      ['kitchen_cabinet', 40, 120],
      ['dining_table', 15, 50],
    ]
    for (const [type, min, max] of bands) {
      const kg = massOf(type)
      expect(kg, type).toBeGreaterThanOrEqual(min)
      expect(kg, type).toBeLessThanOrEqual(max)
    }
  })
})
