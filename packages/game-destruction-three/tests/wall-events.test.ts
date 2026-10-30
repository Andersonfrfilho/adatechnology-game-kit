import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

/** A wall of concrete 2.4 x 2.1 x 0.2 m facing +z, bound to the part `wall`. */
function setup() {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: (key) => sounds.push(key) })
  world.addObject('o1', [partState('wall', 'concrete')])
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.2), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 }))
  wall.position.set(0, 1.05, 0)
  const root = new THREE.Group()
  root.add(wall)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: { wall } })
  return { scene, world, renderer, wall, sounds }
}

const fragment = (id: string, over: Record<string, unknown> = {}) => ({
  id, part: 'wall', material: 'concrete', shape: 'chunk' as const, center: [0, 1, 0.1] as [number, number, number], size: [0.23, 0.075, 0.2] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number], velocity: [0, 1, 2] as [number, number, number], angularVelocity: [1, 1, 1] as [number, number, number], mass: 1, ...over,
})

describe('spall', () => {
  it('draws a patch of the core colour on the wall face, under the holes, and restore removes it', () => {
    const { world, renderer, wall } = setup()
    world.emit({ type: 'spall', object: 'o1', part: 'wall', layer: 0, point: [0.3, 1.2, 0.1], area: 0.0113 })
    renderer.update(0.016)
    expect(wall.children).toHaveLength(1)
    const patch = wall.children[0] as THREE.Mesh
    expect(patch.renderOrder).toBe(1)
    expect((patch.material as THREE.MeshBasicMaterial).transparent).toBe(false)
    expect(patch.position.z).toBeGreaterThan(0.1)
    expect(patch.scale.x).toBeCloseTo(Math.sqrt(0.0113 / Math.PI), 6)
    expect(renderer.stats().decals).toBe(1)
    renderer.restore('o1')
    expect(wall.children).toHaveLength(0)
  })

  it('puts the patch on the face the point is nearest to, not always the front one', () => {
    const { world, renderer, wall } = setup()
    world.emit({ type: 'spall', object: 'o1', part: 'wall', layer: 0, point: [0, 1, -0.1], area: 0.01 })
    renderer.update(0.016)
    expect((wall.children[0] as THREE.Mesh).position.z).toBeLessThan(-0.1)
  })
})

describe('stage 2', () => {
  it('throws the unit fragments, keeps the part drawn and keeps the holes on the units', () => {
    const { scene, world, renderer, wall, sounds } = setup()
    const fragments = [
      fragment('wall#b0', { marks: [{ point: [0.02, 0.01, 0.1], normal: [0, 0, 1], diameter: 0.009 }] }),
      fragment('wall#b1', { center: [0.23, 1, 0.1] }),
      fragment('wall#b2', { center: [-0.23, 1, 0.1] }),
    ]
    world.emit({ type: 'stage', object: 'o1', part: 'wall', stage: 2, opening: { center: [0, 1, 0], radius: 0.28 }, fragments })
    renderer.update(0.016)
    expect(wall.visible).toBe(true)
    expect(renderer.stats().fragments).toBe(3)
    const spawned = scene.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c !== wall && c.scale.x < 0.3)
    expect(spawned).toHaveLength(3)
    expect(spawned.map((m) => m.children.length).sort()).toEqual([0, 0, 1])
    const marked = spawned.find((m) => m.children.length === 1)!
    const hole = marked.children[0] as THREE.Mesh
    expect(hole.position.z).toBeGreaterThan(0.1 / marked.scale.z)
    expect(sounds.length).toBeGreaterThan(0)
  })

  it('stage events without fragments change nothing on screen', () => {
    const { world, renderer, wall } = setup()
    world.emit({ type: 'stage', object: 'o1', part: 'wall', stage: 1 })
    renderer.update(0.016)
    expect(renderer.stats().fragments).toBe(0)
    expect(wall.visible).toBe(true)
  })
})

describe('exposed rebar', () => {
  const bars: Array<[[number, number, number], [number, number, number]]> = [
    [[-0.5, 1, 0], [0.5, 1, 0]],
    [[0, 0.5, 0], [0, 1.5, 0]],
    [[0.2, 0.5, 0], [0.2, 1.5, 0]],
  ]

  it('draws every bar as an instance of one cylinder mesh per part, along its segment', () => {
    const { scene, world, renderer } = setup()
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars })
    renderer.update(0.016)
    expect(renderer.rebarCount()).toBe(3)
    const cage = scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh)!
    expect(cage.count).toBe(3)
    const m = new THREE.Matrix4()
    cage.getMatrixAt(0, m)
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3()
    m.decompose(position, quaternion, scale)
    expect(position.toArray()).toEqual([0, 1, 0])
    expect(scale.y).toBeCloseTo(1, 6)
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).x).toBeCloseTo(1, 6)
  })

  it('a second expose replaces the first, an empty one removes the cage, restore clears it', () => {
    const { scene, world, renderer } = setup()
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars: bars.slice(0, 1) })
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars })
    renderer.update(0.016)
    expect(renderer.rebarCount()).toBe(3)
    expect(scene.children.filter((c) => c instanceof THREE.InstancedMesh)).toHaveLength(1)
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars: [] })
    renderer.update(0.016)
    expect(renderer.rebarCount()).toBe(0)
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars })
    renderer.update(0.016)
    renderer.restore('o1')
    expect(renderer.rebarCount()).toBe(0)
    expect(scene.children.some((c) => c instanceof THREE.InstancedMesh)).toBe(false)
  })
})

describe('chip', () => {
  it('takes away the holes and spalls on the unit that came out and keeps those elsewhere on the wall', () => {
    const { world, renderer, wall } = setup()
    world.emit({ type: 'spall', object: 'o1', part: 'wall', layer: 0, point: [0.02, 1.01, 0.1], area: 0.01 })
    world.emit({ type: 'spall', object: 'o1', part: 'wall', layer: 0, point: [0.8, 1.6, 0.1], area: 0.01 })
    renderer.update(0.016)
    expect(renderer.stats().decals).toBe(2)
    world.emit({ type: 'chip', object: 'o1', part: 'wall', center: [0, 1, 0], size: [0.23, 0.075, 0.2], rotation: [0, 0, 0, 1], fragments: [fragment('wall#c0')] })
    renderer.update(0.016)
    expect(renderer.stats().decals).toBe(1)
    expect((wall.children[0] as THREE.Mesh).position.x).toBeCloseTo(0.8, 3)
  })
})

describe('chip and the impact marks of the effects', () => {
  it('takes away the bullet marks the impact effect left on the unit that came out', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const vfx = createVfx()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), vfx })
    world.addObject('o1', [partState('wall', 'concrete')])
    const decals = vfx.workshop().decals
    decals.add(0.02, 1, 0.1, 0.06, 0x0e0d0c, { n: [0, 0, 1] })
    decals.add(0.8, 1.6, 0.1, 0.06, 0x0e0d0c, { n: [0, 0, 1] })
    world.emit({ type: 'chip', object: 'o1', part: 'wall', center: [0, 1, 0], size: [0.23, 0.075, 0.2], rotation: [0, 0, 0, 1], fragments: [fragment('wall#c0')] })
    renderer.update(0.016)
    expect(decals.decals.filter((d) => d.on).map((d) => d.x)).toEqual([0.8])
  })
})
