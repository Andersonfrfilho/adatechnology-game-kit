import * as THREE from 'three'
import { BATCHED_LAYER } from '@adatechnology/game-render-three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'
import { PieceSystem } from '../src/pieces'
import type { PieceSystemOptions } from '../src/pieces'
import { createDestructionRenderer } from '../src/renderer'
import type { SettledBatchOptions } from '../src/settled-batches'
import { FakeWorld, partState } from './fake-world'

const DT = 1 / 60
/** Batches made as soon as anything settles, merged in the update that makes them. */
const PROMPT_BATCHES: SettledBatchOptions = { minMeshes: 1, intervalSeconds: 0, budgetMs: Infinity }

const pieceSystem = (options: Partial<PieceSystemOptions> = {}): PieceSystem =>
  new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), ...options })

/** `count` boxes 20 cm across, a metre apart along x, their bottoms `lift` m over the ground. */
const dropBoxes = (system: PieceSystem, count: number, lift: number): THREE.Object3D[] =>
  Array.from({ length: count }, (_, index) => {
    const root = new THREE.Object3D()
    root.position.set(index, 0.1 + lift, 0)
    system.create(`box_${index}`, root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    return root
  })

const awake = (system: PieceSystem): number => system.list.filter((body) => !body.sleeping && !body.held).length

const rendererScene = (settledBatches: SettledBatchOptions = PROMPT_BATCHES) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), settledBatches })
  const materials = [new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), new THREE.MeshLambertMaterial({ color: 0x777777 })]
  const box = (id: string, at: [number, number, number], material: THREE.Material = materials[0]!): THREE.Mesh => {
    world.addObject(id, [partState('body', 'wood', { mass: 2 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), material)
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...at)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    renderer.makePiece(id)
    return mesh
  }
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += DT) {
      renderer.update(DT)
      scene.updateMatrixWorld(true)
    }
  }
  /** Meshes the camera draws (its layer 0), the batches among them. */
  const draws = (): number => {
    let count = 0
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh && object.visible && object.layers.isEnabled(0)) count++
    })
    return count
  }
  return { scene, world, renderer, materials, box, run, draws }
}

