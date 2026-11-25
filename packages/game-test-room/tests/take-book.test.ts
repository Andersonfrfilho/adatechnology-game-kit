import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { DestructibleSpec, Vec3 } from '@adatechnology/game-destruction'

import { buildFromSpec } from '../src'
import { makeRoom } from './helpers'

const AT: Vec3 = [-3.5, 0, 0]
const BOOK: Vec3 = [0, 1.02, 0.02]

/** A case of two sides and one shelf with one book on it, as the furniture of `game-floorplan-three` makes it: the book rests on the shelf and a hand takes it. */
const bookcaseSpec = (): DestructibleSpec => ({
  name: 'bookcase',
  tags: ['furniture'],
  parts: [
    { id: 'side_1', material: 'mdf', shape: { kind: 'box', size: [0.02, 1.6, 0.35] }, position: [-0.5, 0.8, 0], anchored: true, structure: { role: 'column' } },
    { id: 'side_2', material: 'mdf', shape: { kind: 'box', size: [0.02, 1.6, 0.35] }, position: [0.5, 0.8, 0], anchored: true, structure: { role: 'column' } },
    { id: 'shelf', material: 'mdf', shape: { kind: 'box', size: [0.98, 0.02, 0.35] }, position: [0, 0.9, 0], structure: { role: 'beam', maxSpan: 1.5 } },
    { id: 'book', material: 'paper', shape: { kind: 'box', size: [0.04, 0.22, 0.16] }, position: BOOK, hands: 1, tags: ['book'] },
  ],
  joints: [
    { a: 'shelf', b: 'side_1', kind: 'screw' },
    { a: 'shelf', b: 'side_2', kind: 'screw' },
    { a: 'book', b: 'shelf', kind: 'resting' },
  ],
})

describe('a book taken off a bookcase in the room', () => {
  it.each(['en', 'pt-BR'] as const)('is held with one hand and named a book (%s); the case is not said to come apart', (locale) => {
    const spec = bookcaseSpec()
    // drawn as furniture, as the kit's bookcase is: what is left of it when a part comes off becomes a loose piece (and would be said to come apart)
    const build = (): THREE.Object3D => markKitOrigin(buildFromSpec(THREE, spec), { owner: 'game-floorplan-three', kind: 'furniture', id: 'bookcase' })
    const room = makeRoom({ locale, scenery: { shelf: { spec, position: AT, build, free: true } } })
    const book: Vec3 = [AT[0] + BOOK[0], BOOK[1], AT[2] + BOOK[2]]
    room.look([book[0], book[1] + 0.3, book[2] + 0.8], book)

    expect(room.grab()).toBe(true)
    for (let frame = 0; frame < 10; frame++) room.update(1 / 60)

    const grabs = room.log.entries({ type: 'grab' })
    expect(grabs).toHaveLength(1)
    expect(grabs[0]?.text).toContain(locale === 'en' ? 'Book' : 'Livro')
    expect(grabs[0]?.data).toMatchObject({ hands: 1 })
    expect(room.log.entries({ type: 'loosened' })).toEqual([])
    expect(room.world.state('shelf')?.groups.flat()).not.toContain('book')
  })
})
