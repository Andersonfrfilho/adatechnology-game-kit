import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import { createDestructionRenderer } from '../src/renderer'
import { SettledBatches } from '../src/settled-batches'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const PROMPT = { minMeshes: 1, intervalSeconds: 0, budgetMs: Infinity } as const

/** Debris at rest: `perMaterial` boxes of each of two materials, in a scene. */
const restingDebris = (perMaterial: number): { scene: THREE.Scene; meshes: THREE.Mesh[] } => {
  const scene = new THREE.Scene()
  const materials = [new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), new THREE.MeshLambertMaterial({ color: 0x777777 })]
  const meshes = materials.flatMap((material, kind) =>
    Array.from({ length: perMaterial }, (_, index) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), material)
      mesh.position.set(index, 0.1, kind)
      scene.add(mesh)
      return mesh
    }),
  )
  scene.updateMatrixWorld(true)
  return { scene, meshes }
}

describe('settled debris batches as a deferred queue', () => {
  it('keeps the DeferredQueue contract', () => {
    const { scene, meshes } = restingDebris(3)
    const batches = new SettledBatches(THREE, scene, PROMPT)
    const fill = (): void => {
      batches.queue.attach?.()
      batches.update(0.016, () => meshes)
    }
    expect(batches.queue.id).toBe(DEFERRED_QUEUE_ID.SETTLED_BATCH)
    expect(checkDeferredQueue(batches.queue, fill)).toEqual({ ok: true, problems: [] })
  })

  it('merges nothing in update once a budget attached it, one material per unit', () => {
    const { scene, meshes } = restingDebris(3)
    const batches = new SettledBatches(THREE, scene, PROMPT)
    batches.queue.attach?.()
    batches.update(0.016, () => meshes)
    batches.update(0.016, () => meshes)
    expect(batches.stats()).toEqual({ batches: 0, batched: 0 })
    expect(batches.queue.pending()).toBe(2)
    expect(batches.queue.run(0, () => 1)).toBe(1)
    expect(batches.stats().batched).toBe(3)
    batches.queue.run(Infinity, () => 0)
    expect(batches.stats()).toEqual({ batches: 2, batched: 6 })
    expect(batches.queue.pending()).toBe(0)
  })

  it('drains by itself with no budget, as before, and goes back to it on detach', () => {
    const { scene, meshes } = restingDebris(3)
    const batches = new SettledBatches(THREE, scene, PROMPT)
    batches.update(0.016, () => meshes)
    batches.update(0.016, () => meshes)
    expect(batches.stats()).toEqual({ batches: 2, batched: 6 })
    batches.clear()
    batches.queue.attach?.()
    batches.queue.detach?.()
    batches.update(0.016, () => meshes)
    batches.update(0.016, () => meshes)
    expect(batches.stats().batched).toBe(6)
  })

  it('a release drops the merges still waiting', () => {
    const { scene, meshes } = restingDebris(3)
    const batches = new SettledBatches(THREE, scene, PROMPT)
    batches.queue.attach?.()
    batches.update(0.016, () => meshes)
    batches.queue.run(0, () => 1)
    batches.release([meshes[0]!])
    expect(batches.queue.pending()).toBe(0)
    expect(batches.stats()).toEqual({ batches: 0, batched: 0 })
  })
})

const PART_IDS = ['wall', 'beam', 'post'] as const

/** An object whose parts are ranges of one merged mesh: the fits ahead of the blow wait in the prefit queue. */
const mergedHouse = () => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const position: number[] = []
  const index: number[] = []
  const ranges: Array<[number, number]> = []
  PART_IDS.forEach((_, part) => {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(part * 2, 0, 0)
    const base = position.length / 3
    position.push(...Array.from(box.getAttribute('position').array))
    for (const i of Array.from(box.getIndex()!.array)) index.push(i + base)
    ranges.push([base, position.length / 3])
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', PART_IDS.map((id) => partState(id, 'wood')), [[...PART_IDS]])
  const bind = (): void => renderer.bind('house', root, { parts: Object.fromEntries(PART_IDS.map((id, part) => [id, { mesh, range: ranges[part]! }])) })
  return { renderer, bind }
}

const queueOf = (renderer: ReturnType<typeof createDestructionRenderer>, id: string): DeferredQueue => renderer.deferredQueues().find((entry) => entry.queue.id === id)!.queue

describe('the renderer queues', () => {
  it('registers the events as mustDrain and the others with the kit priorities', () => {
    const { renderer } = mergedHouse()
    const byId = new Map(renderer.deferredQueues().map((entry) => [entry.queue.id, entry.options]))
    expect([...byId.keys()].sort()).toEqual([DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS, DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT, DEFERRED_QUEUE_ID.SETTLED_BATCH].sort())
    expect(byId.get(DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS)).toEqual({ ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS], mustDrain: true })
    expect(byId.get(DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT)).toEqual(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT])
    expect(byId.get(DEFERRED_QUEUE_ID.SETTLED_BATCH)).toEqual(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.SETTLED_BATCH])
    expect(renderer.deferredQueue()).toBe(queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS))
  })

  it('keeps the DeferredQueue contract for the fits ahead', () => {
    const { renderer, bind } = mergedHouse()
    expect(checkDeferredQueue(queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT), bind)).toEqual({ ok: true, problems: [] })
  })

  it('the events queue does not wait for the fits ahead, and does not run them once the prefit queue is attached', () => {
    const { renderer, bind } = mergedHouse()
    const events = queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS)
    const prefit = queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT)
    prefit.attach?.()
    events.attach?.()
    bind()
    const waiting = prefit.pending()
    expect(waiting).toBeGreaterThan(0)
    expect(events.pending()).toBe(0)
    events.run(Infinity, () => 0)
    events.flush()
    expect(prefit.pending()).toBe(waiting)
    prefit.run(Infinity, () => 0)
    expect(prefit.pending()).toBe(0)
  })

  it('without a budget on the prefit queue, the events drain still fits ahead', () => {
    const { renderer, bind } = mergedHouse()
    const prefit = queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_PREFIT)
    bind()
    expect(prefit.pending()).toBeGreaterThan(0)
    queueOf(renderer, DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS).flush()
    expect(prefit.pending()).toBe(0)
  })
})
