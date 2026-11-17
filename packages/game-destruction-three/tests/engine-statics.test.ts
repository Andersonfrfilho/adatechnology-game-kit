import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import type { StaticSolid } from '../src/engine-pieces'
import { PieceSystem } from '../src/pieces'

const solid = (center: [number, number, number], half: [number, number, number]): StaticSolid => ({ center, half, rotation: [0, 0, 0, 1] })

describe("a fixed object's boxes changing in the engine", () => {
  it('a part whose material changed (its friction only) keeps its body and takes the new friction', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120 })
    const materials: Array<{ readonly frictionStatic: number }> = []
    const counted: PhysicsWorld = Object.create(world) as PhysicsWorld
    counted.setMaterial = (...a: Parameters<PhysicsWorld['setMaterial']>) => {
      materials.push(a[1])
      world.setMaterial(...a)
    }
    const floor = (fs: number): StaticSolid => ({ ...solid([0, 0.25, 0], [2, 0.25, 2]), friction: { static: fs, dynamic: fs * 0.8, rolling: 0.01 } })
    let boxes: StaticSolid[] = [floor(0.6)]
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: counted, staticSolids: () => new Map([['house', boxes]]) })
    system.update(0.05)
    const bodies = world.bodyCount
    boxes = [floor(0.6)]
    system.update(0.05)
    expect(materials).toHaveLength(0)
    boxes = [floor(0.2)]
    system.update(0.05)
    expect(world.bodyCount).toBe(bodies)
    expect(materials.map((m) => m.frictionStatic)).toEqual([0.2])
    world.dispose()
  })

  it('one of its boxes changing every update keeps its body and wakes only what was near that box, not what lies on its others', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
    let made = 0
    let removed = 0
    const counted: PhysicsWorld = Object.create(world) as PhysicsWorld
    counted.createBody = (...a: Parameters<PhysicsWorld['createBody']>) => {
      made++
      return world.createBody(...a)
    }
    counted.removeBody = (...a: Parameters<PhysicsWorld['removeBody']>) => {
      removed++
      world.removeBody(...a)
    }
    // a house: a slab the piece lies on, and a water tank 10 m off whose drawn box changes every update (it leaks: the room's single_storey_a after a blast)
    const slab = solid([0, 0.25, 0], [2, 0.25, 2])
    let tank = solid([10, 0.5, 0], [0.5, 0.4, 0.5])
    let boxes: StaticSolid[] = [slab, tank]
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: counted, staticSolids: () => new Map([['house', boxes]]) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.6, 0)
    const piece = system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 40; i++) system.update(0.05)
    expect(piece.sleeping).toBe(true)
    expect(root.position.y).toBeCloseTo(0.6, 1)
    made = 0
    removed = 0
    let woke = 0
    for (let i = 0; i < 20; i++) {
      tank = solid([10, 0.5 - i * 0.004, 0], [0.5 + i * 0.003, 0.4 - i * 0.004, 0.5 + i * 0.003])
      // a new list each update, the slab equal by value (measured again, as the renderer does)
      boxes = [solid([0, 0.25, 0], [2, 0.25, 2]), tank]
      system.update(0.05)
      if (!piece.sleeping) woke++
    }
    expect(woke).toBe(0)
    // the same body, its shape changed in place
    expect(made).toBe(0)
    expect(removed).toBe(0)
    // the slab itself moving down wakes the piece on it
    boxes = [solid([0, 0.2, 0], [2, 0.25, 2]), tank]
    system.update(0.05)
    expect(piece.sleeping).toBe(false)
    for (let i = 0; i < 60; i++) system.update(0.05)
    expect(piece.sleeping).toBe(true)
    expect(root.position.y).toBeCloseTo(0.55, 1)
    world.dispose()
  })
})
