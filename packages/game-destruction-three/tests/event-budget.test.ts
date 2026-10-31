import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'

const PART_COUNT = 5

function setup(options: Partial<RendererOptions>) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: (key) => sounds.push(key), ...options })
  const ids = Array.from({ length: PART_COUNT }, (_, index) => `part${index}`)
  world.addObject('o1', ids.map((id) => partState(id, 'glass')))
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const id of ids) {
    meshes[id] = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial())
    root.add(meshes[id]!)
  }
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  for (const id of ids) world.emit({ type: 'fracture', object: 'o1', part: id, style: 'shatter', fragments: [], point: [0, 0, 0] })
  return { renderer, meshes, ids }
}

const brokenCount = (meshes: Record<string, THREE.Mesh>): number => Object.values(meshes).filter((mesh) => !mesh.visible).length

describe('event budget', () => {
  it('applies one event per frame at 0 ms and carries the rest in order', () => {
    const { renderer, meshes, ids } = setup({ eventBudgetMs: 0 })
    for (let frame = 1; frame <= PART_COUNT; frame++) {
      renderer.update(0.016)
      expect(brokenCount(meshes)).toBe(frame)
      expect(meshes[ids[frame - 1]!]!.visible).toBe(false)
    }
  })

  it('applies everything in one frame when the budget is unlimited', () => {
    const { renderer, meshes } = setup({ eventBudgetMs: Infinity })
    renderer.update(0.016)
    expect(brokenCount(meshes)).toBe(PART_COUNT)
  })
})