describe('the budget of awake pieces', () => {
  it('puts the oldest pieces at rest to sleep where they lie, never more awake than the budget', () => {
    const capped = pieceSystem({ maxAwake: 4 })
    const free = pieceSystem()
    const cappedRoots = dropBoxes(capped, 12, 0.005)
    const freeRoots = dropBoxes(free, 12, 0.005)
    let mostAwake = 0
    for (let frame = 0; frame < 6; frame++) {
      capped.update(DT)
      free.update(DT)
      if (frame > 0) mostAwake = Math.max(mostAwake, awake(capped))
    }
    // on the ground and still, but not long enough to sleep by itself
    expect(awake(free)).toBe(12)
    expect(mostAwake).toBeLessThanOrEqual(4)
    // the oldest went to sleep first
    expect(capped.list.slice(0, 8).every((body) => body.sleeping)).toBe(true)
    for (let frame = 0; frame < 120; frame++) {
      capped.update(DT)
      free.update(DT)
    }
    // nothing was moved: each lies where the same box with no budget came to rest
    cappedRoots.forEach((root, index) => expect(root.position.distanceTo(freeRoots[index]!.position)).toBeLessThan(0.002))
  })

  it('keeps simulating a piece that is still moving, however many are awake', () => {
    const system = pieceSystem({ maxAwake: 0 })
    const [falling] = dropBoxes(system, 1, 1)
    for (let frame = 0; frame < 10; frame++) system.update(DT)
    expect(system.list[0]!.sleeping).toBe(false)
    expect(falling!.position.y).toBeLessThan(1.1)
    for (let frame = 0; frame < 120; frame++) system.update(DT)
    expect(falling!.position.y).toBeCloseTo(0.1, 2)
  })

  it('wakes a piece put to sleep on a top when the top goes, and it falls to the ground', () => {
    let top = 0.5
    const system = pieceSystem({ maxAwake: 0, staticTopAt: (_x, _z, y, step) => (top <= y + step ? top : -Infinity) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.61, 0)
    system.create('book', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    for (let frame = 0; frame < 30; frame++) system.update(DT)
    expect(system.list[0]!.sleeping).toBe(true)
    expect(root.position.y).toBeCloseTo(0.6, 2)
    top = -Infinity
    for (let frame = 0; frame < 120; frame++) system.update(DT)
    expect(root.position.y).toBeCloseTo(0.1, 2)
  })

  it('wakes a piece put to sleep leaning on a step when the step goes, and it comes down, though its foot is still on the floor', () => {
    let top = 0.4
    // a board standing on a step: one end on the step, the rest on the floor
    const system = pieceSystem({ maxAwake: 0, staticTopAt: (x, _z, y, step) => (x > 0.35 && top <= y + step ? top : -Infinity) })
    const root = new THREE.Object3D()
    root.position.set(0, 0.6, 0)
    root.rotation.z = Math.atan2(0.4, 0.8)
    const body = system.create('board', root, [0.45, 0.01, 0.15], new THREE.Vector3(), 3)
    for (let frame = 0; frame < 300; frame++) system.update(DT)
    expect(body.sleeping).toBe(true)
    const restingY = root.position.y
    top = -Infinity
    for (let frame = 0; frame < 240; frame++) system.update(DT)
    // nothing holds the high end any more: it came down
    expect(root.position.y).toBeLessThan(restingY - 0.1)
  })
})

describe('the budget of awake fragments', () => {
  it('puts the oldest fragments at rest to sleep, keeps the big ones and lets the small ones fade as before', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.81, groundAt: () => 0, life: 1, max: 100, maxAwake: 1 } as FragmentSystemOptions)
    const material = system.materialFor('wood', 0x808080, false)
    const spawn = (id: string, size: [number, number, number], x: number): THREE.Mesh =>
      system.spawn({ id, shape: 'chunk', center: [x, size[1] / 2 + 0.001, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size, material: 'wood', mass: 1 } as never, material, 'home', 100)!
    const big = spawn('big', [0.4, 0.1, 0.1], 0)
    spawn('small_a', [0.03, 0.03, 0.03], 1)
    spawn('small_b', [0.03, 0.03, 0.03], 2)
    for (let frame = 0; frame < 3; frame++) system.update(DT)
    expect(system.meshes().filter((mesh) => mesh.matrixAutoUpdate).length).toBeLessThanOrEqual(1)
    for (let frame = 0; frame < 300; frame++) system.update(DT)
    // the big one is debris that stays; the small ones faded after their life at rest
    expect(system.meshes()).toEqual([big])
  })
})

