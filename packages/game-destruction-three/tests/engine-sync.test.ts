import * as THREE from 'three'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'

describe('the seam brings a body up to date only with what changed', () => {
  it('a piece handed new arrays with the same boxes keeps its shape; a new box changes it, with its mass; a piece asleep is not read back', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
    let shapes = 0
    let poses = 0
    const counted: PhysicsWorld = Object.create(world) as PhysicsWorld
    counted.setShape = (...a: Parameters<PhysicsWorld['setShape']>) => {
      shapes++
      world.setShape(...a)
    }
    counted.readPose = (...a: Parameters<PhysicsWorld['readPose']>) => {
      poses++
      world.readPose(...a)
    }
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: counted })
    const root = new THREE.Object3D()
    root.position.set(0, 0.1, 0)
    const box = system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 40; i++) system.update(0.05)
    expect(box.sleeping).toBe(true)
    // asleep on both sides: nothing is read back
    poses = 0
    for (let i = 0; i < 10; i++) system.update(0.05)
    expect(poses).toBe(0)
    // measured again to the same numbers (new arrays): the same shape
    box.halfExtents = [0.1, 0.1, 0.1]
    system.update(0.05)
    expect(shapes).toBe(0)
    // a smaller box: a new shape, and the kit's mass with it
    box.halfExtents = [0.1, 0.05, 0.1]
    box.mass = 1
    system.update(0.05)
    expect(shapes).toBe(1)
    world.dispose()
  })
})
