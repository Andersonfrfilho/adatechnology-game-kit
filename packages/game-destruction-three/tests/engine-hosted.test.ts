import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleImpl, DestructibleSpec, ObjectState, PartState, Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import { physicsOption } from './setup-physics'

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
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity })
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

describe.skipIf(process.env.PIECE_SOLVER !== 'jolt')('a body another module draws is in the engine as its parts', () => {
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

  it('only where the body is drawn: a crate dropped by the car, inside its zone boxes but outside what it draws, reaches the ground', () => {
    const r = drop([1.95, 1.5, 0], 3, (world, renderer) => {
      world.register(parked().impl)
      // drawn 3.6 x 1.4 x 1.6 m: the zone boxes (4 x 0.8 x 1.8 body) reach 20 cm past each end and 10 cm past each side
      const root = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 1.6))
      body.position.set(0, 0.7, 0)
      root.add(body)
      root.updateMatrixWorld(true)
      renderer.bind('car', root)
    })
    // from x 1.85 to 2.05: past the drawn end at 1.8, and 15 cm over the zone box that ends at 2.0
    expect(r.y).toBeCloseTo(0.1, 1)
  })

  /** A car that draws what its module measured: a body box 1.8 m wide with a mirror box on its side, and a flat roof of two triangles; its damage boxes (`describe`) are 20 cm wider. */
  const drawnCar = (): DestructibleImpl => {
    const { impl } = parked()
    const spec = impl.describe()
    // the damage zone of the cab reaches 60 cm past the drawn side, as the cab's zone box does with the mirrors in it
    const wide: DestructibleSpec = { ...spec, parts: spec.parts.map((p) => (p.id === 'body' ? { ...p, shape: { kind: 'box', size: [4, 0.8, 2] } } : p.id === 'roof' ? { ...p, shape: { kind: 'box', size: [2, 0.4, 2.4] } } : p)) }
    return {
      ...impl,
      describe: () => wide,
      colliders: () => [
        { id: 'body', center: [0, 0.6, 0], half: [2, 0.4, 0.9], rotation: [0, 0, 0, 1] },
        { id: 'mirror_left', center: [0.8, 1.0, 1.0], half: [0.1, 0.05, 0.1], rotation: [0, 0, 0, 1] },
        { id: 'roof', center: [0, 1.4, 0], half: [0.5, 0.01, 0.5], rotation: [0, 0, 0, 1], mesh: { vertices: new Float32Array([-0.5, 1.4, -0.5, 0.5, 1.4, -0.5, 0.5, 1.4, 0.5, -0.5, 1.4, 0.5]), indices: new Uint32Array([0, 2, 1, 0, 3, 2]) } },
      ],
    }
  }

  /** A plate of `size` made at `at` against the car: the most it rose over its first second, and where it was after three. */
  const plateAgainstCar = (size: Vec3, at: Vec3): { rise: number; y: number } => {
    const world = createDestruction()
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity })
    world.register(drawnCar(), { id: 'car' })
    renderer.bind('car', new THREE.Group())
    const id = world.add({ parts: [{ id: 'door', material: 'steel', shape: { kind: 'box', size }, position: [0, 0, 0] }], joints: [] }, { position: at })
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    root.add(mesh)
    root.position.set(...at)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { door: mesh } })
    renderer.makePiece(id)
    let rise = 0
    for (let t = 0; t < 3; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
      if (t < 1) rise = Math.max(rise, root.position.y - at[1])
    }
    return { rise, y: root.position.y }
  }

  it('a crate dropped on the triangles of a drawn piece rests on them, and on the box of another', () => {
    const onRoof = drop([0.2, 2.5, 0.1], 3, (world, renderer) => {
      world.register(drawnCar(), { id: 'car' })
      renderer.bind('car', new THREE.Group())
    })
    // the roof is a sheet at 1.4 m: the crate's centre 10 cm over it (the damage boxes' roof top is at 1.4 too, the body's at 1.0)
    expect(onRoof.y).toBeCloseTo(1.5, 1)
    const onBody = drop([1.5, 2.5, 0], 3, (world, renderer) => {
      world.register(drawnCar(), { id: 'car' })
      renderer.bind('car', new THREE.Group())
    })
    expect(onBody.y).toBeCloseTo(1.1, 1)
  })

  it('a door made touching the drawn side is not lifted: the damage boxes reaching past it do not hold it', () => {
    // 4 cm thick, 80 cm high, 3 cm off the drawn side (z 0.9), inside the cab's damage box that reaches z 1.2 and from y 1.0
    const door = plateAgainstCar([0.9, 0.8, 0.04], [-0.8, 1.2, 0.95])
    expect(door.rise).toBeLessThan(0.03)
  })
})

