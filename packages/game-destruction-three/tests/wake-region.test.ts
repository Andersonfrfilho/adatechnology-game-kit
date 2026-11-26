import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

describe('the ground changes under what is asleep on it', () => {
  it('a sleeping piece falls to the new ground by itself, without being told', () => {
    let floor = 0
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt: () => floor })
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
    run(renderer, 2)
    expect(root.position.y).toBeLessThan(-0.3)
  })

  it('wakeRegion wakes what lies in the disc at once', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt: () => 0 })
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
    renderer.wakeRegion(100, 100, 1)
    expect(piece.sleeping).toBe(true)
    renderer.wakeRegion(2, 3, 1)
    expect(piece.sleeping).toBe(false)
  })

  it('a piece cut from a whole object (its root at the object origin, far away) wakes where it lies, and nothing stays above the crater dug under it', () => {
    const crater = { x: 6, z: -4, radius: 0.9, depth: 0.4 }
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - crater.x, z - crater.z) < crater.radius ? -crater.depth : 0)
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt })
    world.addObject('bin', [partState('body', 'plastic', { mass: 12 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5))
    // the house's lot draws its bin in the house's frame: the root is the house's origin, the bin 7 m from it
    mesh.position.set(crater.x, 0.45, crater.z)
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    renderer.bind('bin', root, { parts: { body: mesh } })
    const piece = renderer.makePiece('bin')
    run(renderer, 3)
    expect(piece.sleeping).toBe(true)
    // a disc over it with the ground still there (what it lay on was only touched) leaves it asleep
    renderer.wakeRegion(crater.x, crater.z, crater.radius)
    expect(piece.sleeping).toBe(true)
    dug = true
    renderer.wakeRegion(crater.x, crater.z, crater.radius)
    expect(piece.sleeping).toBe(false)
    run(renderer, 3)
    const bottom = new THREE.Box3().setFromObject(root).min.y
    expect(bottom, 'the bin rests on the crater floor, not on the ground that was there').toBeLessThan(-crater.depth + 0.05)
  })
})
