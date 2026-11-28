import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** Seconds by which everything has fallen and come to rest (a beam 4 m long left almost upright takes most of them to go over, as a pencil on its point does). */
const SETTLED = 12
/** Seconds it is then watched for: nothing moves in them. */
const WATCH = 2
/** How far (m) the middle of a piece may ever go above where it broke off: what it was thrown with gives it a hand's width, never a climb. */
const RISE = 0.3
/** The steepest (degrees from level) a piece at rest may lie, leaning on another: one steeper stands on its end. */
const STEEPEST = 45
/** How high (m) the middle of a piece at rest may be: lying on the floor or across a few others, not held up in the air. */
const LYING = 0.5
/** Lengths (m) of what a broken thing leaves: a splinter, a stub of a chair leg, half a board, a whole board of a long table. */
const LENGTHS = [0.1, 0.3, 0.8, 1.7, 3, 4.2]
/** Leans (degrees from lying) the pieces start with, each with a turn of its own: debris never comes off level. */
const LEANS = [0, 15, 45, 80]

/** A deterministic stream in [0, 1). */
const stream = (seed: number): (() => number) => {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

/** What the debris of one broken part did wrong, piece by piece: one of each length at each lean, thrown off a table's height over a floor, some across the others. */
function dropped(section: readonly [number, number]): string[] {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt: () => 0 })
  world.addObject('table', [partState('top', 'wood_hard', { mass: 60 })])
  const random = stream(7)
  const fragments = LENGTHS.flatMap((length, i) =>
    LEANS.map((lean, k) => {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, (lean * Math.PI) / 180, 'YXZ'))
      // thrown and turned as a break throws it: its end no faster than a metre a second or so, whatever its length
      const turn = 4 * Math.min(1, 0.3 / length)
      return {
        id: `f${i}_${k}`, part: 'top', material: 'wood_hard', shape: 'splinter', center: [(random() - 0.5) * 3, 0.76 + length / 2, (random() - 0.5) * 3], size: [length, section[0], section[1]],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w], velocity: [(random() - 0.5) * 2, random(), (random() - 0.5) * 2], angularVelocity: [(random() - 0.5) * turn, (random() - 0.5) * turn, (random() - 0.5) * turn],
        mass: 600 * length * section[0] * section[1],
      }
    }),
  )
  world.emit({ type: 'fracture', object: 'table', part: 'top', point: [0, 0.76, 0], style: 'splinter', fragments } as never)
  const meshes = (): THREE.Object3D[] => {
    const found: THREE.Object3D[] = []
    scene.traverse((node) => {
      if (node.name === 'fragment') found.push(node)
    })
    return found
  }
  const name = (mesh: THREE.Object3D): string => `a piece ${Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z).toFixed(1)} m long`
  const wrong = new Set<string>()
  const born = new Map<THREE.Object3D, number>()
  const before = new Map<THREE.Object3D, THREE.Vector3>()
  for (let t = 0; t < SETTLED + WATCH; t += STEP) {
    renderer.update(STEP)
    for (const mesh of meshes()) {
      if (!born.has(mesh)) born.set(mesh, mesh.position.y)
      if (mesh.position.y > (born.get(mesh) ?? 0) + RISE) wrong.add(`${name(mesh)} rose ${(mesh.position.y - (born.get(mesh) ?? 0)).toFixed(2)} m above where it broke off`)
      if (t < SETTLED) continue
      const was = before.get(mesh)
      if (was && was.distanceTo(mesh.position) > 1e-4) wrong.add(`${name(mesh)} still moved ${SETTLED} s after it broke`)
      before.set(mesh, mesh.position.clone())
    }
  }
  for (const mesh of meshes()) {
    const long = mesh.scale.x >= mesh.scale.y && mesh.scale.x >= mesh.scale.z ? new THREE.Vector3(1, 0, 0) : mesh.scale.y >= mesh.scale.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
    const steep = (Math.asin(Math.min(1, Math.abs(long.applyQuaternion(mesh.quaternion).y))) * 180) / Math.PI
    if (Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) >= 0.3 && steep > STEEPEST) wrong.add(`${name(mesh)} stands ${steep.toFixed(0)} degrees up`)
    if (mesh.position.y > LYING) wrong.add(`${name(mesh)} lies with its middle ${mesh.position.y.toFixed(2)} m up`)
  }
  return [...wrong]
}

describe('debris of any length comes to lie on the floor', () => {
  it.each([
    ['a board of a table top', [0.04, 0.075]],
    ['a slat', [0.02, 0.04]],
    ['a beam', [0.1, 0.1]],
  ] as Array<[string, [number, number]]>)('%s, from a splinter to 4.2 m: none rises, stands on its end or keeps moving', (_, section) => {
    expect(dropped(section)).toEqual([])
  })

  it('a board that falls with one end over a crate ends leaning on the crate, its other end on the floor: not through the crate, not level in the air', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt: () => 0 })
    world.addObject('crate', [partState('box', 'wood_hard', { mass: 30 })])
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6))
    crate.position.set(0, 0.25, 0)
    const root = new THREE.Group()
    root.add(crate)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('crate', root, { parts: { box: crate } })
    world.addObject('table', [partState('top', 'wood_hard', { mass: 60 })])
    // 3 m long, its middle 1.2 m from the crate: 30 cm of one end over the crate, the rest over the floor
    const board = { id: 'board', part: 'top', material: 'wood_hard', shape: 'splinter', center: [1.2, 1, 0], size: [3, 0.04, 0.2], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], mass: 14 }
    world.emit({ type: 'fracture', object: 'table', part: 'top', point: [1.2, 1, 0], style: 'splinter', fragments: [board] } as never)
    for (let t = 0; t < 10; t += STEP) renderer.update(STEP)
    let mesh: THREE.Object3D | undefined
    scene.traverse((node) => {
      if (node.name === 'fragment') mesh = node
    })
    const along = new THREE.Vector3(1.5, 0, 0).applyQuaternion((mesh as THREE.Object3D).quaternion)
    const middle = (mesh as THREE.Object3D).position
    const ends = [middle.y + along.y, middle.y - along.y].sort((a, b) => a - b)
    expect(ends[0], 'the low end of the board is on the floor').toBeLessThan(0.1)
    // where it crosses the edge of the crate (x = 0.3) it lies on the crate's top, 0.5 m up
    const slope = along.y / along.x
    const overEdge = middle.y + slope * (0.3 - middle.x)
    expect(overEdge, 'the board over the edge of the crate').toBeGreaterThan(0.48)
    expect(overEdge, 'the board over the edge of the crate').toBeLessThan(0.6)
  })
})

