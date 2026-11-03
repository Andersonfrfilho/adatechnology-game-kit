import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { checkDeferredQueue } from '@adatechnology/game-contracts'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'

const PART_COUNT = 5

function setup(options: Partial<RendererOptions> = {}) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), ...options })
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
  const breakAll = (): void => {
    for (const id of ids) world.emit({ type: 'fracture', object: 'o1', part: id, style: 'shatter', fragments: [], point: [0, 0, 0] })
  }
  return { renderer, meshes, breakAll }
}

const brokenCount = (meshes: Record<string, THREE.Mesh>): number => Object.values(meshes).filter((mesh) => !mesh.visible).length

describe('events as a deferred queue', () => {
  it('keeps the DeferredQueue contract', () => {
    const { renderer, breakAll } = setup()
    expect(checkDeferredQueue(renderer.deferredQueue(), breakAll)).toEqual({ ok: true, problems: [] })
  })

  it('keeps draining inside update until a budget attaches it, and asking for the queue changes nothing', () => {
    const { renderer, meshes, breakAll } = setup()
    renderer.deferredQueue()
    breakAll()
    renderer.update(0.016)
    expect(brokenCount(meshes)).toBe(PART_COUNT)
  })

  it('stops draining inside update once attached; running it without a limit gives the same result as the synchronous option', () => {
    const synchronous = setup({ eventBudgetMs: Infinity })
    synchronous.breakAll()
    synchronous.renderer.update(0.016)

    const attached = setup()
    const queue = attached.renderer.deferredQueue()
    queue.attach?.()
    attached.breakAll()
    attached.renderer.update(0.016)
    expect(brokenCount(attached.meshes)).toBe(0)
    expect(queue.pending()).toBe(PART_COUNT)
    queue.run(Infinity, () => 0)
    expect(brokenCount(attached.meshes)).toBe(brokenCount(synchronous.meshes))
    expect(queue.pending()).toBe(0)
  })

  it('applies one event per call with a deadline already past and carries the rest in order', () => {
    const { renderer, meshes, breakAll } = setup()
    const queue = renderer.deferredQueue()
    queue.attach?.()
    breakAll()
    for (let call = 1; call <= PART_COUNT; call++) {
      expect(queue.run(0, () => 1)).toBe(1)
      expect(brokenCount(meshes)).toBe(call)
    }
  })

  it('goes back to draining inside update on detach', () => {
    const { renderer, meshes, breakAll } = setup()
    const queue = renderer.deferredQueue()
    queue.attach?.()
    queue.detach?.()
    breakAll()
    renderer.update(0.016)
    expect(brokenCount(meshes)).toBe(PART_COUNT)
  })
})
