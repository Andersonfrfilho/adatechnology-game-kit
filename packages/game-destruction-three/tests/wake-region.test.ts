import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

describe('the ground changes under what is asleep on it', () => {
  it('a sleeping piece stays where it was until it is told, then falls to the new ground', () => {
    let floor = 0
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt: () => floor })
    world.addObject('block', [partState('body', 'concrete', { mass: 60 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(2, 0.15, 3)
    scene.add(root)
    renderer.bind('block', root, { parts: { body: mesh } })
    const piece = renderer.makePiece('block')
    run(renderer, 3)
    expect(piece.sleeping).toBe(true)
    floor = -0.5
    run(renderer, 1)
    const hanging = root.position.y
    expect(hanging).toBeGreaterThan(0.1)
    renderer.wakeRegion(100, 100, 1)
    run(renderer, 0.5)
    expect(root.position.y).toBe(hanging)
    renderer.wakeRegion(2, 3, 1)
    run(renderer, 2)
    expect(root.position.y).toBeLessThan(-0.3)
  })
})
