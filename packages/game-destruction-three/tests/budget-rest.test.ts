import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer, SUGGESTED_MAX_AWAKE_PIECES } from '../src'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/**
 * `maxAwakePieces` keeps new pieces from waking, or puts the oldest at rest to sleep; it never keeps a piece that is at rest from sleeping. Jolt wakes a sleeper that touches an
 * awake body at every step, so 24 pieces at rest among sleepers that wake again each step never slept by themselves: the budget, which acts only over the count, left them.
 */
const crowd = (count: number) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), maxAwakePieces: SUGGESTED_MAX_AWAKE_PIECES })
  const pieces = []
  for (let i = 0; i < count; i++) {
    const id = `book${i}`
    world.addObject(id, [partState('body', 'paper', { mass: 0.5 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.15))
    const root = new THREE.Group()
    root.add(mesh)
    // a tight grid of books lying flat, touching each other's sides, dropped 1 cm
    root.position.set((i % 8) * 0.2, 0.015 + 0.01, Math.floor(i / 8) * 0.15)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    pieces.push(renderer.makePiece(id))
  }
  return { renderer, pieces }
}

describe('the awake budget never keeps a piece at rest from sleeping', () => {
  for (const count of [24, 40]) {
    it(`${count} books lying side by side with a budget of ${SUGGESTED_MAX_AWAKE_PIECES} awake all sleep once they are still`, () => {
      const { renderer, pieces } = crowd(count)
      for (let t = 0; t < 10; t += 1 / 60) renderer.update(1 / 60)
      expect(pieces.filter((piece) => !piece.sleeping).length).toBe(0)
    })
  }
})
