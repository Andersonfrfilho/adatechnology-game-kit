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

/** An object `o1` whose parts come in the given groups (the first one stays the object), bound, with a detach that left the rest loose. */
function grouped(groups: string[][], options: Partial<RendererOptions>, objectId = 'o1', at = 0) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: 8, ...options })
  const add = (id: string, parts: string[][], x: number): void => {
    const ids = parts.flat()
    world.addObject(id, ids.map((part) => partState(part, 'wood')), parts.map((group) => [...group]))
    const root = new THREE.Group()
    const meshes: Record<string, THREE.Mesh> = {}
    ids.forEach((part, index) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
      mesh.position.set(x + index, 0.1, 0)
      meshes[part] = mesh
      root.add(mesh)
    })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: meshes })
  }
  add(objectId, groups, at)
  const detach = (id: string): void => {
    const st = world.state(id)!
    world.emit({ type: 'detach', object: id, joint: 'j', parts: st.parts.map((part) => part.id), by: 'break', groups: st.groups })
  }
  detach(objectId)
  const partsOf = (newId: string): string[] => world.state(newId)?.parts.map((part) => part.id) ?? []
  return { renderer, world, add, detach, partsOf }
}

const splitQueueOf = (renderer: ReturnType<typeof createDestructionRenderer>): { readonly size: number } => (renderer as unknown as { splitQueue: { size: number } }).splitQueue

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the work budget defaults (spec 008, evidence T3.8aa)', () => {
  it('are the numbers the first calibration measured, and each one can be set', () => {
    expect(DEFAULT_WORK_BUDGET_MS).toBe(4)
    expect(DEFAULT_WORK_UNITS_PER_MS).toBe(100)
    expect(DEFAULT_MAX_WAIT_FRAMES).toBe(12)
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

  it('none stands loose past maxWaitFrames frames, whatever the budget', () => {
    const { renderer, world } = looseRow({ workBudget: { ...ONE_A_FRAME, maxWaitFrames: 2 } })
    // frame 1: one in the event, five queued; frame 2: one (the queue always moves); frame 3, their second release: the four left go together
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(1)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(2)
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

describe('a loose group waiting its turn when the object changes under it', () => {
  it('its smallest part shattered meanwhile, the rest of the group still becomes a piece at its turn', () => {
    const { renderer, world, partsOf } = grouped([['a'], ['b1', 'b2'], ['c1', 'c2']], { workBudget: ONE_A_FRAME })
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(1)
    // c1 broke away into fragments: the group left loose holds c2 alone
    world.state('o1')!.groups[1] = ['c2']
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(2)
    expect(partsOf(world.splits[1]!.newId)).toEqual(['c2'])
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('its group now the object itself, the groups loose now take its place in the queue', () => {
    const { renderer, world, partsOf } = grouped([['a'], ['b'], ['c1', 'c2']], { workBudget: ONE_A_FRAME })
    renderer.update(FRAME)
    // what held the object went (the world renumbered): the waiting group is group 0 and `a` hangs loose
    world.state('o1')!.groups = [['c1', 'c2'], ['a']]
    renderer.update(FRAME)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(2)
    expect(partsOf(world.splits[1]!.newId)).toEqual(['a'])
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('a waiting group broken in two before its turn becomes two pieces, none left in the object', () => {
    const { renderer, world, partsOf } = grouped([['a'], ['b'], ['p3', 'p4', 'p5']], { workBudget: { ...ONE_A_FRAME, maxWaitFrames: 3 } })
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(1)
    // a second blow splits the waiting group into two loose groups
    world.state('o1')!.groups = [['a'], ['p3'], ['p4', 'p5']]
    for (let frame = 0; frame < 4 && (world.state('o1')?.groups.length ?? 0) > 1; frame++) renderer.update(FRAME)
    expect(world.splits.map((split) => partsOf(split.newId))).toEqual([['b'], ['p3'], ['p4', 'p5']])
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('unbind and release take the object\'s waiting groups out of the queue', () => {
    const first = grouped([['a'], ['b'], ['c'], ['d']], { workBudget: ONE_A_FRAME })
    first.renderer.update(FRAME)
    expect(splitQueueOf(first.renderer).size).toBe(2)
    first.renderer.unbind('o1')
    expect(splitQueueOf(first.renderer).size).toBe(0)
    const second = grouped([['a'], ['b'], ['c'], ['d']], { workBudget: ONE_A_FRAME })
    second.renderer.update(FRAME)
    second.renderer.release('o1')
    expect(splitQueueOf(second.renderer).size).toBe(0)
    for (let frame = 0; frame < 4; frame++) second.renderer.update(FRAME)
    expect(second.world.splits).toHaveLength(1)
  })

  it('a blow in a frame the queue already split in still breaks something at once', () => {
    const { renderer, world, add, detach, partsOf } = grouped([['a'], ['b'], ['c'], ['d']], { workBudget: ONE_A_FRAME })
    renderer.update(FRAME)
    add('o2', [['x'], ['y'], ['z']], 20)
    detach('o2')
    // the queue lets `b`'s neighbour out first, then o2's blow splits its first loose group in the same frame
    renderer.update(FRAME)
    expect(world.splits.map((split) => partsOf(split.newId)[0])).toEqual(['b', 'c', 'y'])
  })
})

describe('a save taken while loose groups wait', () => {
  /** What a save holds of `o1`: its parts and groups (the split queue is not in it). */
  const savedMidWait = () => {
    const first = looseRow({ workBudget: ONE_A_FRAME })
    first.renderer.update(FRAME)
    first.renderer.update(FRAME)
    expect(first.world.splits).toHaveLength(2)
    const state = structuredClone(first.world.state('o1')!)
    expect(state.groups).toHaveLength(5)
    return state
  }

  it('loaded into a new renderer, every loose group splits within the wait ceiling', () => {
    const saved = savedMidWait()
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), workBudget: { budgetMs: 0, maxWaitFrames: 3 } })
    world.addObject('o1', saved.parts, saved.groups)
    const root = new THREE.Group()
    const meshes: Record<string, THREE.Mesh> = {}
    saved.parts.forEach((part, index) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
      mesh.position.set(index, 0.1, 0)
      meshes[part.id] = mesh
      root.add(mesh)
    })
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: meshes })
    // frame 1 queues the four loose groups; frames 2 and 3 let one out each; frame 4, their third release, the rest
    const counts: number[] = []
    for (let frame = 0; frame < 4; frame++) {
      renderer.update(FRAME)
      counts.push(world.splits.length)
    }
    expect(counts).toEqual([0, 1, 2, 4])
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('put back into the same renderer and drawn again, the loose groups split', () => {
    const { renderer, world } = grouped([['a', 'b', 'c']], { workBudget: ONE_A_FRAME })
    renderer.update(FRAME)
    // the world loads the object with two groups loose (`DestructionWorld.loadObject`), the host draws it again
    world.state('o1')!.groups = [['a'], ['b'], ['c']]
    renderer.redraw('o1')
    for (let frame = 0; frame < 3; frame++) renderer.update(FRAME)
    expect(world.splits).toHaveLength(2)
    expect(world.state('o1')?.groups).toHaveLength(1)
  })

  it('without the budget a redraw queues nothing: the loose groups split in the next update', () => {
    const { renderer, world } = grouped([['a', 'b', 'c']], {})
    renderer.update(FRAME)
    world.state('o1')!.groups = [['a'], ['b'], ['c']]
    renderer.redraw('o1')
    expect(splitQueueOf(renderer).size).toBe(0)
    expect(world.splits).toHaveLength(0)
    renderer.update(FRAME)
    expect(splitQueueOf(renderer).size).toBe(0)
    expect(world.splits).toHaveLength(2)
    expect(world.state('o1')?.groups).toHaveLength(1)
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
