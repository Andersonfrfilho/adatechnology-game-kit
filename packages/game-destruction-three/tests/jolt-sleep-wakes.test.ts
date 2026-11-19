import * as THREE from 'three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, PhysicsLoop, PhysicsWorld, Quat, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { afterEach, describe, expect, it } from 'vitest'

import type { PieceBody } from '../src/internal'
import { PieceSystem } from '../src/pieces'

// putting a resting piece to sleep in the engine must not change what the physics does: whatever touches it, hits it or takes its support away wakes it
const engine = await createJoltEngine()
const worlds: PhysicsWorld[] = []
const FRAME = 1 / 60

interface Scene {
  readonly world: PhysicsWorld
  readonly loop: PhysicsLoop
  readonly system: PieceSystem
}

const makeScene = (): Scene => {
  const world = engine.createWorld({ ...KIT_WORLD })
  worlds.push(world)
  const loop = createPhysicsLoop(world)
  const system = new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: loop })
  return { world, loop, system }
}

const run = (scene: Scene, frames: number, each?: (frame: number) => void): void => {
  for (let f = 0; f < frames; f++) {
    each?.(f)
    scene.loop.step(FRAME)
    scene.system.update(FRAME)
  }
}

interface BoxParams {
  readonly id: string
  readonly at: Vec3
  readonly half: [number, number, number]
  readonly mass: number
  readonly rotation?: THREE.Quaternion
}

const box = (scene: Scene, p: BoxParams): PieceBody => {
  const root = new THREE.Object3D()
  root.position.set(p.at[0], p.at[1], p.at[2])
  if (p.rotation) root.quaternion.copy(p.rotation)
  root.updateMatrixWorld(true)
  return scene.system.create(p.id, root, p.half, new THREE.Vector3(), p.mass)
}

const centre = (b: PieceBody): THREE.Vector3 => b.root.position.clone()

afterEach(() => {
  for (const world of worlds.splice(0)) world.dispose()
})

