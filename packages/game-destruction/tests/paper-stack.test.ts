import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

const book = { parts: [{ id: 'book', material: 'paper', shape: { kind: 'box' as const, size: [0.04, 0.24, 0.26] as [number, number, number] }, position: [0, 0, 0] as [number, number, number] }] }

const fracture = (events: DestructionEvent[]) => events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture')

describe('a stack of paper (a book)', () => {
  it('a rifle shot tears it into thin pages, mostly from the inside, not into slabs as thick as the book', () => {
    const w = createDestruction()
    const id = w.add(book)
    const r = w.hit(id, { type: 'ballistic', point: [0.02, 0, 0], direction: [-1, 0, 0], energy: 3000, caliber: 7.62 })
    const f = fracture(r.events)
    expect(f?.style).toBe('tear')
    expect(f!.fragments.length).toBeGreaterThan(8)
    for (const fr of f!.fragments) {
      expect(fr.shape).toBe('scrap')
      expect(Math.min(...fr.size)).toBeLessThanOrEqual(0.001)
    }
    const inner = f!.fragments.filter((fr) => fr.inner).length
    expect(inner).toBeGreaterThan(f!.fragments.length / 2)
    expect(inner).toBeLessThan(f!.fragments.length)
  })

  it('a single sheet still tears into scraps of its own thickness, with no pages', () => {
    const w = createDestruction()
    const id = w.add({ parts: [{ id: 'poster', material: 'paper', shape: { kind: 'box', size: [0.3, 0.4, 0.0005] }, position: [0, 0, 0] }] })
    const r = w.hit(id, { type: 'ballistic', point: [0, 0, 0.0003], direction: [0, 0, -1], energy: 3000, caliber: 7.62 })
    const f = fracture(r.events)
    expect(f?.style).toBe('tear')
    for (const fr of f!.fragments) {
      expect(fr.size[2]).toBeLessThanOrEqual(0.0005)
      expect(fr.inner).toBeUndefined()
    }
  })
})
