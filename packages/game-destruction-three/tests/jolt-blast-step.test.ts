import * as THREE from 'three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { afterEach, describe, expect, it } from 'vitest'

import type { PieceBody } from '../src/internal'
import { PieceSystem } from '../src/pieces'

// debris of a blast that has come to rest sleeps in the engine too, so the step stops paying for it; counted, never timed (the time is the perf gate's, §9)
const engine = await createJoltEngine()
const worlds: PhysicsWorld[] = []
const FRAME = 1 / 60

interface Counted {
  readonly world: PhysicsWorld
  readonly loop: PhysicsLoop
  readonly system: PieceSystem
  /** Bodies read back (`readPose` + `readVelocity`) in the last frame. */
  readonly reads: () => number
}

const countedScene = (): Counted => {
  const world = engine.createWorld({ ...KIT_WORLD })
  worlds.push(world)
  let reads = 0
  // counted on the world itself: a wrapper made with Object.create takes the engine's own writes to `this` and steps another world than the one asked
  const readPose = world.readPose.bind(world)
  const readVelocity = world.readVelocity.bind(world)
  world.readPose = (...args: Parameters<PhysicsWorld['readPose']>): void => {
    reads++
    readPose(...args)
  }
  world.readVelocity = (...args: Parameters<PhysicsWorld['readVelocity']>): void => {
    reads++
    readVelocity(...args)
  }
  const loop = createPhysicsLoop(world)
  const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: loop })
  let last = 0
  const frame = system.update.bind(system)
  system.update = (dt: number): void => {
    reads = 0
    frame(dt)
    last = reads
  }
  return { world, loop, system, reads: () => last }
}

const run = (scene: Counted, frames: number, each?: () => void): void => {
  for (let f = 0; f < frames; f++) {
    scene.loop.step(FRAME)
    scene.system.update(FRAME)
    each?.()
  }
}

/** Twelve chunks blown off a wall: a pile three wide, two deep and two high, each thrown out and up at a fixed speed. */
const blastPile = (system: PieceSystem): PieceBody[] => {
  const pieces: PieceBody[] = []
  for (let i = 0; i < 12; i++) {
    const col = i % 3
    const row = Math.floor(i / 3) % 2
    const layer = Math.floor(i / 6)
    const root = new THREE.Object3D()
    root.position.set(col * 0.2 - 0.2, 0.1 + layer * 0.2, row * 0.2 - 0.1)
    root.updateMatrixWorld(true)
    const piece = system.create(`debris_${i}`, root, [0.08, 0.08, 0.08], new THREE.Vector3(), 2.5)
    piece.velocity[0] = (col - 1) * 1.5
    piece.velocity[1] = 2 + (i % 4) * 0.15
    piece.velocity[2] = (row - 0.5) * 1.5
    pieces.push(piece)
  }
  return pieces
}

afterEach(() => {
  for (const world of worlds.splice(0)) world.dispose()
})

describe('blast debris at rest costs the engine nothing', () => {
  // touching chunks sleep together: put to sleep one by one, each was woken by its still-awake neighbour and the two took turns for good
  it('a pile of blast debris comes to rest, sleeps on both sides and is no longer read back', () => {
    const scene = countedScene()
    const pieces = blastPile(scene.system)
    let mostAwake = 0
    run(scene, 30, () => {
      mostAwake = Math.max(mostAwake, scene.world.activeCount)
    })
    expect(mostAwake).toBe(pieces.length)
    run(scene, 150)
    expect(pieces.filter((p) => !p.sleeping).map((p) => p.objectId)).toEqual([])
    expect(scene.world.activeCount).toBe(0)
    run(scene, 10)
    expect(scene.reads()).toBe(0)
  })

  it('two pieces resting side by side, touching, sleep and stop being read back', () => {
    const scene = countedScene()
    const rootA = new THREE.Object3D()
    rootA.position.set(0, 0.05, 0)
    rootA.updateMatrixWorld(true)
    const a = scene.system.create('boxA', rootA, [0.1, 0.05, 0.1], new THREE.Vector3(), 5)
    const rootB = new THREE.Object3D()
    rootB.position.set(0.201, 0.05, 0)
    rootB.updateMatrixWorld(true)
    const b = scene.system.create('boxB', rootB, [0.1, 0.05, 0.1], new THREE.Vector3(), 5)
    run(scene, 90)
    expect(a.sleeping).toBe(true)
    expect(b.sleeping).toBe(true)
    expect(scene.world.activeCount).toBe(0)
    run(scene, 10)
    expect(scene.reads()).toBe(0)
  })
})
