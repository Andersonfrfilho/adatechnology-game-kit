import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAX_WAIT_FRAMES, DEFAULT_WORK_BUDGET_MS, DEFAULT_WORK_UNITS_PER_MS } from '@adatechnology/game-physics'

import { WORK_UNIT_DEFAULTS, resolveWorkUnitCosts, splitWorkUnits } from '../src/blast-debris'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const LOOSE = 6
const FRAME = 1 / 60
/** A budget that holds less than one split: one group a frame (the queue always moves one). */
const ONE_A_FRAME = { budgetMs: 0.01 }

/** An object of `LOOSE + 1` parts in a row along x (part0 at x 0, part1 at 1 m...), every part but part0 loose. */
function looseRow(options: Partial<RendererOptions>) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: 8, ...options })
  const ids = Array.from({ length: LOOSE + 1 }, (_, index) => `part${index}`)
  world.addObject('o1', ids.map((id) => partState(id, 'wood')), ids.map((id) => [id]))
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  ids.forEach((id, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    mesh.position.set(index, 0.1, 0)
    meshes[id] = mesh
    root.add(mesh)
  })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  world.emit({ type: 'detach', object: 'o1', joint: 'j', parts: ids, by: 'break', groups: ids.map((id) => [id]) })
  const splitParts = (): string[] => world.splits.map((split) => world.state(split.newId)?.parts[0]?.id ?? '?')
  return { renderer, world, root, meshes, splitParts }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the work budget defaults (spec 008, evidence T3.8aa)', () => {
  it('are the numbers the first calibration measured, and each one can be set', () => {
    expect(DEFAULT_WORK_BUDGET_MS).toBe(4)
    expect(DEFAULT_WORK_UNITS_PER_MS).toBe(100)
    expect(DEFAULT_MAX_WAIT_FRAMES).toBe(30)
    expect(WORK_UNIT_DEFAULTS).toEqual({ perSplit: 120, perVertex: 0.05, perHostVertex: 0.01, perObjectPart: 0.3, perFragment: 4, perEvent: 40, perWake: 2 })
    expect(resolveWorkUnitCosts({ perSplit: 7 }).perSplit).toBe(7)
    expect(resolveWorkUnitCosts({ perSplit: 7 }).perVertex).toBe(WORK_UNIT_DEFAULTS.perVertex)
    // a split is charged by the size of its work: 120 + 0.05 × 1000 vertices + 0.01 × 2000 host vertices + 0.3 × 10 parts
    expect(splitWorkUnits(WORK_UNIT_DEFAULTS, { vertices: 1000, hostVertices: 2000, objectParts: 10 })).toBeCloseTo(193)
  })
})

