import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import { levelBoxesApart, type ContactShape } from '../src/piece-contacts'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const IDENTITY = new THREE.Matrix4().elements

const boxes = (...list: Array<[Vec3, Vec3]>): ContactShape => ({ kind: 'boxes', boxes: list.map(([c, half]) => ({ c, e: IDENTITY, half })) })

describe('a box between two parts of another goes apart by both', () => {
  it('between two boards closer than its thickness the ways out cancel: it is held there, not pushed from one board into the other', () => {
    // a 5.2 cm book, 3 mm off the middle between two 2 cm boards whose inner faces are 2 cm apart
    const book = boxes([[0.003, 0.12, 0], [0.026, 0.12, 0.13]])
    const caseBoards = boxes([[-0.02, 0.15, 0], [0.01, 0.15, 0.15]], [[0.02, 0.15, 0], [0.01, 0.15, 0.15]])
    const hit = levelBoxesApart(book, caseBoards)
    expect(hit).not.toBeNull()
    // 1.9 cm into the right board against 1.3 cm into the left one: what is left is their difference, back toward the middle
    expect(hit!.normal[0]).toBeCloseTo(-1, 6)
    expect(hit!.depth).toBeCloseTo(0.006, 6)
  })

  it('against two boards on the same side it needs the deeper, not both added', () => {
    const book = boxes([[0, 0.12, 0], [0.026, 0.12, 0.13]])
    const twoBoards = boxes([[-0.03, 0.05, 0], [0.01, 0.05, 0.15]], [[-0.025, 0.2, 0], [0.01, 0.05, 0.15]])
    const hit = levelBoxesApart(book, twoBoards)
    expect(hit!.normal[0]).toBeCloseTo(1, 6)
    expect(hit!.depth).toBeCloseTo(0.011, 6)
  })

  it('a book resting on a board is not pushed off it sideways: one on the other is its support', () => {
    expect(levelBoxesApart(boxes([[0, 0.05, 0], [0.1, 0.02, 0.1]]), boxes([[0, 0.015, 0], [0.3, 0.015, 0.2]]))).toBeNull()
  })
})

describe('a book wedged in a fallen case', () => {
  it('comes to rest and sleeps where it is held, instead of shaking from one board to the other', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
    // the case: a base and two uprights 1 cm apart inside
    world.addObject('case', [partState('base', 'wood', { mass: 6 }), partState('left', 'wood', { mass: 2 }), partState('right', 'wood', { mass: 2 })])
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3))
    base.position.y = 0.01
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.3))
    left.position.set(-0.015, 0.17, 0)
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.3))
    right.position.set(0.015, 0.17, 0)
    const caseRoot = new THREE.Group()
    caseRoot.add(base, left, right)
    scene.add(caseRoot)
    caseRoot.updateMatrixWorld(true)
    renderer.bind('case', caseRoot, { parts: { base, left, right } })
    const casePiece = renderer.makePiece('case')
    for (let t = 0; t < 1.5; t += 1 / 60) renderer.update(1 / 60)
    expect(casePiece.sleeping).toBe(true)
    // the book, 5.2 cm thick, stands on the base between the uprights (1 cm apart): in both of them
    world.addObject('book', [partState('body', 'paper', { mass: 1.5 })])
    const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.24, 0.26))
    const bookRoot = new THREE.Group()
    bookRoot.add(bookMesh)
    bookRoot.position.set(0.003, 0.141, 0)
    scene.add(bookRoot)
    bookRoot.updateMatrixWorld(true)
    renderer.bind('book', bookRoot, { parts: { body: bookMesh } })
    const book = renderer.makePiece('book')
    // it came down into the gap: awake, as a book that fell from its shelf
    renderer.impulse('book', [0, -0.3, 0])
    const sleptAtOnce = book.sleeping
    for (let t = 0; t < 1; t += 1 / 60) renderer.update(1 / 60)
    const sleptInASecond = book.sleeping
    let path = 0
    let last = book.root.position.clone()
    for (let t = 0; t < 1; t += 1 / 60) {
      renderer.update(1 / 60)
      path += book.root.position.distanceTo(last)
      last = book.root.position.clone()
    }
    expect(sleptAtOnce).toBe(false)
    expect(sleptInASecond).toBe(true)
    expect(book.sleeping).toBe(true)
    expect(path).toBeLessThan(0.001)
  })
})
