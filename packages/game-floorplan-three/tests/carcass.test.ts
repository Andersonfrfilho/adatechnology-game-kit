import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'
import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

describe('a bookcase stands as a carcass', () => {
  const made = () => furnitureSpec(THREE, 'bookcase', { document: fakeDocument })

  it('the sides carry, the shelves need both ends, the back carries nothing', () => {
    const { spec } = made()
    const role = (id: string) => spec.parts.find((p) => p.id === id)?.structure?.role
    expect(role('wood_0')).toBe('column')
    expect(role('wood_1')).toBe('column')
    expect(role('wood_2')).toBeUndefined()
    const shelves = spec.parts.filter((p) => p.structure?.role === 'beam')
    expect(shelves.length).toBeGreaterThanOrEqual(4)
    for (const s of shelves) expect(s.structure!.maxSpan).toBeGreaterThan(1)
  })

  it('stands whole, and a broken side drops the shelves it held with their books', () => {
    const w = createDestruction()
    const id = w.add(made().spec, { id: 'shelf' })
    expect(w.state(id)!.groups.length).toBe(1)
    w.hit(id, { type: 'ballistic', point: [-0.6, 1, 0.2], direction: [0, 0, -1], energy: 400000, caliber: 12 })
    const groups = w.state(id)!.groups
    const standing = groups.find((g) => g.includes('wood_1'))!
    const shelves = made().spec.parts.filter((p) => p.structure?.role === 'beam' && !p.anchored).map((p) => p.id)
    for (const s of shelves) expect(standing).not.toContain(s)
    expect(standing).toContain('wood_2')
    const books = made().spec.parts.filter((p) => p.material === 'paper').map((p) => p.id)
    expect(books.filter((b) => standing.includes(b))).toEqual([])
  })
})
