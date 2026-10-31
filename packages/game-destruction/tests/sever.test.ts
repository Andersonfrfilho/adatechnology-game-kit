import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

const board = (size: [number, number, number], material = 'wood_soft') => ({ parts: [{ id: 'b', material, shape: { kind: 'box' as const, size }, position: [0, 0, 0] as [number, number, number] }] })
const fracture = (events: DestructionEvent[]) => events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture')
const shot = (y: number) => ({ type: 'ballistic' as const, point: [0, y, 0.05] as [number, number, number], direction: [0, 0, -1] as [number, number, number], energy: 527, caliber: 9 })

describe('a long wooden part breaks where it is hit', () => {
  it('shots in one place break a board across there: a stub each side and splinters between', () => {
    const w = createDestruction()
    const id = w.add(board([0.3, 2, 0.02]))
    let f: ReturnType<typeof fracture>
    let n = 0
    while (!f && n < 200) {
      f = fracture(w.hit(id, shot(0.45)).events)
      n++
    }
    expect(f).toBeDefined()
    // a thin board goes long before its whole hit points would
    expect(n).toBeLessThan(w.part(id, 'b')!.maxHp / 10)
    const slabs = f!.fragments.filter((x) => x.shape === 'slab')
    expect(slabs).toHaveLength(2)
    const ends = slabs.map((s) => [s.center[1] - s.size[1] / 2, s.center[1] + s.size[1] / 2]).sort((a, b) => a[0] - b[0])
    expect(ends[0][0]).toBeCloseTo(-1, 2)
    expect(ends[1][1]).toBeCloseTo(1, 2)
    // the gap between the stubs is where the shots went
    expect(ends[0][1]).toBeLessThanOrEqual(0.45)
    expect(ends[1][0]).toBeGreaterThanOrEqual(0.45)
    expect(f!.fragments.some((x) => x.shape === 'splinter' && Math.abs(x.center[1] - 0.45) < 0.1)).toBe(true)
  })

  it('a beam takes many times the shots of a board of the same length', () => {
    const count = (size: [number, number, number], material: string) => {
      const w = createDestruction()
      const id = w.add(board(size, material))
      for (let n = 1; n <= 2000; n++) if (fracture(w.hit(id, shot(0.45)).events)) return n
      return Infinity
    }
    const thin = count([0.3, 2, 0.02], 'wood_soft')
    const beam = count([0.15, 2, 0.15], 'wood_hard')
    expect(beam).toBeGreaterThan(thin * 5)
  })

  it('shots spread along the board do not add up in one place', () => {
    const w = createDestruction()
    const id = w.add(board([0.3, 2, 0.02]))
    let broke = false
    for (let k = 0; k < 18; k++) broke ||= !!fracture(w.hit(id, shot(-0.85 + k * 0.1)).events)
    expect(broke).toBe(false)
  })
})

describe('an MDF board also breaks where it is hit', () => {
  it('shots in one place snap it across there: a stub each side and crumbs between', () => {
    const w = createDestruction()
    const id = w.add(board([0.3, 2, 0.018], 'mdf'))
    let f: ReturnType<typeof fracture>
    for (let n = 0; !f && n < 200; n++) f = fracture(w.hit(id, shot(-0.5)).events)
    expect(f).toBeDefined()
    const slabs = f!.fragments.filter((x) => x.shape === 'slab')
    expect(slabs).toHaveLength(2)
    const ends = slabs.map((s) => [s.center[1] - s.size[1] / 2, s.center[1] + s.size[1] / 2]).sort((a, b) => a[0] - b[0])
    expect(ends[0][1]).toBeLessThanOrEqual(-0.5)
    expect(ends[1][0]).toBeGreaterThanOrEqual(-0.5)
    expect(f!.fragments.some((x) => x.shape === 'chunk' && Math.abs(x.center[1] + 0.5) < 0.1)).toBe(true)
  })
})
