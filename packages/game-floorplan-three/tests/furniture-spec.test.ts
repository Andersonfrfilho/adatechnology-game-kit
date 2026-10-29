import { checkSpec } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

const make = (type: string, o: Parameters<typeof furnitureSpec>[2] = {}) => furnitureSpec(THREE, type, { document: fakeDocument, ...o })

describe('furnitureSpec', () => {
  it('turns the bookcase into boards, uprights and books at the size of the catalogue', () => {
    const f = make('bookcase')
    expect(f.size).toEqual({ w: 1.2, d: 0.35, h: 2 })
    const ids = f.spec.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const books = f.spec.parts.filter((p) => p.material === 'paper')
    expect(books.length).toBeGreaterThan(20)
    expect(f.spec.parts.filter((p) => p.material === 'wood_soft').length).toBeGreaterThanOrEqual(5)
    // the uprights touch the floor and stand; the books are loose and rest on a board
    expect(f.spec.parts.filter((p) => p.anchored).length).toBeGreaterThanOrEqual(2)
    expect(books.every((b) => !b.anchored)).toBe(true)
    const resting = f.spec.joints!.filter((j) => j.kind === 'resting')
    expect(resting.length).toBeGreaterThanOrEqual(books.length)
    expect(f.spec.joints!.some((j) => j.kind === 'resting' && books.some((b) => b.id === j.a) && books.some((b) => b.id === j.b))).toBe(false)
    const report = checkSpec(f.spec, { materials: createDestruction({ seed: 1 }).materials.keys() })
    expect(report.problems).toEqual([])
  })

  it('is deterministic per seed and the seed changes the books', () => {
    const a = make('bookcase', { seed: 3 })
    const b = make('bookcase', { seed: 3 })
    const c = make('bookcase', { seed: 4 })
    expect(JSON.stringify(a.spec)).toBe(JSON.stringify(b.spec))
    expect(JSON.stringify(a.spec)).not.toBe(JSON.stringify(c.spec))
  })

  it('draws a table with its top, four legs and no chairs on request, and tells where things rest', () => {
    const withChairs = make('dining_table', { w: 1.6, d: 0.8, h: 0.78 })
    const bare = make('dining_table', { w: 1.6, d: 0.8, h: 0.78, options: { chairs: false } })
    expect(bare.spec.parts.length).toBeLessThan(withChairs.spec.parts.length)
    expect(bare.spec.parts.filter((p) => p.anchored)).toHaveLength(4)
    expect(bare.top).toEqual({ part: expect.any(String), y: expect.closeTo(0.78, 3) })
    expect(bare.spec.parts.find((p) => p.id === bare.top!.part)!.material).toBe('wood_hard')
    expect(bare.spec.joints!.filter((j) => j.kind === 'screw').length).toBeGreaterThanOrEqual(4)
  })

  it('builds one mesh per part named by the part id', () => {
    const f = make('bookcase')
    const root = f.build(THREE)
    const names = new Set<string>()
    root.traverse((o: { isMesh?: boolean; name: string }) => o.isMesh && names.add(o.name))
    expect([...names].sort()).toEqual(f.spec.parts.map((p) => p.id).sort())
  })

  it('asks for a size when the type is not in the catalogue and refuses an unknown type', () => {
    expect(() => make('no_such_thing')).toThrow(/no builder/)
    expect(() => make('bookcase', { catalog: [] })).toThrow(/catalogue/)
    expect(make('bookcase', { catalog: [], w: 1, d: 0.3, h: 1.5 }).size.h).toBe(1.5)
  })
})
