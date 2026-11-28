import * as THREE from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

/** A bed 2 m by 1.4 m: a frame and mattress on four legs 5 cm square, 25 cm high, its middle at (0, 0). */
const LEG = { half: 0.025, height: 0.25 }
const LEGS: ReadonlyArray<readonly [number, number]> = [[-0.95, -0.65], [0.95, -0.65], [-0.95, 0.65], [0.95, 0.65]]

const makeBed = (groundAt: (x: number, z: number) => number) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const loosened: string[] = []
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt, onLoosened: (id, _piece, cause) => loosened.push(`${id}:${cause}`) })
  world.addObject('bed', [partState('frame', 'wood', { mass: 60 }), ...LEGS.map((_, i) => partState(`leg${i}`, 'wood', { mass: 1 }))])
  const root = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 1.4))
  frame.position.set(0, LEG.height + 0.175, 0)
  root.add(frame)
  const parts: Record<string, THREE.Object3D> = { frame }
  LEGS.forEach(([x, z], i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2 * LEG.half, LEG.height, 2 * LEG.half))
    leg.position.set(x, LEG.height / 2, z)
    root.add(leg)
    parts[`leg${i}`] = leg
  })
  markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'bed' })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('bed', root, { parts })
  return { renderer, root, loosened, world }
}

