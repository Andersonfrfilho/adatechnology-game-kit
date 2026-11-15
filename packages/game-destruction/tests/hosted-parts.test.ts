import { describe, expect, it } from 'vitest'

import { assemblyPart, createDestruction } from '../src'
import type { DestructibleSpec, JointSpec, PartSpec } from '../src'
import { ofType } from './wall-helpers'

/** A plastered brick wall of 6 x 2.1 m with a run of pipe stretches embedded in it at 1 m, each of 1.5 m: x -2.25 to 2.25 and a free one past each end. */
const STRETCHES = [-2.25, -0.75, 0.75, 2.25] as const
const stretchId = (index: number): string => `pipe:${index}`

const pipeSpec = (index: number, x: number): PartSpec => ({
  id: stretchId(index), material: 'plastic', shape: { kind: 'box', size: [1.5, 0.1, 0.1] }, position: [x, 1, 0], mass: 1, hostedIn: 'wall', tags: ['pipe'],
})

const specOf = (): DestructibleSpec => {
  const wall = assemblyPart('brick_wall_plastered', { id: 'wall', width: 6, height: 2.1, position: [0, 1.05, 0] })
  const clips: JointSpec[] = STRETCHES.map((_, index) => ({ a: stretchId(index), b: 'wall', kind: 'clip', bears: false }))
  const sockets: JointSpec[] = STRETCHES.slice(1).map((_, index) => ({ a: stretchId(index), b: stretchId(index + 1), kind: 'glue', bears: false }))
  return { parts: [{ ...wall, anchored: true }, ...STRETCHES.map((x, index) => pipeSpec(index, x))], joints: [...clips, ...sockets] }
}

const worldOf = () => {
  const world = createDestruction({ seed: 7 })
  const id = world.add(specOf())
  const events = [] as ReturnType<typeof world.update>
  world.on('*', (event) => events.push(event))
  return { world, id, events }
}

describe('a part embedded in a host (hostedIn)', () => {
  it('stays hidden and held while the host stands whole', () => {
    const { world, id } = worldOf()
    for (const index of STRETCHES.keys()) expect(world.part(id, stretchId(index))!.exposed).toBeUndefined()
    expect(world.state(id)!.joints.every((joint) => !joint.open)).toBe(true)
  })

  it('shows, and comes off the host, only where a blast hole reaches it; the stretches beside it keep it and stay hidden', () => {
    const { world, id, events } = worldOf()
    // a charge of 20 kJ against the face of the wall over the second stretch (x -0.75)
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)
    const revealed = ofType(events, 'reveal').map((event) => event.part)
    expect(revealed).toContain(stretchId(1))
    expect(world.part(id, stretchId(1))!.exposed).toBe(true)
    // the stretch in the hole came off the wall; the ones at either side are still embedded
    const joints = world.state(id)!.joints
    expect(joints.find((joint) => joint.id === `${stretchId(1)}~wall`)!.open).toBe(true)
    for (const index of [0, 2, 3]) {
      expect(world.part(id, stretchId(index))!.exposed, stretchId(index)).toBeUndefined()
      expect(joints.find((joint) => joint.id === `${stretchId(index)}~wall`)!.open, stretchId(index)).toBe(false)
    }
    // it still hangs by the glued sockets to the stretches that are held: it is not a loose piece
    const groups = world.state(id)!.groups
    expect(groups.find((group) => group.includes(stretchId(1)))).toContain('wall')
  })

  it('says it once per part, however many blasts follow', () => {
    const { world, events } = worldOf()
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)
    const revealed = ofType(events, 'reveal').map((event) => event.part)
    expect(new Set(revealed).size).toBe(revealed.length)
  })
})
