import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'

const FRAGMENT_COUNT = 40
const LOOSE_GROUP_COUNT = 5
const MIN_FRAGMENTS_PER_SLICE = 8

const fragment = (index: number) => ({
  id: `f${index}`,
  part: 'top',
  material: 'glass',
  shape: 'shard' as const,
  center: [index * 0.01, 1.5, 0] as [number, number, number],
  size: [0.2, 0.15, 0.01] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  velocity: [1, 2, 0.5] as [number, number, number],
  angularVelocity: [4, 3, 2] as [number, number, number],
  mass: 0.2,
})

function fracturedGlass(options: Partial<RendererOptions>) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), ...options })
  world.addObject('o1', [partState('top', 'glass')])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: { top: mesh } })
  world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'shatter', fragments: Array.from({ length: FRAGMENT_COUNT }, (_, index) => fragment(index)), point: [0, 1.5, 0] })
  return { renderer, mesh }
}

function looseParts(options: Partial<RendererOptions>) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), ...options })
  const ids = Array.from({ length: LOOSE_GROUP_COUNT + 1 }, (_, index) => `part${index}`)
  world.addObject('o1', ids.map((id) => partState(id, 'wood')), ids.map((id) => [id]))
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const id of ids) {
    meshes[id] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    root.add(meshes[id]!)
  }
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  world.emit({ type: 'detach', object: 'o1', joint: 'j', parts: ids, by: 'break', groups: ids.map((id) => [id]) })
  return { renderer, world }
}

describe('presentation work spread over frames', () => {
  it('spawns every fragment of a fracture at once when the budget is unlimited', () => {
    const { renderer } = fracturedGlass({ eventBudgetMs: Infinity })
    renderer.update(0.016)
    expect(renderer.stats().fragments).toBe(FRAGMENT_COUNT)
  })

  it('hides the part in the first frame and spawns the fragments a few per frame, all of them in the end', () => {
    const { renderer, mesh } = fracturedGlass({ eventBudgetMs: 0 })
    renderer.update(0.016)
    expect(mesh.visible).toBe(false)
    const first = renderer.stats().fragments
    expect(first).toBe(MIN_FRAGMENTS_PER_SLICE)
    let frames = 1
    let previous = first
    while (renderer.stats().fragments < FRAGMENT_COUNT && frames < FRAGMENT_COUNT * 2) {
      renderer.update(0.016)
      frames++
      expect(renderer.stats().fragments - previous).toBeLessThanOrEqual(MIN_FRAGMENTS_PER_SLICE)
      previous = renderer.stats().fragments
    }
    expect(renderer.stats().fragments).toBe(FRAGMENT_COUNT)
  })

  it('splits every loose group at once when the budget is unlimited', () => {
    const { renderer, world } = looseParts({ eventBudgetMs: Infinity })
    renderer.update(0.016)
    expect(world.splits).toHaveLength(LOOSE_GROUP_COUNT)
  })

  it('splits the loose groups one per frame at 0 ms, every one of them in the end', () => {
    const { renderer, world } = looseParts({ eventBudgetMs: 0 })
    for (let frame = 1; frame <= LOOSE_GROUP_COUNT; frame++) {
      renderer.update(0.016)
      expect(world.splits).toHaveLength(frame)
    }
    renderer.update(0.016)
    expect(world.splits).toHaveLength(LOOSE_GROUP_COUNT)
    expect(world.state('o1')?.groups).toHaveLength(1)
  })
})