/** Board lengths (m) of the tops broken by the core itself: a stool, a table, a long table, the room's 4.4 m one. */
const TOPS = [0.5, 1.5, 3, 4.4]

/**
 * What the debris of a table top did wrong when the world itself broke it: six boards of `length` on four legs, shot through until each gives way, so the pieces are the
 * ones the core cuts and throws (their sizes, speeds and turns), not ones made up here.
 */
function shotApart(length: number): string[] {
  const scene = new THREE.Scene()
  const world = createDestruction()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const boards = [0, 1, 2, 3, 4, 5]
  const legs: ReadonlyArray<readonly [number, number]> = [[-length / 2 + 0.1, -0.2], [length / 2 - 0.1, -0.2], [-length / 2 + 0.1, 0.2], [length / 2 - 0.1, 0.2]]
  const parts = [
    ...boards.map((i) => ({ id: `b${i}`, material: 'wood_hard', shape: { kind: 'box', size: [length, 0.04, 0.075] }, position: [0, 0.76, -0.19 + i * 0.076] })),
    ...legs.map(([x, z], i) => ({ id: `leg${i}`, material: 'wood_hard', shape: { kind: 'box', size: [0.06, 0.74, 0.06] }, position: [x, 0.37, z] })),
  ]
  const id = world.add({ parts } as never, { id: 'table' })
  const root = new THREE.Group()
  const meshOf: Record<string, THREE.Object3D> = {}
  for (const part of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...(part.shape.size as [number, number, number])))
    mesh.position.set(...(part.position as [number, number, number]))
    root.add(mesh)
    meshOf[part.id] = mesh
  }
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: meshOf })
  const wrong = new Set<string>()
  const born = new Map<THREE.Object3D, number>()
  const before = new Map<THREE.Object3D, THREE.Vector3>()
  let watching = false
  const debris = (): THREE.Object3D[] => {
    const found: THREE.Object3D[] = []
    scene.traverse((node) => {
      if (node.name === 'fragment') found.push(node)
    })
    return found
  }
  const name = (mesh: THREE.Object3D): string => `a piece ${Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z).toFixed(1)} m long of the ${length} m top`
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += STEP) {
      world.update(STEP)
      renderer.update(STEP)
      for (const mesh of debris()) {
        if (!born.has(mesh)) born.set(mesh, mesh.position.y)
        if (mesh.position.y > (born.get(mesh) ?? 0) + RISE) wrong.add(`${name(mesh)} rose ${(mesh.position.y - (born.get(mesh) ?? 0)).toFixed(2)} m above where it broke off`)
        if (!watching) continue
        const was = before.get(mesh)
        // a fragment fading away shrinks as it goes: only one that kept its size is judged
        if (was && was.z === mesh.scale.x && Math.hypot(was.x - mesh.position.x, was.y - mesh.position.y) > 1e-4) wrong.add(`${name(mesh)} still moved ${SETTLED} s after the last shot`)
        before.set(mesh, new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.scale.x))
      }
    }
  }
  run(0.5)
  for (const board of boards) {
    for (let shot = 0; shot < 60; shot++) {
      const state = world.part(id, `b${board}`)
      if (!state || state.status === 'broken') break
      world.hitPart(id, `b${board}`, { type: 'ballistic', point: [(((shot * 37) % 100) / 100 - 0.5) * length * 0.8, 0.76, -0.19 + board * 0.076], direction: [0, -0.3, -1], energy: 1316, radius: 0.003, source: 'test' } as never)
      run(0.08)
    }
  }
  run(SETTLED)
  watching = true
  run(WATCH)
  let big = 0
  for (const mesh of debris()) {
    const longest = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z)
    if (longest < 0.3) continue
    big++
    const long = mesh.scale.x >= mesh.scale.y && mesh.scale.x >= mesh.scale.z ? new THREE.Vector3(1, 0, 0) : mesh.scale.y >= mesh.scale.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
    const steep = (Math.asin(Math.min(1, Math.abs(long.applyQuaternion(mesh.quaternion).y))) * 180) / Math.PI
    if (steep > STEEPEST) wrong.add(`${name(mesh)} stands ${steep.toFixed(0)} degrees up`)
    if (mesh.position.y > LYING) wrong.add(`${name(mesh)} lies with its middle ${mesh.position.y.toFixed(2)} m up`)
  }
  if (length >= 1.5 && big === 0) wrong.add(`no piece of 30 cm or more came off the ${length} m top: the scene tests nothing`)
  return [...wrong]
}

describe('a table top shot apart by the world itself', () => {
  it.each(TOPS)('%d m long: none of its pieces rises, stands on its end or keeps moving', (length) => {
    expect(shotApart(length)).toEqual([])
  })
})
