import * as THREE from 'three'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'

describe('a piece removed from the engine wakes what rested on it', () => {
  it('the box asleep on top of a removed box falls to the ground', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: world })
    const lowerRoot = new THREE.Object3D()
    lowerRoot.position.set(0, 0.25, 0)
    const lower = system.create('lower', lowerRoot, [0.25, 0.25, 0.25], new THREE.Vector3(), 4)
    const upperRoot = new THREE.Object3D()
    upperRoot.position.set(0, 0.6, 0)
    const upper = system.create('upper', upperRoot, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    for (let i = 0; i < 80; i++) system.update(0.05)
    expect(lower.sleeping).toBe(true)
    expect(upper.sleeping).toBe(true)
    expect(upperRoot.position.y).toBeGreaterThan(0.45)
    system.remove('lower')
    for (let i = 0; i < 20; i++) system.update(0.05)
    expect(upperRoot.position.y).toBeLessThan(0.15)
    world.dispose()
  })

  it('the box asleep on top falls too when the removed one was woken in the same frame', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
    const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: world })
    const lowerRoot = new THREE.Object3D()
    lowerRoot.position.set(0, 0.25, 0)
    const lower = system.create('lower', lowerRoot, [0.25, 0.25, 0.25], new THREE.Vector3(), 4)
    const upperRoot = new THREE.Object3D()
    upperRoot.position.set(0, 0.6, 0)
    const upper = system.create('upper', upperRoot, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    for (let i = 0; i < 80; i++) system.update(0.05)
    expect(lower.sleeping).toBe(true)
    expect(upper.sleeping).toBe(true)
    // woken and removed before the engine steps: the kit no longer calls it asleep, the box on it still is
    lower.sleeping = false
    system.remove('lower')
    for (let i = 0; i < 20; i++) system.update(0.05)
    expect(upperRoot.position.y).toBeLessThan(0.15)
    world.dispose()
  })
})
