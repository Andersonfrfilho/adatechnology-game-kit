import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec } from '../src'
import { ofType, runFor } from './wall-helpers'

const rests = (a: string, b: string, kind: JointSpec['kind'] = 'mortar'): JointSpec => ({ a, b, kind, bears: 'a_on_b' })

/**
 * A 10 m wall of bricks 1.1 m tall on its ground beam (`gb_a`), a slab resting on it alone, and a heavy slab (`bb`) resting on that slab and on a second wall
 * on its own ground beam (`gb_b`) across the end of the first. A void under the middle of `gb_a` opens the low wall to its top: the slab cannot span it and
 * drops (`hingeDrop`), and `bb` is left on the second wall alone, whose ground beam the same loss judges next with the load it carries after the drop.
 */
const spec = (): DestructibleSpec => {
  const parts: PartSpec[] = [
    { id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [20, 0.5, 20] }, position: [4, -0.25, 3] },
    { id: 'gb_a', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [10, 0.3, 0.15] }, position: [5, -0.15, 0] },
    { id: 'wall_a', material: 'brick', structure: { role: 'wall' }, units: { size: [0.19, 0.09, 0.14], bond: 'running', mortar: 'mortar' }, shape: { kind: 'box', size: [10, 1.1, 0.15] }, position: [5, 0.55, 0] },
    { id: 'gb_b', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [0.15, 0.3, 6] }, position: [7.2, -0.15, 3.1] },
    { id: 'wall_b', material: 'brick', structure: { role: 'wall' }, shape: { kind: 'box', size: [0.15, 1.1, 6] }, position: [7.2, 0.55, 3.1] },
    { id: 'slab', material: 'concrete', structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.008 }, shape: { kind: 'box', size: [10, 0.1, 1] }, position: [5, 1.15, 0.4] },
    { id: 'bb', material: 'concrete', structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.008 }, shape: { kind: 'box', size: [3, 0.25, 1] }, position: [6, 1.325, 0.4] },
  ]
  const joints: JointSpec[] = [rests('gb_a', 'ground', 'rebar'), rests('gb_b', 'ground', 'rebar'), rests('wall_a', 'gb_a'), rests('wall_b', 'gb_b'), rests('slab', 'wall_a'), rests('bb', 'slab'), rests('bb', 'wall_b')]
  return { name: 'drop', tags: ['structure'], parts, joints }
}

// what the world gave when it solved the structure at each change (before the structure was solved once per operation)
const RECORDED: ReadonlyArray<readonly [string, string, number, number]> = [
  ['gb_a', 'damaged', 2957.5815000000002, 0.36406763170493156],
  ['wall_a', 'damaged', 1922.5815000000005, 0.05],
  ['gb_b', 'intact', 4227, 0.0013994745188161183],
  ['wall_b', 'damaged', 3606, 0],
  ['slab', 'collapsed', 2300, Number.NaN],
  ['bb', 'intact', 1725, Number.NaN],
]

describe('a ground loss that drops a slab and then judges another ground beam', () => {
  it('judges the second beam with the load it carries after the drop: the same parts fall, with the same loads, as when each change was solved at once', () => {
    const world = createDestruction({ seed: 3 })
    const id = world.add(spec())
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    world.groundLoss({ x: 5, z: 0, radius: 2.5, depth: 1.5, source: 'crater' })
    runFor(world, 3)
    expect(ofType(events, 'collapse').flatMap((e) => e.parts)).toEqual(['slab'])
    expect(ofType(events, 'detach').map((e) => e.joint)).toEqual(['slab~wall_a'])
    expect(ofType(events, 'subside').map((e) => e.part)).toEqual(expect.arrayContaining(['gb_a', 'gb_b']))
    for (const [part, status, load, subsidence] of RECORDED) {
      const state = world.part(id, part)!
      expect(state.status).toBe(status)
      expect(state.load).toBeCloseTo(load, 6)
      if (Number.isNaN(subsidence)) expect(state.subsidence).toBeUndefined()
      else expect(state.subsidence).toBeCloseTo(subsidence, 9)
    }
  })
})
