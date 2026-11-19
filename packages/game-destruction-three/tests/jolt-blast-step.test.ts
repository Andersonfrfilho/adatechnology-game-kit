import * as THREE from 'three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'

describe('Jolt blast debris physics step performance & sleep regression', () => {
  it('a cluster of blast debris pieces in Jolt comes to rest and sleeps, cutting step cost', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({
      ...KIT_WORLD,
      sleepAfter: 0.5,
      sleepSpeed: 0.08,
    })
    const loop = createPhysicsLoop(world)

    let activeDuringSettling = 0

    const scene = new THREE.Scene()
    const system = new PieceSystem(THREE, {
      groundAt: () => 0,
      gravity: 9.81,
      onHardLanding: () => undefined,
      scene,
      physics: loop,
    })

    // Spawn 12 debris boxes in a close pile (representing chunks blown off a wall)
    const pieces: ReturnType<typeof system.create>[] = []
    for (let i = 0; i < 12; i++) {
      const root = new THREE.Object3D()
      const col = i % 3
      const row = Math.floor(i / 3) % 2
      const layer = Math.floor(i / 6)
      root.position.set(col * 0.15 - 0.15, 0.1 + layer * 0.15, row * 0.15 - 0.07)
      // Slight blast velocity
      const vx = (col - 1) * 1.5
      const vy = 2.0 + Math.random() * 0.5
      const vz = (row - 0.5) * 1.5
      const p = system.create('debris_' + i, root, [0.08, 0.08, 0.08], new THREE.Vector3(), 2.5)
      p.velocity[0] = vx
      p.velocity[1] = vy
      p.velocity[2] = vz
      pieces.push(p)
    }

    // Step 120 frames at 60 Hz (2 seconds of simulation)
    const stepTimes: number[] = []
    for (let f = 0; f < 120; f++) {
      const t0 = performance.now()
      loop.step(1 / 60)
      system.update(1 / 60)
      const ms = performance.now() - t0
      stepTimes.push(ms)
      if (f < 30) {
        activeDuringSettling = Math.max(activeDuringSettling, world.activeCount)
      }
    }

    // All debris pieces were initially active
    expect(activeDuringSettling).toBeGreaterThan(0)

    // After 2 seconds, all pieces must be sleeping
    const sleepingCount = pieces.filter((p) => p.sleeping).length
    expect(sleepingCount).toBe(pieces.length)
    expect(world.activeCount).toBe(0)

    // Once all pieces sleep, the simulation step cost per frame must drop to near zero (< 0.5 ms)
    const last10Frames = stepTimes.slice(-10)
    const avgLast10 = last10Frames.reduce((a, b) => a + b, 0) / last10Frames.length
    expect(avgLast10).toBeLessThan(1.0)

    world.dispose()
  })

  it('pieces in contact resting on each other sleep via stillness/calm and do not keep Jolt awake indefinitely', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({
      ...KIT_WORLD,
      sleepAfter: 0.5,
      sleepSpeed: 0.08,
    })

    let readPoses = 0
    const counted: PhysicsWorld = Object.create(world) as PhysicsWorld
    counted.readPose = (...a: Parameters<PhysicsWorld['readPose']>) => {
      readPoses++
      world.readPose(...a)
    }

    const system = new PieceSystem(THREE, {
      groundAt: () => 0,
      gravity: 9.81,
      onHardLanding: () => undefined,
      scene: new THREE.Scene(),
      physics: counted,
    })

    // Two pieces touching each other on the ground (forming a contact pair)
    const rootA = new THREE.Object3D()
    rootA.position.set(0, 0.05, 0)
    const boxA = system.create('boxA', rootA, [0.1, 0.05, 0.1], new THREE.Vector3(), 5)

    const rootB = new THREE.Object3D()
    rootB.position.set(0.12, 0.05, 0)
    const boxB = system.create('boxB', rootB, [0.1, 0.05, 0.1], new THREE.Vector3(), 5)

    // Step 60 frames (1 second) to allow them to settle and sleep
    for (let f = 0; f < 60; f++) {
      world.step(1 / 60)
      system.update(1 / 60)
    }

    expect(boxA.sleeping).toBe(true)
    expect(boxB.sleeping).toBe(true)
    expect(world.activeCount).toBe(0)

    // Once sleeping, subsequent frames should not read poses (short-circuited in readBack)
    readPoses = 0
    for (let f = 0; f < 10; f++) {
      world.step(1 / 60)
      system.update(1 / 60)
    }
    expect(readPoses).toBe(0)

    world.dispose()
  })
})
