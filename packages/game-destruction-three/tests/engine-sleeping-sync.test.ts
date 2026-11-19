import * as THREE from 'three'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import type { PhysicsWorld } from '@adatechnology/game-physics'

import { PieceSystem } from '../src/pieces'

// What the host does to a piece that is asleep on both sides must reach the engine as it did when every piece was synced every update (spec 010 T2.3).
const setup = async () => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
  const calls: string[] = []
  const counted: PhysicsWorld = Object.create(world) as PhysicsWorld
  const names = ['setShape', 'setMaterial', 'setRolling', 'setPose', 'wake'] as const
  for (const name of names) {
    const original = (world[name] as (...a: unknown[]) => unknown).bind(world)
    ;(counted as unknown as Record<string, unknown>)[name] = (...a: unknown[]) => {
      calls.push(name)
      return original(...a)
    }
  }
  const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: counted })
  const root = new THREE.Object3D()
  root.position.set(0, 0.1, 0)
  const box = system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
  for (let i = 0; i < 40; i++) system.update(0.05)
  expect(box.sleeping).toBe(true)
  for (let i = 0; i < 10; i++) system.update(0.05)
  calls.length = 0
  return { world, system, root, box, calls }
}

describe('a piece asleep on both sides still takes what the host changes (spec 010 T2.3)', () => {
  it('a root the host moved is set in the engine, without waking it, as when every piece was synced', async () => {
    const { world, system, root, box, calls } = await setup()
    root.position.x = 1
    system.update(0.05)
    expect(calls).toEqual(['setPose'])
    expect(box.sleeping).toBe(true)
    for (let i = 0; i < 10; i++) system.update(0.05)
    expect(root.position.x).toBeCloseTo(1, 3)
    world.dispose()
  })

  it('a shape source that changed (a smaller box, a new surface) is set in the engine, as when every piece was synced', async () => {
    const { world, system, box, calls } = await setup()
    box.halfExtents = [0.1, 0.05, 0.1]
    box.mass = 1
    box.friction = { static: 0.3, dynamic: 0.2, rolling: 0.01 }
    system.update(0.05)
    expect(calls).toEqual(['setShape', 'setMaterial', 'setRolling'])
    world.dispose()
  })
})