describe('the floor goes from under a foot of what stands free on it', () => {
  it('a hole under one leg of a bed takes that corner down into it', () => {
    const hole = { x: 0.95, z: 0.65, radius: 0.15, depth: 0.3 }
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - hole.x, z - hole.z) < hole.radius ? -hole.depth : 0)
    const { renderer, root, loosened } = makeBed(groundAt)
    run(renderer, 0.5)
    expect(loosened).toEqual([])
    dug = true
    renderer.wakeRegion(hole.x, hole.z, hole.radius)
    run(renderer, 0.1)
    expect(loosened).toEqual(['bed:ground'])
    run(renderer, 3)
    root.updateMatrixWorld(true)
    // the corner over the hole went down, the one across stayed on the floor
    const corner = new THREE.Vector3(0.95, 0, 0.65).applyMatrix4(root.matrixWorld)
    const across = new THREE.Vector3(-0.95, 0, -0.65).applyMatrix4(root.matrixWorld)
    expect(corner.y, 'the foot over the hole sank into it').toBeLessThan(-0.05)
    expect(across.y, 'the foot across from it is still on the floor').toBeGreaterThan(-0.05)
  })

  it('a hole beside a leg, or under the middle where no foot stands, leaves the bed where it is', () => {
    let hole: { x: number; z: number } | null = null
    const groundAt = (x: number, z: number): number => (hole && Math.hypot(x - hole.x, z - hole.z) < 0.1 ? -0.3 : 0)
    const { renderer, loosened } = makeBed(groundAt)
    run(renderer, 0.5)
    hole = { x: 0, z: 0 }
    renderer.wakeRegion(0, 0, 0.1)
    run(renderer, 0.2)
    hole = { x: 0.95 + 0.2, z: 0.65 }
    renderer.wakeRegion(hole.x, hole.z, 0.1)
    run(renderer, 0.2)
    expect(loosened).toEqual([])
  })

  it('a hole smaller than the foot leaves it on the rim', () => {
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - 0.95, z - 0.65) < 0.01 ? -0.3 : 0)
    const { renderer, loosened } = makeBed(groundAt)
    run(renderer, 0.5)
    dug = true
    renderer.wakeRegion(0.95, 0.65, 0.01)
    run(renderer, 0.2)
    expect(loosened).toEqual([])
  })
  it('one mesh merged from the frame and the legs (as the household beds are drawn) still goes over on the leg that lost the floor, and what lay on it comes off', () => {
    const hole = { x: 0.95, z: 0.65, radius: 0.15, depth: 0.3 }
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - hole.x, z - hole.z) < hole.radius ? -hole.depth : 0)
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const loosened: string[] = []
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt, onLoosened: (id, _piece, cause) => loosened.push(`${id}:${cause}`) })
    world.addObject('bed', [partState('body', 'wood', { mass: 64 })])
    const frame = new THREE.BoxGeometry(2, 0.35, 1.4).translate(0, LEG.height + 0.175, 0)
    const legs = LEGS.map(([x, z]) => new THREE.BoxGeometry(2 * LEG.half, LEG.height, 2 * LEG.half).translate(x, LEG.height / 2, z))
    const merged = mergeGeometries([frame, ...legs])
    if (!merged) throw new Error('merge failed')
    const mesh = new THREE.Mesh(merged)
    const root = new THREE.Group()
    root.add(mesh)
    markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'bed' })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('bed', root, { parts: { body: mesh } })
    // a box on the corner of the bed over where the hole will be
    world.addObject('box', [partState('body', 'cardboard', { mass: 2 })])
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3))
    const boxRoot = new THREE.Group()
    boxRoot.add(boxMesh)
    boxRoot.position.set(0.7, LEG.height + 0.35 + 0.1, 0.45)
    scene.add(boxRoot)
    renderer.bind('box', boxRoot, { parts: { body: boxMesh } })
    const box = renderer.makePiece('box')
    run(renderer, 2)
    expect(box.sleeping).toBe(true)
    const boxBefore = boxRoot.position.clone()
    dug = true
    renderer.wakeRegion(hole.x, hole.z, hole.radius)
    run(renderer, 4)
    expect(loosened).toEqual(['bed:ground'])
    root.updateMatrixWorld(true)
    const corner = new THREE.Vector3(0.95, 0, 0.65).applyMatrix4(root.matrixWorld)
    expect(corner.y, 'the foot over the hole sank into it').toBeLessThan(-0.05)
    expect(boxRoot.position.distanceTo(boxBefore), 'the box on the bed slid or fell with it').toBeGreaterThan(0.05)
  })
  it('a bed that is already a piece asleep on the floor (one the room let move) wakes and goes over when the floor goes from under a leg', () => {
    const hole = { x: 0.95, z: 0.65, radius: 0.15, depth: 0.3 }
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - hole.x, z - hole.z) < hole.radius ? -hole.depth : 0)
    const { renderer, root, loosened } = makeBed(groundAt)
    const piece = renderer.makePiece('bed')
    run(renderer, 4)
    expect(piece.sleeping).toBe(true)
    dug = true
    renderer.wakeRegion(hole.x, hole.z, hole.radius)
    run(renderer, 4)
    // it was a piece already: nothing new was loosened, it only fell
    expect(loosened).toEqual([])
    root.updateMatrixWorld(true)
    const corner = new THREE.Vector3(0.95, 0, 0.65).applyMatrix4(root.matrixWorld)
    expect(corner.y, 'the foot over the hole sank into it').toBeLessThan(-0.05)
  })
  it('a bed that is a piece asleep on its four legs goes down on the corner whose leg is shot off', () => {
    const { renderer, root, world } = makeBed(() => 0)
    const piece = renderer.makePiece('bed')
    run(renderer, 4)
    expect(piece.sleeping).toBe(true)
    const part = world.part('bed', 'leg3')
    if (part) part.status = 'broken'
    world.emit({ type: 'fracture', object: 'bed', part: 'leg3', point: [0.95, 0.1, 0.65], style: 'splinter', fragments: [] })
    run(renderer, 4)
    root.updateMatrixWorld(true)
    const corner = new THREE.Vector3(0.95, LEG.height, 0.65).applyMatrix4(root.matrixWorld)
    expect(corner.y, 'the frame came down on the corner that lost its leg').toBeLessThan(0.05)
  })
  it('a wardrobe on a full base with a hole under one corner of it keeps standing', () => {
    const hole = { x: 0.5, z: 0.3, radius: 0.12, depth: 0.3 }
    let dug = false
    const groundAt = (x: number, z: number): number => (dug && Math.hypot(x - hole.x, z - hole.z) < hole.radius ? -hole.depth : 0)
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const loosened: string[] = []
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt, onLoosened: (id) => loosened.push(id) })
    world.addObject('wardrobe', [partState('body', 'wood', { mass: 80 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.6).translate(0, 1, 0))
    const root = new THREE.Group()
    root.add(mesh)
    markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'wardrobe' })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('wardrobe', root, { parts: { body: mesh } })
    run(renderer, 0.5)
    dug = true
    renderer.wakeRegion(hole.x, hole.z, hole.radius)
    run(renderer, 0.5)
    expect(loosened).toEqual([])
  })
})
