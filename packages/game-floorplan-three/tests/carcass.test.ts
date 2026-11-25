import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'
import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

describe('a bookcase stands as a carcass', () => {
  const made = () => furnitureSpec(THREE, 'bookcase', { catalog: defaultFurnitureCatalog(), document: fakeDocument })

  it('the sides carry, the shelves and the back need both ends, the back is not fixed to the floor', () => {
    const { spec } = made()
    const role = (id: string) => spec.parts.find((p) => p.id === id)?.structure?.role
    expect(role('wood_0')).toBe('column')
    expect(role('wood_1')).toBe('column')
    // the back carries nothing and is nailed to both sides: left on one, it tears off and falls (it does not stand as an L with that side)
    expect(role('wood_2')).toBe('beam')
    expect(spec.parts.find((p) => p.id === 'wood_2')?.anchored).toBeFalsy()
    const shelves = spec.parts.filter((p) => p.structure?.role === 'beam')
    expect(shelves.length).toBeGreaterThanOrEqual(5)
    for (const s of shelves) expect(s.structure!.maxSpan).toBeGreaterThan(1)
  })

  it('stands whole, and a broken side drops the shelves and the back it held, with their books', () => {
    const w = createDestruction()
    const id = w.add(made().spec, { id: 'shelf' })
    expect(w.state(id)!.groups.length).toBe(1)
    w.hit(id, { type: 'ballistic', point: [-0.6, 1, 0.2], direction: [0, 0, -1], energy: 400000, caliber: 12 })
    const groups = w.state(id)!.groups
    const standing = groups.find((g) => g.includes('wood_1'))!
    const shelves = made().spec.parts.filter((p) => p.structure?.role === 'beam' && !p.anchored).map((p) => p.id)
    for (const s of shelves) expect(standing).not.toContain(s)
    expect(standing).not.toContain('wood_2')
    const books = made().spec.parts.filter((p) => p.material === 'paper').map((p) => p.id)
    expect(books.filter((b) => standing.includes(b))).toEqual([])
  })
})
