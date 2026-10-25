import { describe, expect, it } from 'vitest'
import { buildFrame, createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, DestructionEvent } from '../src'

describe('buildFrame: continuous columns, caged columns, roof thickness', () => {
  const tall = (continuousColumns: boolean) => sizeStructure(buildFrame({ spanX: 8, spanZ: 16, columnsX: 3, columnsZ: 5, floors: 20, columnSize: 0.6, continuousColumns }))

  it('a 20-storey frame stands on continuous columns; with each column on the slab below its first-floor beams carry the whole tower in bending', () => {
    const stress = (spec: DestructibleSpec) => {
      const w = createDestruction()
      return Math.max(...w.state(w.add(spec))!.parts.map((p) => p.stress ?? 0))
    }
    expect(stress(tall(true))).toBeLessThanOrEqual(0.65 + 1e-6)
    expect(stress(tall(false))).toBeGreaterThan(1)
    const spec = tall(true)
    expect(spec.joints!.find((j) => j.a === 'column_7_1_2')!.b).toBe('column_6_1_2')
    // the slab carries its own floor only
    const w = createDestruction()
    const id = w.add(spec)
    expect(w.part(id, 'slab_0')!.load).toBeCloseTo(w.part(id, 'slab_15')!.load!, 0)
  })

  it('columnCage and roofThickness', () => {
    const spec = buildFrame({ floors: 2, columnCage: { material: 'steel', spacing: 0.15, diameter: 0.02 }, roofThickness: 0.2 })
    expect(spec.parts.find((p) => p.id === 'column_0_0_0')!.reinforcement).toEqual({ material: 'steel', spacing: 0.15, diameter: 0.02 })
    expect((spec.parts.find((p) => p.id === 'roof')!.shape as { size: number[] }).size[1]).toBe(0.2)
    expect((buildFrame({ floors: 2 }).parts.find((p) => p.id === 'roof')!.shape as { size: number[] }).size[1]).toBeCloseTo(0.15, 9)
  })
})

describe('contains.outflow: a fluid that runs down through the hole', () => {
  it('the leak goes the way outflow says, in world space', () => {
    const sheet = (outflow?: [number, number, number]): DestructibleSpec => ({
      parts: [{ id: 'membrane', material: 'rubber', shape: { kind: 'box', size: [4, 0.0015, 4] }, position: [0, 0, 0], contains: { fluid: 'water', liters: 20, ...(outflow ? { outflow } : {}) } }],
    })
    const leakOf = (spec: DestructibleSpec) => {
      const w = createDestruction()
      w.add(spec, { position: [0, 3, 0] })
      return w.shoot([0, 10, 0], [0, -1, 0], 3000, 9).flatMap((h) => h.events).find((e): e is Extract<DestructionEvent, { type: 'leak' }> => e.type === 'leak')!
    }
    expect(leakOf(sheet([0, -1, 0])).direction).toEqual([expect.closeTo(0, 9), expect.closeTo(-1, 9), expect.closeTo(0, 9)])
    // default: out of the hole, toward the shooter
    expect(leakOf(sheet()).direction[1]).toBeCloseTo(1, 6)
  })
})
