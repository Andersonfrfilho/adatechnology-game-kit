import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { createDestructionRenderer } from '../src/renderer'
import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'
import { FakeWorld, partState } from './fake-world'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

const bottom = (o: THREE.Object3D): number => {
  o.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(o).min.y
}

/** A table of the furniture catalogue: a top on four legs, each a part of its own, standing on the floor. */
const table = (world: FakeWorld, scene: THREE.Scene, renderer: ReturnType<typeof createDestructionRenderer>) => {
  const legIds = ['leg_0', 'leg_1', 'leg_2', 'leg_3']
  world.addObject('table', [partState('top', 'wood', { mass: 12 }), ...legIds.map((id) => partState(id, 'wood', { mass: 1.5 }))])
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.8))
  top.position.y = 0.76
  const legs = legIds.map((_, i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05))
    leg.position.set(i & 1 ? 0.75 : -0.75, 0.37, i & 2 ? 0.35 : -0.35)
    return leg
  })
  const root = new THREE.Group()
  root.add(top, ...legs)
  markKitOrigin(root, { owner: 'test', kind: 'furniture', id: 'table' })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('table', root, { parts: { top, ...Object.fromEntries(legIds.map((id, i) => [id, legs[i]!])) } })
  const breakLeg = (i: number): void => {
    const part = world.part('table', legIds[i]!)
    if (part) part.status = 'broken'
    world.emit({ type: 'fracture', object: 'table', part: legIds[i]!, point: [legs[i]!.position.x, 0.3, legs[i]!.position.z], style: 'splinter', fragments: [] })
  }
  return { top, breakLeg }
}

const can = (world: FakeWorld, scene: THREE.Scene, renderer: ReturnType<typeof createDestructionRenderer>, id: string, at: [number, number, number]) => {
  world.addObject(id, [partState('body', 'steel', { mass: 0.45 })])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11))
  mesh.position.y = 0.055
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(...at)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: { body: mesh } })
  return { root, piece: renderer.makePiece(id) }
}

describe('what lay on a support that is gone falls', () => {
  it('a can asleep on a table falls to the floor when every leg breaks and the top comes down', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const { top, breakLeg } = table(world, scene, renderer)
    const { root, piece } = can(world, scene, renderer, 'can', [0.2, 0.79, 0])
    run(renderer, 3)
    expect(piece.sleeping).toBe(true)
    expect(bottom(root)).toBeGreaterThan(0.77)
    for (let i = 0; i < 4; i++) breakLeg(i)
    run(renderer, 4)
    expect(renderer.piece('table')).not.toBeNull()
    expect(bottom(top)).toBeLessThan(0.02)
    // the can ends on the top that lies on the floor (4 cm), not where the top was
    expect(bottom(root)).toBeLessThan(0.06)
  })

  it('a table missing one leg still stands, and what is on it stays', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const { top, breakLeg } = table(world, scene, renderer)
    const { root } = can(world, scene, renderer, 'can', [0.2, 0.79, 0])
    run(renderer, 3)
    breakLeg(0)
    run(renderer, 3)
    expect(renderer.piece('table')).toBeNull()
    expect(bottom(top)).toBeGreaterThan(0.73)
    expect(bottom(root)).toBeGreaterThan(0.77)
  })

  it('with both legs of one end broken the table goes over', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const { top, breakLeg } = table(world, scene, renderer)
    breakLeg(0)
    breakLeg(2)
    run(renderer, 4)
    expect(renderer.piece('table')).not.toBeNull()
    expect(bottom(top)).toBeLessThan(0.3)
  })

  it('a top left on one leg goes over and comes to rest on the floor', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const { top, breakLeg } = table(world, scene, renderer)
    for (const i of [0, 1, 2]) breakLeg(i)
    run(renderer, 6)
    const piece = renderer.piece('table')
    expect(piece).not.toBeNull()
    expect(bottom(top)).toBeLessThan(0.05)
    expect(piece!.sleeping).toBe(true)
  })

  it('a top left on the two legs of one long side turns over that side until it lies on the floor', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const { top, breakLeg } = table(world, scene, renderer)
    breakLeg(0)
    breakLeg(1)
    run(renderer, 6)
    const piece = renderer.piece('table')
    expect(piece).not.toBeNull()
    expect(bottom(top)).toBeLessThan(0.05)
    expect(piece!.sleeping).toBe(true)
  })

  it('a piece asleep on another falls when the one under it is knocked away', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('crate', [partState('body', 'wood', { mass: 3 })])
    const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4))
    crateMesh.position.y = 0.2
    const crate = new THREE.Group()
    crate.add(crateMesh)
    scene.add(crate)
    crate.updateMatrixWorld(true)
    renderer.bind('crate', crate, { parts: { body: crateMesh } })
    renderer.makePiece('crate')
    run(renderer, 2)
    const { root, piece } = can(world, scene, renderer, 'can', [0, 0.41, 0])
    run(renderer, 3)
    expect(piece.sleeping).toBe(true)
    expect(bottom(root)).toBeGreaterThan(0.38)
    renderer.impulse('crate', [30, 0, 0])
    run(renderer, 3)
    expect(bottom(root)).toBeLessThan(0.02)
  })
})

describe('a fragment asleep over a ground that dropped', () => {
  it('falls to the new ground by itself', () => {
    let floor = 0.5
    const scene = new THREE.Scene()
    const options = { scene, gravity: 9.8, groundAt: () => floor, life: 0 } as unknown as FragmentSystemOptions
    const system = new FragmentSystem(THREE, options)
    const fragment = { id: 'f1', shape: 'chunk', center: [0, 0.55, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.1, 0.1], material: 'wood', mass: 1 }
    const mesh = system.spawn(fragment as never, system.materialFor('wood', 0x808080, false), 'home', 10)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.matrixAutoUpdate).toBe(false)
    floor = 0
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.position.y).toBeLessThan(0.1)
  })
})
