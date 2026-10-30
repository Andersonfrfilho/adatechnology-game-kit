import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

describe('a toppled bookcase spills its books', () => {
  it('pushed over, the books leave the case as pieces of their own and land apart from it', () => {
    const made = furnitureSpec(THREE, 'bookcase', { document: fakeDocument })
    const books = made.spec.parts.filter((part) => part.material === 'paper').map((part) => part.id)
    const scene = new THREE.Scene()
    const world = createDestruction()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const id = world.add(made.spec, { id: 'bookcase' })
    const root = made.build(THREE)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root)
    renderer.makePiece(id, { mass: 242 })
    renderer.impulse(id, [0, 0, 160], [0, 1.8, 0])
    for (let t = 0; t < 4; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
    }

    const standing = world.state(id)!.groups.flat()
    expect(books.filter((book) => standing.includes(book))).toEqual([])
    const loose = renderer.pieces().filter((piece) => piece.objectId !== id)
    expect(loose.length).toBeGreaterThanOrEqual(books.length)
  })

  it('once on the floor, every book and the case come to rest instead of trembling where they lie', () => {
    const made = furnitureSpec(THREE, 'bookcase', { document: fakeDocument })
    const scene = new THREE.Scene()
    const world = createDestruction()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const id = world.add(made.spec, { id: 'bookcase' })
    const root = made.build(THREE)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root)
    renderer.makePiece(id, { mass: 242 })
    renderer.impulse(id, [0, 0, 160], [0, 1.8, 0])
    for (let t = 0; t < 12; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
    }

    expect(renderer.pieces().filter((piece) => !piece.sleeping).map((piece) => piece.objectId)).toEqual([])
  })
})
