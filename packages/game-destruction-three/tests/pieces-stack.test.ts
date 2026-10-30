import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { FakeWorld, partState } from './fake-world'

const setup = () => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  const box = (id: string, size: [number, number, number], at: [number, number, number]) => {
    world.addObject(id, [partState('body', 'wood', { mass: 2 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...at)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    return root
  }
  const run = (s: number) => {
    for (let t = 0; t < s; t += 1 / 60) renderer.update(1 / 60)
  }
  return { renderer, box, run }
}

const bottom = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(o).min.y
}

describe('pieces land on what is under them', () => {
  it('a board dropped over a fixed shelf rests on top of it instead of passing through', () => {
    const { renderer, box, run } = setup()
    box('shelf', [0.8, 0.02, 0.3], [0, 0.5, 0])
    const board = box('board', [0.6, 0.02, 0.25], [0, 0.9, 0])
    renderer.makePiece('board')
    run(3)
    expect(bottom(board)).toBeGreaterThan(0.49)
    expect(bottom(board)).toBeLessThan(0.56)
  })

  it('a board dropped over a loose book lands on the book', () => {
    const { renderer, box, run } = setup()
    const book = box('book', [0.3, 0.2, 0.2], [0, 0.1, 0])
    renderer.makePiece('book')
    run(1)
    const board = box('board', [0.25, 0.02, 0.15], [0, 0.7, 0])
    renderer.makePiece('board')
    run(3)
    expect(bottom(board)).toBeGreaterThan(new THREE.Box3().setFromObject(book).max.y - 0.03)
  })

  it('beside the shelf the board still falls to the ground', () => {
    const { renderer, box, run } = setup()
    box('shelf', [0.4, 0.02, 0.3], [2, 0.5, 0])
    const board = box('board', [0.3, 0.02, 0.2], [0, 0.9, 0])
    renderer.makePiece('board')
    run(3)
    expect(bottom(board)).toBeLessThan(0.03)
  })
})

describe('solidsNear', () => {
  it('gives the boxes of fixed objects and pieces around a point, with the piece', () => {
    const { renderer, box, run } = setup()
    box('shelf', [0.8, 0.02, 0.3], [0, 0.5, 0])
    box('book', [0.2, 0.04, 0.15], [0.3, 0.02, 1])
    const book = renderer.makePiece('book')
    run(0.5)
    const near = renderer.solidsNear(0.3, 1.2, 0.3)
    expect(near.map((s) => s.objectId)).toEqual(['book'])
    expect(near[0]!.piece).toBe(book)
    expect(near[0]!.max[1]).toBeLessThan(0.06)
    expect(renderer.solidsNear(0, 0, 0.1).map((s) => [s.objectId, s.piece])).toEqual([['shelf', null]])
    expect(renderer.solidsNear(5, 5, 0.3)).toEqual([])
  })
})

describe('furniture that came apart', () => {
  it('what stayed standing is loose too: a lone leg topples and ends lower than a step', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('table', [partState('leg', 'wood', { mass: 1.4 }), partState('board', 'wood', { mass: 4 })], [['leg'], ['board']])
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
    leg.position.y = 0.37
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.16))
    board.position.y = 0.76
    const root = new THREE.Group()
    root.add(leg, board)
    markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'table' })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('table', root, { parts: { leg, board } })
    world.emit({ type: 'detach', object: 'table', joint: 'j', parts: ['leg', 'board'] })
    for (let t = 0; t < 6; t += 1 / 60) renderer.update(1 / 60)
    expect(renderer.piece('table')).not.toBeNull()
    expect(new THREE.Box3().setFromObject(leg).max.y).toBeLessThan(0.2)
  })

  it('a board on two legs in a line falls over too', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('table', [partState('frame', 'wood', { mass: 18 }), partState('other', 'wood', { mass: 1 })], [['frame'], ['other']])
    const legs = [-0.7, 0.7].map((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
      leg.position.set(x, 0.37, 0)
      return leg
    })
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.16))
    board.position.y = 0.76
    const other = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.1))
    other.position.set(0, 0.02, 2)
    const root = new THREE.Group()
    root.add(...legs, board, other)
    markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'table' })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('table', root, { parts: { frame: [...legs, board], other } })
    world.emit({ type: 'detach', object: 'table', joint: 'j', parts: ['frame', 'other'] })
    for (let t = 0; t < 6; t += 1 / 60) renderer.update(1 / 60)
    expect(new THREE.Box3().setFromObject(board).max.y).toBeLessThan(0.45)
  })

  it('a fixed object that is not furniture keeps standing', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('post', [partState('leg', 'wood', { mass: 1.4 }), partState('sign', 'wood', { mass: 4 })], [['leg'], ['sign']])
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16))
    const root = new THREE.Group()
    root.add(leg, sign)
    scene.add(root)
    renderer.bind('post', root, { parts: { leg, sign } })
    world.emit({ type: 'detach', object: 'post', joint: 'j', parts: ['leg', 'sign'] })
    renderer.update(1 / 60)
    expect(renderer.piece('post')).toBeNull()
  })
})