describe('a piece the engine put to sleep wakes as the physics asks', () => {
  it.each([1.2, 0.08])('a box asleep on another box wakes and goes along when the lower one is pushed away at %f m/s', (speed) => {
    const scene = makeScene()
    const lower = box(scene, { id: 'lower', at: [0, 0.1, 0], half: [0.4, 0.1, 0.4], mass: 6 })
    const upper = box(scene, { id: 'upper', at: [0, 0.3, 0], half: [0.1, 0.1, 0.1], mass: 1 })
    run(scene, 150)
    expect(lower.sleeping).toBe(true)
    expect(upper.sleeping).toBe(true)
    const upperBefore = centre(upper)
    const lowerBefore = centre(lower)
    // shoved along the floor at a steady speed, as a car or a door drags it: the box on top rides along on its friction; a slow shove stays under what reads
    // as still (`STILL_SPEED`) the whole way, and the box on top must not be left asleep while what holds it moves
    const pusher = scene.world.createBody({ shape: { kind: 'box', half: [0.05, 0.08, 0.5] }, motion: 'kinematic', position: [-0.46, 0.1, 0], user: 0 })
    let x = -0.46
    const frames = Math.ceil(0.8 / speed / FRAME)
    run(scene, frames, () => {
      x += speed * FRAME
      scene.world.moveKinematic(pusher, [x, 0.1, 0], [0, 0, 0, 1], FRAME)
    })
    const lowerMoved = centre(lower).x - lowerBefore.x
    const upperMoved = centre(upper).x - upperBefore.x
    expect(lowerMoved).toBeGreaterThan(0.6)
    expect(upperMoved).toBeGreaterThan(lowerMoved * 0.7)
    expect(centre(upper).y).toBeGreaterThan(0.25)
  })

  it.each([36, 37, 40, 50])('a box on a %i degree ramp, steep enough to slide, does not sleep on the way and reaches the foot', (degrees) => {
    const scene = makeScene()
    const slope = (degrees * Math.PI) / 180
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -slope)
    const rampHalf: Vec3 = [1.5, 0.05, 0.6]
    // the ramp's top face goes down towards +x; its lower end sits on the floor at x = cos(slope) * 1.5
    const rampCentre: Vec3 = [0, Math.sin(slope) * rampHalf[0], 0]
    scene.world.createBody({
      shape: { kind: 'box', half: rampHalf },
      motion: 'static',
      position: rampCentre,
      rotation: [tilt.x, tilt.y, tilt.z, tilt.w] as Quat,
      user: 0,
    })
    const down = tilt
    const normal = new THREE.Vector3(Math.sin(slope), Math.cos(slope), 0)
    const along = new THREE.Vector3(-Math.cos(slope), Math.sin(slope), 0)
    const start = new THREE.Vector3(...rampCentre).addScaledVector(along, 1.1).addScaledVector(normal, rampHalf[1] + 0.1 + 0.002)
    const crate = box(scene, { id: 'crate', at: [start.x, start.y, start.z], half: [0.1, 0.1, 0.1], mass: 2, rotation: down })
    let sleptOnRamp = false
    run(scene, 400, () => {
      if (crate.sleeping && centre(crate).x < Math.cos(slope) * rampHalf[0] - 0.2) sleptOnRamp = true
    })
    expect(sleptOnRamp).toBe(false)
    expect(centre(crate).x).toBeGreaterThan(Math.cos(slope) * rampHalf[0])
    expect(centre(crate).y).toBeLessThan(0.2)
  })

  it('a piece asleep that is shot or caught by a blast wakes and moves', () => {
    const scene = makeScene()
    const shot = box(scene, { id: 'shot', at: [0, 0.1, 0], half: [0.1, 0.1, 0.1], mass: 1 })
    const blasted = box(scene, { id: 'blasted', at: [2, 0.1, 0], half: [0.1, 0.1, 0.1], mass: 1 })
    run(scene, 150)
    expect(shot.sleeping).toBe(true)
    expect(blasted.sleeping).toBe(true)
    const shotBefore = centre(shot)
    const blastedBefore = centre(blasted)
    // the game's way for both: the renderer hands the piece an impulse at the point hit (`impulse`), a blast wakes its reach first (`wakeRegion`)
    scene.system.impulse(shot, [2.5, 0.5, 0], [-0.1, 0.12, 0])
    scene.system.wakeRegion(2, 0, 1.5)
    scene.system.impulse(blasted, [0, 4, 3], [2, 0.05, -0.1])
    run(scene, 30)
    expect(centre(shot).distanceTo(shotBefore)).toBeGreaterThan(0.3)
    expect(centre(blasted).distanceTo(blastedBefore)).toBeGreaterThan(0.3)
  })

  it('debris asleep is woken by another piece of debris flying into it', () => {
    const scene = makeScene()
    const target = box(scene, { id: 'target', at: [0, 0.1, 0], half: [0.1, 0.1, 0.1], mass: 1 })
    run(scene, 150)
    expect(target.sleeping).toBe(true)
    const before = centre(target)
    const bullet = box(scene, { id: 'bullet', at: [-1.2, 0.1, 0], half: [0.1, 0.1, 0.1], mass: 3 })
    scene.system.impulse(bullet, [18, 0, 0])
    run(scene, 60)
    expect(centre(target).x - before.x).toBeGreaterThan(0.2)
  })

  it('debris asleep is pushed away by a body walking through it as the player does', () => {
    const scene = makeScene()
    const target = box(scene, { id: 'target', at: [0, 0.1, 0], half: [0.1, 0.1, 0.1], mass: 1 })
    run(scene, 150)
    expect(target.sleeping).toBe(true)
    const before = centre(target)
    const walker: BodyId = scene.world.createBody({ shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 }, motion: 'kinematic', position: [-1, 0.8, 0], user: 0 })
    let x = -1
    run(scene, 90, () => {
      x += 1.5 * FRAME
      scene.world.moveKinematic(walker, [x, 0.8, 0], [0, 0, 0, 1], FRAME)
    })
    expect(centre(target).x - before.x).toBeGreaterThan(0.2)
  })
})