describe('the debris at rest drawn in batches', () => {
  it('draws N pieces at rest in no more draws than their materials, and a woken one leaves its batch and moves again', () => {
    const { renderer, materials, box, run, draws } = rendererScene()
    // what the renderer itself draws besides the debris (its own effects layer)
    const own = draws()
    const meshes = Array.from({ length: 10 }, (_, index) => box(`crate_${index}`, [index * 0.6, 0.3, 0], materials[index % 2]))
    expect(draws() - own).toBe(10)
    run(2)
    expect(renderer.pieces().every((piece) => piece.sleeping)).toBe(true)
    expect(renderer.settledBatchStats?.()).toEqual({ batches: 2, batched: 10 })
    expect(draws() - own).toBeLessThanOrEqual(materials.length)
    const target = meshes[3]!
    expect(target.layers.isEnabled(BATCHED_LAYER)).toBe(true)
    renderer.impulse('crate_3', [0, 6, 0])
    run(DT)
    expect(target.layers.isEnabled(0)).toBe(true)
    expect(renderer.piece('crate_3')!.sleeping).toBe(false)
    const height = target.getWorldPosition(new THREE.Vector3()).y
    run(0.1)
    expect(target.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(height)
  })

  it('collides where it lies, batched or not: the same boxes, a ray finds it at the same point, and a piece lands on it', () => {
    const { scene, renderer, box, run } = rendererScene()
    const target = box('crate', [0, 0.3, 0])
    box('crate_b', [3, 0.3, 0])
    const solids = (): number[][] => renderer.solidsNear(0, 0, 0.5).filter((solid) => solid.objectId === 'crate').map((solid) => [...solid.min, ...solid.max])
    const rayPoint = (): THREE.Vector3 | undefined => {
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0))
      ray.layers.enableAll()
      return ray.intersectObject(scene, true).find((hit) => hit.object === target)?.point
    }
    run(1.5)
    const batchedAt = solids()
    expect(target.layers.isEnabled(BATCHED_LAYER)).toBe(true)
    expect(batchedAt.length).toBeGreaterThan(0)
    const hit = rayPoint()
    expect(hit?.y).toBeCloseTo(0.2, 2)
    const unbatched = rendererScene({ enabled: false })
    const plainTarget = unbatched.box('crate', [0, 0.3, 0])
    unbatched.box('crate_b', [3, 0.3, 0])
    unbatched.run(1.5)
    const plainAt = unbatched.renderer.solidsNear(0, 0, 0.5).filter((solid) => solid.objectId === 'crate').map((solid) => [...solid.min, ...solid.max])
    expect(batchedAt).toEqual(plainAt)
    const plainRay = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0)).intersectObject(unbatched.scene, true).find((one) => one.object === plainTarget)?.point
    expect(hit?.toArray()).toEqual(plainRay?.toArray())
    // a piece dropped on it meets it as it meets the same crate drawn on its own
    const lid = box('lid', [0.1, 0.8, 0])
    const plainLid = unbatched.box('lid', [0.1, 0.8, 0])
    run(1.5)
    unbatched.run(1.5)
    expect(lid.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(plainLid.getWorldPosition(new THREE.Vector3()).toArray())
    expect(target.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(plainTarget.getWorldPosition(new THREE.Vector3()).toArray())
  })

  it('gives a batched piece its own draw back the moment something happens to it, before it is drawn', () => {
    const { world, box, run } = rendererScene()
    const meshes = Array.from({ length: 4 }, (_, index) => box(`crate_${index}`, [index * 0.6, 0.3, 0]))
    run(2)
    expect(meshes.every((mesh) => mesh.layers.isEnabled(BATCHED_LAYER))).toBe(true)
    world.emit({ type: 'crack', object: 'crate_2', part: 'body', point: [1.2, 0.2, 0], normal: [0, 1, 0], length: 0.1 })
    run(DT)
    expect(meshes[2]!.layers.isEnabled(0)).toBe(true)
  })

  it('batches the copies of one material that draw the same (a mesh the renderer charred or tinted has its own copy)', () => {
    const { materials, box, run, draws } = rendererScene()
    const own = draws()
    for (let index = 0; index < 8; index++) box(`plank_${index}`, [index * 0.6, 0.3, 0], index % 2 === 0 ? materials[0]!.clone() : materials[1]!.clone())
    run(2)
    expect(draws() - own).toBe(2)
  })

  it('keeps every piece: batching only draws them, and gives them their own draws back and disposes the batches when cleared', () => {
    const { scene, renderer, box, run } = rendererScene()
    const meshes = Array.from({ length: 6 }, (_, index) => box(`slab_${index}`, [index * 0.6, 0.3, 0]))
    run(30)
    expect(renderer.pieces()).toHaveLength(6)
    expect(meshes.every((mesh) => mesh.parent !== null && mesh.visible)).toBe(true)
    const batches = scene.getObjectByName('settled-debris-batches')!
    const geometries = batches.children.map((child) => (child as THREE.Mesh).geometry)
    let disposed = 0
    for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed++)
    renderer.clear()
    expect(meshes.every((mesh) => mesh.layers.isEnabled(0))).toBe(true)
    expect(scene.getObjectByName('settled-debris-batches')).toBeUndefined()
    expect(disposed).toBe(geometries.length)
  })
})
