import * as THREE from 'three'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'
import { PieceSystem } from '../src/pieces'
import { PoseTrail } from '../src/pose-trail'

const objectAt = (x: number, turn: number): THREE.Object3D => {
  const object = new THREE.Object3D()
  object.position.set(x, 1, -x)
  object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn)
  return object
}

const poseOf = (object: THREE.Object3D): number[] => [...object.position.toArray(), ...object.quaternion.toArray()]

describe('pose trail', () => {
  it('alpha 0 draws the previous pose, 1 the step pose to the bit, and the middle lies between', () => {
    const trail = new PoseTrail()
    const object = objectAt(0, 0)
    trail.begin()
    trail.record(object)
    object.position.set(2, 3, 4)
    object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1)
    const step = poseOf(object)
    trail.commit()

    trail.blend(0)
    expect(object.position.toArray()).toEqual([0, 1, -0])
    expect(object.position.x).toBe(0)
    expect(object.quaternion.w).toBeCloseTo(1, 12)
    trail.blend(0.5)
    expect(object.position.x).toBe(1)
    const half = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5)
    expect(object.quaternion.angleTo(half)).toBeLessThan(1e-6)
    expect(object.quaternion.length()).toBeCloseTo(1, 12)
    trail.blend(1)
    expect(poseOf(object)).toEqual(step)
    trail.blend(7)
    expect(poseOf(object)).toEqual(step)
  })

  it('restore gives the step pose back with the matrices, and begin restores first', () => {
    const trail = new PoseTrail()
    const parent = new THREE.Object3D()
    const object = objectAt(0, 0)
    parent.add(object)
    trail.begin()
    trail.record(object)
    object.position.set(2, 0, 0)
    trail.commit()
    trail.blend(0)
    parent.updateMatrixWorld(true)
    expect(object.matrixWorld.elements[12]).toBe(0)
    expect(trail.isDrawing).toBe(true)
    trail.restore()
    expect(trail.isDrawing).toBe(false)
    expect(object.position.x).toBe(2)
    expect(object.matrixWorld.elements[12]).toBe(2)
    trail.blend(0.25)
    trail.begin()
    expect(object.position.x).toBe(2)
  })

  it('makes no object per frame: the arrays are reused and grow only past the most ever recorded', () => {
    const trail = new PoseTrail()
    const objects = Array.from({ length: 10 }, (_, i) => objectAt(i, i * 0.1))
    const frame = (): void => {
      trail.begin()
      for (const object of objects) trail.record(object)
      for (const object of objects) object.position.x += 0.1
      trail.commit()
      trail.blend(0.5)
    }
    frame()
    const internals = trail as unknown as { previous: Float64Array; current: Float64Array; objects: unknown[] }
    const { previous, current, objects: held } = internals
    for (let i = 0; i < 50; i++) frame()
    expect(internals.previous).toBe(previous)
    expect(internals.current).toBe(current)
    expect(internals.objects).toBe(held)
    const more = Array.from({ length: 200 }, (_, i) => objectAt(i, 0))
    trail.begin()
    for (const object of more) trail.record(object)
    trail.commit()
    expect(trail.size).toBe(200)
    expect(internals.previous).not.toBe(previous)
  })

  it('draws nothing before a commit', () => {
    const trail = new PoseTrail()
    const object = objectAt(1, 0)
    trail.begin()
    trail.record(object)
    object.position.x = 5
    trail.blend(0)
    expect(object.position.x).toBe(5)
    expect(trail.isDrawing).toBe(false)
  })
})

const newWorld = async () => (await createJoltEngine()).createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })

const makeSystem = (world: Awaited<ReturnType<typeof newWorld>>, interpolate: boolean): PieceSystem =>
  new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: world, ...(interpolate ? { interpolate: true } : {}) })