describe('loose groups under the work budget', () => {
  it('without the budget the clock cuts them as before: every one in the first frame with time to spare', () => {
    const { renderer, world } = looseRow({ eventBudgetMs: Infinity })
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(LOOSE)
  })

  it('become pieces one a frame when one split fills the budget: the first in the frame of the blow, then nearest the player first', () => {
    // the player stands past the far end of the row: part6 is nearest; the first group of the frame splits in the event, in the world's order
    const { renderer, world, splitParts } = looseRow({ workBudget: ONE_A_FRAME, focus: () => [10, 0, 0] })
    for (let frame = 1; frame <= LOOSE; frame++) {
      renderer.update(FRAME)
      expect(world.splits).toHaveLength(frame)
    }
    expect(splitParts()).toEqual(['part1', 'part6', 'part5', 'part4', 'part3', 'part2'])
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('without a player the order is the stable id order', () => {
    const { renderer, splitParts } = looseRow({ workBudget: ONE_A_FRAME })
    for (let frame = 0; frame < LOOSE; frame++) renderer.update(FRAME)
    expect(splitParts()).toEqual(['part1', 'part2', 'part3', 'part4', 'part5', 'part6'])
  })

  it('a budget that holds them all splits every one in the frame of the event, in the same order as without the budget', () => {
    const { renderer, world, splitParts } = looseRow({ workBudget: { budgetMs: 100 }, focus: () => [10, 0, 0] })
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(LOOSE)
    const without = looseRow({ eventBudgetMs: Infinity })
    without.renderer.update(FRAME)
    expect(splitParts()).toEqual(without.splitParts())
  })

  it('a group waiting its turn stays in its object, drawn where it stood', () => {
    const { renderer, root, meshes } = looseRow({ workBudget: ONE_A_FRAME, focus: () => [10, 0, 0] })
    renderer.update(FRAME)
    // part1 split in the frame of the blow; part2 still waits in the object, drawn, under the object's root, where it was
    expect(meshes.part1!.parent).not.toBe(root)
    expect(meshes.part2!.parent).toBe(root)
    expect(meshes.part2!.visible).toBe(true)
    expect(meshes.part2!.position.x).toBe(2)
    expect(renderer.pieces().length).toBe(1)
  })

  it('none waits past maxWaitFrames, whatever the budget', () => {
    const { renderer, world } = looseRow({ workBudget: { ...ONE_A_FRAME, maxWaitFrames: 2 } })
    // frame 1: one in the event, five queued; frames 2 and 3: one each (the queue always moves); frame 4: the three that waited 2 frames go together
    renderer.update(FRAME)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(2)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(3)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(LOOSE)
  })

  it('never reads the clock to decide: a clock 1000 times faster cuts the same groups in the same frames', () => {
    const run = (msPerCall: number): number[] => {
      let now = 0
      vi.spyOn(performance, 'now').mockImplementation(() => (now += msPerCall))
      const { renderer, world } = looseRow({ workBudget: { budgetMs: 2.5, costs: { perSplit: 100 } }, focus: () => [10, 0, 0] })
      const counts: number[] = []
      for (let frame = 0; frame < LOOSE; frame++) {
        renderer.update(FRAME)
        counts.push(world.splits.length)
      }
      vi.restoreAllMocks()
      return counts
    }
    const slow = run(50)
    const fast = run(0.05)
    expect(slow).toEqual(fast)
    // 250 units a frame, 40 for the event and ~103 per split: two in the event's frame, then two a frame
    expect(slow[0]).toBe(2)
  })

  it('a flush splits everything still waiting', () => {
    const { renderer, world } = looseRow({ workBudget: ONE_A_FRAME })
    renderer.deferredQueue().flush()
    expect(world.splits).toHaveLength(LOOSE)
  })

  it('a tier twice as slow holds half the units: the same groups take twice the frames', () => {
    const frames = (tier: number): number => {
      const { renderer, world } = looseRow({ workBudget: { budgetMs: 4, tier, costs: { perSplit: 190, perEvent: 0 } } })
      let n = 0
      while (world.splits.length < LOOSE && n < 50) {
        renderer.update(FRAME)
        n++
      }
      return n
    }
    // 400 units at tier 1: two splits of ~190 a frame (3 frames); 200 at tier 2: one a frame (6 frames)
    expect(frames(1)).toBe(3)
    expect(frames(2)).toBe(6)
  })
})

describe('fragments under the work budget', () => {
  it('the part is hidden in the frame of the fracture and the fragments come over the next frames, all of them', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), workBudget: { budgetMs: 0.5 } })
    world.addObject('o1', [partState('top', 'glass')])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { top: mesh } })
    const fragments = Array.from({ length: 40 }, (_, index) => ({
      id: `f${index}`, part: 'top', material: 'glass', shape: 'shard' as const, center: [index * 0.01, 1.5, 0] as [number, number, number], size: [0.2, 0.15, 0.01] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number], velocity: [1, 2, 0.5] as [number, number, number], angularVelocity: [4, 3, 2] as [number, number, number], mass: 0.2,
    }))
    world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'shatter', fragments, point: [0, 1.5, 0] })
    renderer.update(FRAME)
    expect(mesh.visible).toBe(false)
    // 50 units: the event takes 40, then the first 8 fragments always come
    expect(renderer.stats().fragments).toBe(8)
    let frames = 1
    while (renderer.stats().fragments < 40 && frames < 40) {
      renderer.update(FRAME)
      frames++
    }
    expect(renderer.stats().fragments).toBe(40)
    expect(frames).toBeGreaterThan(2)
  })
})
