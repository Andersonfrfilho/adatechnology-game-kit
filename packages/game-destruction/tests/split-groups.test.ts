import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionWorld } from '../src'

/** A slab on the ground and eight bricks lying apart on it: each brick is a loose group of its own from the start. */
const yard = (): DestructibleSpec => ({
  name: 'yard',
  parts: [
    { id: 'slab', material: 'concrete', anchored: true, shape: { kind: 'box', size: [6, 0.2, 6] }, position: [0, -0.1, 0] },
    ...Array.from({ length: 8 }, (_, k) => ({ id: `brick${k}`, material: 'brick', shape: { kind: 'box' as const, size: [0.19, 0.09, 0.09] as [number, number, number] }, position: [-2.5 + k * 0.7, 0.6, 0] as [number, number, number] })),
  ],
  joints: [],
})

const worldWithYard = (): { world: DestructionWorld; id: string } => {
  const world = createDestruction({ seed: 3 })
  const id = world.add(yard(), { id: 'yard' })
  return { world, id }
}

describe('several loose groups split at once', () => {
  it('gives the same objects, ids and states as splitting them one after another, and the world goes on the same', () => {
    const one = worldWithYard()
    const loose = (one.world.state(one.id)?.groups.length ?? 0) - 1
    expect(loose).toBeGreaterThan(3)
    const sequential: string[] = []
    for (let k = 0; k < loose; k++) sequential.push(one.world.splitGroup(one.id, 1))

    const all = worldWithYard()
    const batch = all.world.splitGroups(all.id, Array.from({ length: loose }, (_, k) => k + 1))

    expect(batch).toEqual(sequential)
    expect(JSON.stringify(all.world.serialize())).toBe(JSON.stringify(one.world.serialize()))
    for (const w of [one.world, all.world]) {
      w.hit(one.id, { type: 'explosive', point: [0, 0.3, 0], energy: 4e5, radius: 3 })
      for (let t = 0; t < 1; t += 1 / 30) w.update(1 / 30)
    }
    expect(JSON.stringify(all.world.serialize())).toBe(JSON.stringify(one.world.serialize()))
  })

  it('refuses the main group and a group that does not exist', () => {
    const { world, id } = worldWithYard()
    expect(() => world.splitGroups(id, [0])).toThrow()
    expect(() => world.splitGroups(id, [99])).toThrow()
  })
})
