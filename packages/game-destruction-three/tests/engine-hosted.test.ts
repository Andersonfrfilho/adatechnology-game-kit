import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleImpl, DestructibleSpec, ObjectState, PartState, Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'

/** A hosted body as a vehicle module registers one: drawn by its own module (nothing of it bound to the renderer), its parts as boxes, a roof that can break. */
const parked = (): { impl: DestructibleImpl; breakRoof: () => void } => {
  const spec: DestructibleSpec = {
    name: 'car',
    parts: [
      { id: 'body', material: 'steel', shape: { kind: 'box', size: [4, 0.8, 1.8] }, position: [0, 0.6, 0] },
      { id: 'roof', material: 'steel', shape: { kind: 'box', size: [2, 0.4, 1.6] }, position: [0, 1.2, 0] },
    ],
    joints: [],
  }
  const part = (id: string, status: PartState['status']): PartState => ({ id, material: 'steel', status, hp: 1, maxHp: 1, mass: 100, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 })
  let state: ObjectState = { id: 'car', position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [], destroyed: false, joints: [], parts: [part('body', 'intact'), part('roof', 'intact')] }
  const impl: DestructibleImpl = { id: 'car', describe: () => spec, hit: () => [], state: () => state }
  // a new state object, as the contract hands one after a change
  const breakRoof = (): void => {
    state = { ...state, parts: [part('body', 'intact'), part('roof', 'broken')] }
  }
  return { impl, breakRoof }
}

/** A 20 cm crate dropped from `at`: its centre after `seconds`, and whether it sleeps. */
const drop = (at: Vec3, seconds: number, setup?: (world: ReturnType<typeof createDestruction>, renderer: ReturnType<typeof createDestructionRenderer>) => void): { y: number; sleeping: boolean; world: ReturnType<typeof createDestruction>; step: (s: number) => number } => {
  const world = createDestruction()
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { scene, world, eventBudgetMs: Infinity })
  setup?.(world, renderer)
  const id = world.add({ parts: [{ id: 'crate', material: 'wood_hard', shape: { kind: 'box', size: [0.2, 0.2, 0.2] }, position: [0, 0, 0] }], joints: [] }, { position: at })
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2))
  root.add(mesh)
  root.position.set(...at)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: { crate: mesh } })
  renderer.makePiece(id)
  const step = (s: number): number => {
    for (let t = 0; t < s; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
    }
    return root.position.y
  }
  const y = step(seconds)
  return { y, sleeping: renderer.piece(id)?.sleeping ?? false, world, step }
}

describe('a body another module draws is in the engine as its parts', () => {
  it('a crate dropped on a parked car rests on its roof and sleeps; the roof broken, it falls to the body; the car moved away, to the ground', () => {
    let car: ReturnType<typeof parked> | null = null
    const r = drop([0.3, 2.5, 0], 3, (world, renderer) => {
      car = parked()
      world.register(car.impl)
      // the room binds every object it places, a vehicle too: none of its meshes is the renderer's
      renderer.bind('car', new THREE.Group())
    })
    // on the roof: its top at 1.4 m, the crate's centre 10 cm above
    expect(r.y).toBeCloseTo(1.5, 1)
    expect(r.sleeping).toBe(true)
    ;(car as unknown as ReturnType<typeof parked>).breakRoof()
    // the state changed: the roof is not drawn any more, and nothing holds the crate there
    r.world.update(1 / 60)
    expect(r.step(3)).toBeCloseTo(1.1, 1)
    r.world.setTransform('car', [10, 0, 0], [0, 0, 0, 1])
    expect(r.step(3)).toBeCloseTo(0.1, 1)
  })
})
