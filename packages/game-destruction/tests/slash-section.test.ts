import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { PartShape } from '../src'

type V = [number, number, number]
const slash = { type: 'slash' as const, point: [0.15, 0.1, 0] as V, direction: [-1, 0, 0] as V, energy: 100, radius: 0.05 }
const blunt = { type: 'blunt' as const, point: [0.15, 0.1, 0] as V, direction: [-1, 0, 0] as V, energy: 100, radius: 0.05 }

/** Hits of the given kind until a wood part with this shape is broken. */
const until = (shape: PartShape, hit: typeof slash | typeof blunt, max = 5000): number => {
  const w = createDestruction()
  const id = w.add({ parts: [{ id: 'p', material: 'wood_soft', shape, position: [0, 0, 0] }] }, { id: 'x' })
  let n = 0
  for (; n < max && w.part(id, 'p')!.status !== 'broken'; n++) w.hitPart(id, 'p', hit)
  return n
}
const cyl = (h: number): PartShape => ({ kind: 'cylinder', radius: 0.15, height: h })

describe('slash follows the cross-section', () => {
  it('a 1 m and a 3 m cylinder of the same diameter take the same slash hits', () => {
    const short = until(cyl(1), slash)
    const long = until(cyl(3), slash)
    expect(short).toBeGreaterThan(1)
    expect(Math.abs(long - short)).toBeLessThanOrEqual(1)
  })

  it('blunt damage still follows the whole part', () => {
    const short = until(cyl(0.3), blunt)
    const long = until(cyl(3), blunt)
    expect(long / short).toBeGreaterThan(8)
    expect(long / short).toBeLessThan(12)
  })

  it('parts up to 1 m are unaffected; a longer box takes its length in metres times more (at most 50)', () => {
    const dmg = (size: V) => {
      const w = createDestruction()
      const id = w.add({ parts: [{ id: 'p', material: 'wood_soft', shape: { kind: 'box', size }, position: [0, 0, 0] }] }, { id: 'x' })
      return w.hitPart(id, 'p', slash).damage
    }
    const cube = dmg([0.3, 0.3, 0.3])
    expect(cube).toBeGreaterThan(0)
    expect(dmg([0.3, 1, 0.3]) / cube).toBeCloseTo(1, 5)
    expect(dmg([0.3, 3, 0.3]) / cube).toBeCloseTo(3, 5)
    expect(dmg([0.3, 80, 0.3]) / cube).toBeCloseTo(50, 5)
  })
})
