import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec } from '../src'
import { ofType, runFor } from './wall-helpers'

const rests = (a: string, b: string, kind: JointSpec['kind'] = 'mortar'): JointSpec => ({ a, b, kind, bears: 'a_on_b' })
const WALL_HEIGHT = 1.1

/**
 * A 10 m wall of bricks 1.1 m tall on two ground beams in line (`gb_a` 6 m, `gb_c` 4 m), a 30 cm slab resting on that wall alone, and beside them a second wall on
 * its own ground beam carrying a block. A void under `gb_a` opens the low wall to its top: the slab cannot span the opening and drops (`hingeDrop`). The wall stands
 * on both beams, so the slab's weight went down `gb_c` too: the same loss judges `gb_c` next, over the edge of the void, and it bends under what it carries after
 * the drop (1.35 t), not under the slab it carried before (about 5.4 t).
 */
const spec = (): DestructibleSpec => {
  const parts: PartSpec[] = [
    { id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [20, 0.5, 20] }, position: [5, -0.25, 1] },
    { id: 'gb_a', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [6, 0.3, 0.15] }, position: [3, -0.15, 0] },
    { id: 'wall_a', material: 'brick', structure: { role: 'wall' }, units: { size: [0.19, 0.09, 0.14], bond: 'running', mortar: 'mortar' }, shape: { kind: 'box', size: [10, WALL_HEIGHT, 0.15] }, position: [5, WALL_HEIGHT / 2, 0] },
    { id: 'gb_b', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [10, 0.3, 0.15] }, position: [5, -0.15, 3] },
    { id: 'wall_b', material: 'brick', structure: { role: 'wall' }, shape: { kind: 'box', size: [10, WALL_HEIGHT + 0.1, 0.15] }, position: [5, (WALL_HEIGHT + 0.1) / 2, 3] },
    { id: 'gb_c', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [4, 0.3, 0.15] }, position: [8, -0.15, 0] },
    { id: 'slab', material: 'concrete', structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.008 }, shape: { kind: 'box', size: [10, 0.3, 1] }, position: [5, WALL_HEIGHT + 0.15, -0.4] },
    { id: 'block', material: 'concrete', structure: { role: 'column' }, shape: { kind: 'box', size: [4, 0.3, 3.15] }, position: [5, WALL_HEIGHT + 0.25, 1.5] },
  ]
  const joints: JointSpec[] = [
    rests('gb_a', 'ground', 'rebar'), rests('gb_b', 'ground', 'rebar'), rests('wall_a', 'gb_a'), rests('wall_a', 'gb_c'), rests('gb_c', 'ground', 'rebar'),
    rests('wall_b', 'gb_b'), rests('slab', 'wall_a'), rests('block', 'wall_b'),
  ]
  return { name: 'drop', tags: ['structure'], parts, joints }
}

// what the world gave when it solved the structure at each change (1cb39c001, before the structure was solved once per operation); without the structure solved
// again before `gb_c` is judged, it is judged with the slab still on it and goes down 0.81865 mm instead of 0.81843 mm
const GB_C_SUBSIDENCE = 0.0008184313831530404
const RECORDED: ReadonlyArray<readonly [string, string, number]> = [
  ['gb_a', 'damaged', 1559.8184999999996],
  ['wall_a', 'damaged', 1877.6369999999995],
  ['gb_c', 'intact', 1352.8184999999999],
  ['slab', 'collapsed', 6900],
  ['gb_b', 'intact', 13149],
]

describe('a ground loss that drops a slab and then judges another ground beam under the same wall', () => {
  it('judges the second beam with the load it carries after the drop, as when each change was solved at once', () => {
    const world = createDestruction({ seed: 3 })
    const id = world.add(spec())
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    world.groundLoss({ x: 4, z: 0, radius: 3, depth: 1.5, source: 'crater' })
    runFor(world, 3)
    expect(ofType(events, 'collapse').flatMap((e) => e.parts)).toEqual(['slab'])
    expect(ofType(events, 'subside').map((e) => [e.part, e.status])).toEqual([['gb_a', 'opened'], ['gb_c', 'bridged']])
    expect(world.part(id, 'gb_c')!.subsidence).toBeCloseTo(GB_C_SUBSIDENCE, 10)
    for (const [part, status, load] of RECORDED) {
      expect(world.part(id, part)!.status).toBe(status)
      expect(world.part(id, part)!.load).toBeCloseTo(load, 6)
    }
  })
})
