import { describe, expect, it } from 'vitest'

import { countByType, wallWorld } from './wall-helpers'

describe('a blast after the object moved', () => {
  it('measures the second blast against the new pose: nothing where the wall was, damage where it is', () => {
    const { world, objectId, events } = wallWorld('brick_wall_plastered')
    world.explode([0, 1, 0.3], 30000, 4)
    events.length = 0
    world.setTransform(objectId, [20, 0, 0], [0, 0, 0, 1])
    world.explode([0, 1, 0.3], 30000, 4)
    expect(countByType(events).damage ?? 0).toBe(0)
    world.explode([20, 1, 0.3], 30000, 4)
    expect(countByType(events).damage ?? 0).toBeGreaterThan(0)
  })
})
