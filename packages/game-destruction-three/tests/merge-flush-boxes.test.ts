import { describe, expect, it } from 'vitest'
import { mergeFlushBoxes } from '../src/merge-flush-boxes'

const plank = (z: number) => ({ center: [0, 0.5, z] as [number, number, number], half: [1, 0.02, 0.1] as [number, number, number] })

describe('boxes that continue one another', () => {
  it('six planks side by side are one box', () => {
    const merged = mergeFlushBoxes([0, 1, 2, 3, 4, 5].map((i) => plank(-0.5 + 0.2 * i + 0.1)))
    expect(merged).toHaveLength(1)
    expect(merged[0]!.half[2]).toBeCloseTo(0.6, 6)
    expect(merged[0]!.center[2]).toBeCloseTo(0.1, 6)
    expect(merged[0]!.half[0]).toBe(1)
  })

  it('a gap, a different thickness or a turn keeps them apart', () => {
    expect(mergeFlushBoxes([plank(0), plank(0.25)])).toHaveLength(2)
    expect(mergeFlushBoxes([plank(0), { ...plank(0.2), half: [1, 0.03, 0.1] }])).toHaveLength(2)
    expect(mergeFlushBoxes([plank(0), { ...plank(0.2), rotation: [0, 0.1, 0, 0.995] }])).toHaveLength(2)
  })
})
