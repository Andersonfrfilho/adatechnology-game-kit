import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionWorld } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { DestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import type { FurnitureSpecResult } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

interface Bookcase {
  readonly made: FurnitureSpecResult
  readonly world: DestructionWorld
  readonly renderer: DestructionRenderer
  readonly id: string
}

const STEP = 1 / 60

function standBookcase(): Bookcase {
  const made = furnitureSpec(THREE, 'bookcase', { catalog: defaultFurnitureCatalog(), document: fakeDocument })
  const scene = new THREE.Scene()
  const world = createDestruction({ seed: 3 })
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const id = world.add(made.spec, { id: 'bookcase' })
  const root = made.build(THREE)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root)
  return { made, world, renderer, id }
}

function run(bookcase: Bookcase, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) {
    bookcase.world.update(STEP)
    bookcase.renderer.update(STEP)
  }
}

const booksOf = (made: FurnitureSpecResult): string[] => made.spec.parts.filter((part) => part.material === 'paper').map((part) => part.id)

describe('the books of a bookcase are taken by hand, one at a time', () => {
  it('every book and box on the shelves is carried with one hand; the case itself is not taken by hand', () => {
    const made = furnitureSpec(THREE, 'bookcase', { catalog: defaultFurnitureCatalog(), document: fakeDocument })
    const books = made.spec.parts.filter((part) => part.material === 'paper')
    expect(books.length).toBeGreaterThan(10)
    expect(books.every((part) => part.hands === 1)).toBe(true)
    expect(made.spec.parts.filter((part) => part.material !== 'paper' && part.hands !== undefined)).toEqual([])
  })

  it('taking a book opens only what holds it: it leaves the shelf as a piece of its own and the other books stay put', () => {
    const bookcase = standBookcase()
    const books = booksOf(bookcase.made)
    const taken = books[Math.floor(books.length / 2)]!

    expect(bookcase.world.take(bookcase.id, taken)).toBe(1)
    run(bookcase, 3)

    const standing = bookcase.world.state(bookcase.id)!.groups.flat()
    expect(standing).not.toContain(taken)
    expect(books.filter((book) => book !== taken).every((book) => standing.includes(book))).toBe(true)
    const piece = bookcase.renderer.pieces().find((one) => bookcase.world.state(one.objectId)?.parts.map((part) => part.id).join() === taken)
    expect(piece).toBeDefined()
    // the case stands where it stood, upright: a book taken off it does not tip it
    const tilt = new THREE.Quaternion()
    bookcase.renderer.piece(bookcase.id)?.root.getWorldQuaternion(tilt)
    expect(tilt.angleTo(new THREE.Quaternion())).toBeLessThan(0.02)
  })

  it('a board, a side or a book already off the case is not taken again, and a board is never taken by hand', () => {
    const bookcase = standBookcase()
    const board = bookcase.made.spec.parts.find((part) => part.structure?.role === 'beam')!
    const book = booksOf(bookcase.made)[0]!

    expect(bookcase.world.take(bookcase.id, board.id)).toBeNull()
    expect(bookcase.world.take(bookcase.id, book)).toBe(1)
    expect(bookcase.world.take(bookcase.id, book)).toBeNull()
  })

  it('a book taken off falls on what is under it with the physics of paper and comes to rest there', () => {
    const bookcase = standBookcase()
    const books = booksOf(bookcase.made)
    const taken = books[books.length - 1]!
    bookcase.world.take(bookcase.id, taken)
    run(bookcase, 6)

    const piece = bookcase.renderer.pieces().find((one) => bookcase.world.state(one.objectId)?.parts.map((part) => part.id).join() === taken)!
    expect(piece.sleeping).toBe(true)
    expect(Math.hypot(...piece.velocity)).toBeLessThan(0.05)
  })
})
