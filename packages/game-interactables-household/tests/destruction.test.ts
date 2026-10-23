import { describe, expect, it } from 'vitest'
import { HOUSEHOLD_TYPES } from '../src'
import { REGIONS, build } from './helpers'

// Material ids of @adatechnology/game-destruction (copied: this package does not depend on it).
const MATERIALS = [
  'steel', 'cast_iron', 'aluminium', 'copper', 'wood_soft', 'wood_hard', 'plywood', 'mdf', 'glass', 'tempered_glass', 'ceramic', 'concrete',
  'brick', 'plaster', 'stone', 'plastic', 'rubber', 'fabric', 'foam', 'leather', 'paper', 'foliage', 'green_wood', 'cactus', 'flesh_fruit',
  'wax', 'soil',
]
const JOINTS = ['screw', 'bolt', 'nail', 'weld', 'glue', 'hinge', 'clip', 'tie', 'mortar', 'fused', 'stem']
const PIECES = ['door', 'drawer', 'leg', 'top', 'glass', 'shelf', 'lid', 'panel', 'handle', 'knob', 'button', 'rocker', 'breaker', 'slat', 'cord', 'curtain', 'flap', 'flag', 'cloth', 'valve', 'bucket']
const FLUIDS = ['water', 'fuel', 'oil', 'gas', 'sap', 'acid', 'blood']

describe('destruction tags', () => {
  it.each(HOUSEHOLD_TYPES)('%s: default body and every part are tagged with valid ids', (type) => {
    const { spec } = build(type, { circuits: [{ id: 'a' }, { id: 'b' }], points: [[0, 0, 0], [1, 0, 0]], house: [1, 3, 0] })
    expect(spec.destruction, 'object default').toBeDefined()
    expect(MATERIALS).toContain(spec.destruction!.material)
    expect(JOINTS).toContain(spec.destruction!.joint)
    for (const p of spec.parts ?? []) {
      const d = p.destruction
      expect(d, `${type}/${p.id}`).toBeDefined()
      expect(MATERIALS, `${type}/${p.id} material`).toContain(d!.material)
      expect(JOINTS, `${type}/${p.id} joint`).toContain(d!.joint)
      expect(PIECES, `${type}/${p.id} piece`).toContain(d!.piece)
    }
  })

  it('uses the expected materials for the main types', () => {
    const body = (t: string) => build(t).spec.destruction
    expect(body('fridge')).toMatchObject({ material: 'steel', joint: 'weld' })
    expect(body('wardrobe')).toMatchObject({ material: 'mdf', joint: 'screw' })
    expect(body('toilet')?.material).toBe('ceramic')
    expect(body('bbq')).toMatchObject({ material: 'brick', joint: 'mortar' })
    expect(body('dog_house')).toMatchObject({ material: 'plywood', joint: 'nail' })
    expect(body('trash_bin')?.material).toBe('plastic')
    const door = build('wardrobe').spec.parts!.find((p) => p.id === 'door_1')!
    expect(door.destruction).toEqual({ material: 'mdf', joint: 'hinge', piece: 'door' })
    const dr = build('dresser').spec.parts!.find((p) => p.id === 'drawer_1')!
    expect(dr.destruction).toEqual({ material: 'mdf', joint: 'clip', piece: 'drawer' })
    expect(build('shower').spec.parts!.find((p) => p.id === 'glass_door')!.destruction?.material).toBe('tempered_glass')
    expect(build('curtain').spec.parts![0].destruction?.material).toBe('fabric')
  })

  it.each(REGIONS)('gas_bottle (%s) explodes and holds pressurized gas', (region) => {
    const d = build('gas_bottle', {}, region).spec.destruction!
    expect(d.material).toBe('steel')
    expect(d.explodes!.energy).toBeGreaterThan(100000)
    expect(d.explodes!.radius).toBeGreaterThan(2)
    expect(d.explodes!.atC).toBeGreaterThan(100)
    expect(FLUIDS).toContain(d.contains!.fluid)
    expect(d.contains!.fluid).toBe('gas')
    expect(d.contains!.liters).toBeGreaterThan(10)
    expect(d.contains!.pressurized).toBe(true)
  })

  it('water fixtures do not hold water themselves', () => {
    for (const t of ['sink_kitchen', 'sink_bathroom', 'shower', 'toilet', 'utility_sink']) {
      const s = build(t).spec
      expect(s.destruction?.contains).toBeUndefined()
      for (const p of s.parts ?? []) expect(p.destruction?.contains).toBeUndefined()
    }
  })
})
