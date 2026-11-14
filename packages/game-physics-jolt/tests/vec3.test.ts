import { describe, expect, it } from 'vitest'

import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { checkVec3Layout, vec3At } from '../src/vec3'

describe('Vec3 read from the heap', () => {
  it('the layout check passes, and a body\'s vectors read from the heap are the ones GetX, GetY and GetZ give', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({}) as JoltWorld
    const J = world.J
    expect(() => checkVec3Layout(J)).not.toThrow()
    const id = world.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 3, position: [1.25, 7.5, -3.125], user: 1 })
    world.setVelocity(id, [0.1, -2.5, 3.75], [1.5, 0.3, -0.7])
    const body = world.entry(id).body
    const heap = J.HEAPF32
    for (const v of [body.GetLinearVelocity(), body.GetAngularVelocity(), body.GetCenterOfMassPosition()]) {
      const at = vec3At(J, v)
      expect([heap[at], heap[at + 1], heap[at + 2]]).toEqual([v.GetX(), v.GetY(), v.GetZ()])
    }
    world.dispose()
  })
})