const dropPiece = (system: PieceSystem, height: number, id = 'drop'): THREE.Object3D => {
  const root = new THREE.Object3D()
  root.position.set(0, height, 0)
  system.create(id, root, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
  return root
}

describe('interpolated pieces', () => {
  it('alpha 0 is the pose before the last step, 1 the step pose; the simulation reads the step pose again after a present at 0.5', async () => {
    const world = await newWorld()
    const system = makeSystem(world, true)
    const root = dropPiece(system, 2)
    for (let i = 0; i < 5; i++) system.update(1 / 60)
    const before = poseOf(root)
    system.update(1 / 60)
    const step = poseOf(root)
    expect(step[1]).toBeLessThan(before[1] as number)

    system.presentPose(0)
    expect(poseOf(root)).toEqual(before)
    system.presentPose(0.5)
    expect(root.position.y).toBeCloseTo(((before[1] as number) + (step[1] as number)) / 2, 12)
    system.restoreStepPose()
    expect(poseOf(root)).toEqual(step)
    system.presentPose(1)
    expect(poseOf(root)).toEqual(step)

    system.presentPose(0.5)
    system.update(1 / 60)
    // the step began from the step pose, not from what had been drawn
    expect(root.position.y).toBeLessThan(step[1] as number)
    expect(root.position.y).toBeGreaterThan((step[1] as number) - 0.1)
    world.dispose()
  })

  it('a piece that slept does not move under alpha', async () => {
    const world = await newWorld()
    const system = makeSystem(world, true)
    const root = dropPiece(system, 0.1, 'sleeper')
    const body = system.list[0] as { sleeping: boolean }
    body.sleeping = true
    for (let i = 0; i < 5; i++) system.update(1 / 60)
    const rest = poseOf(root)
    const trail = (system as unknown as { trail: PoseTrail }).trail
    expect(trail.size).toBe(0)
    for (const alpha of [0, 0.3, 1]) {
      system.presentPose(alpha)
      expect(poseOf(root)).toEqual(rest)
    }
    world.dispose()
  })

  it('without the option nothing is recorded or drawn: the roots are the step pose, the matrices the same as ever', async () => {
    const world = await newWorld()
    const plain = makeSystem(world, false)
    const root = dropPiece(plain, 2)
    for (let i = 0; i < 6; i++) plain.update(1 / 60)
    root.updateMatrix()
    const matrix = [...root.matrix.elements]
    const step = poseOf(root)
    plain.presentPose(0)
    plain.restoreStepPose()
    root.updateMatrix()
    expect(poseOf(root)).toEqual(step)
    expect([...root.matrix.elements]).toEqual(matrix)
    expect((plain as unknown as { trail: unknown }).trail).toBeNull()
    world.dispose()
  })

  it('the simulation is the same with the option on or off', async () => {
    const worldA = await newWorld()
    const worldB = await newWorld()
    const off = makeSystem(worldA, false)
    const on = makeSystem(worldB, true)
    const rootOff = dropPiece(off, 1.5)
    const rootOn = dropPiece(on, 1.5)
    for (let i = 0; i < 90; i++) {
      off.update(1 / 60)
      on.update(1 / 60)
      on.presentPose((i % 5) / 5)
      if (i % 2 === 0) on.restoreStepPose()
      expect(poseOf(rootOn)).toEqual(i % 2 === 0 ? poseOf(rootOff) : poseOf(rootOn))
    }
    on.restoreStepPose()
    expect(poseOf(rootOn)).toEqual(poseOf(rootOff))
    worldA.dispose()
    worldB.dispose()
  })
})

describe('interpolated fragments', () => {
  const brickFragment = (id: string, y: number): never => ({ id, shape: 'chunk', center: [0, y, 0], rotation: [0, 0, 0, 1], velocity: [0.5, 0, 0], angularVelocity: [1, 2, 3], size: [0.1, 0.06, 0.08], material: 'brick', mass: 0.3 }) as never

  it('alpha 0 and 1 draw the previous and the step pose, in the instances too; the next update restores the step pose', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100, interpolate: true } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const mesh = system.spawn(brickFragment('a', 2), brick, 'home', 100)!
    for (let i = 0; i < 4; i++) system.update(1 / 60)
    const before = poseOf(mesh)
    system.update(1 / 60)
    const step = poseOf(mesh)
    system.presentPose(0)
    expect(poseOf(mesh)).toEqual(before)
    const instanced = scene.children.find((child): child is THREE.InstancedMesh => (child as THREE.InstancedMesh).isInstancedMesh === true)!
    const drawn = new THREE.Matrix4()
    instanced.getMatrixAt(0, drawn)
    expect(drawn.elements[13]).toBeCloseTo(before[1] as number, 5)
    system.presentPose(1)
    expect(poseOf(mesh)).toEqual(step)
    system.presentPose(0.5)
    system.restoreStepPose()
    expect(poseOf(mesh)).toEqual(step)
    system.dispose()
  })

  it('a fragment at rest is not drawn between poses, and without the option nothing changes', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100, interpolate: true } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const lying = system.spawn(brickFragment('r', 0.03), brick, 'home', 100)!
    for (let i = 0; i < 600; i++) system.update(1 / 60)
    const rest = poseOf(lying)
    system.presentPose(0)
    expect(poseOf(lying)).toEqual(rest)
    expect((system as unknown as { trail: PoseTrail }).trail.size).toBe(0)

    const plain = new FragmentSystem(THREE, { scene: new THREE.Scene(), gravity: 9.8, groundAt: () => 0, life: 0, max: 100 } as unknown as FragmentSystemOptions)
    const flying = plain.spawn(brickFragment('p', 2), plain.materialFor('brick', 0x9a4a3a, false), 'home', 100)!
    for (let i = 0; i < 5; i++) plain.update(1 / 60)
    const step = poseOf(flying)
    plain.presentPose(0)
    plain.restoreStepPose()
    expect(poseOf(flying)).toEqual(step)
    system.dispose()
    plain.dispose()
  })
})
