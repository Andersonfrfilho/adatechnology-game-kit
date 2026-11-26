import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const boxOf = (size: [number, number, number]): [number, number, number] => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  world.addObject('blade', [partState('body', 'plastic', { mass: 0.5 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(0, 1, 0)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('blade', root, { parts: { body: mesh } })
  return [...renderer.makePiece('blade').halfExtents]
}

describe('the box of a loose piece is the drawing, even a thin one', () => {
  it('a 2 cm laptop is a 2 cm box and a 9 mm phone a 9 mm one, not 4 cm slabs that sink into what they lie on', () => {
    expect(boxOf([0.33, 0.02, 0.23])).toEqual([expect.closeTo(0.165, 4), expect.closeTo(0.01, 4), expect.closeTo(0.115, 4)])
    expect(boxOf([0.075, 0.009, 0.15])[1]).toBeCloseTo(0.0045, 4)
  })

  it('a sheet thinner than a millimetre keeps a box of 2 mm: a face is not a plane', () => {
    expect(boxOf([1, 0.0002, 1])[1]).toBeCloseTo(0.001, 5)
  })
})
