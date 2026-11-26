import { describe, expect, it } from 'vitest'

import { createJoltEngine } from '../src/index'
import { ground } from './scenes'

describe('jointExists: a joint that broke or was removed stays gone after the frame that reported it', () => {
  it('is true while the joint holds, false for good after it breaks and after it is removed', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    ground(world, 20)
    const frame = world.createBody({ shape: { kind: 'box', half: [0.05, 0.05, 0.05] }, motion: 'static', position: [0, 1, 0], user: -1 })
    const door = world.createBody({ shape: { kind: 'box', half: [0.4, 0.8, 0.03] }, motion: 'dynamic', mass: 20, position: [0.4, 1, 0], user: -2 })
    const breaking = world.createJoint({ kind: 'hinge', a: frame, b: door, point: [0, 1, 0], axis: [0, 1, 0], normal: [1, 0, 0], min: -1, max: 1, breakImpulse: 2 })
    const removable = world.createJoint({ kind: 'hinge', a: frame, b: door, point: [0, 1, 0], axis: [0, 1, 0], normal: [1, 0, 0], min: -1, max: 1 })
    expect(world.jointExists(breaking)).toBe(true)
    expect(world.jointExists(removable)).toBe(true)
    world.addImpulse(door, [0, 0, 400], [0.4, 0, 0])
    let reportedAt = -1
    for (let i = 0; i < 20; i++) {
      world.step(1 / 60)
      if (reportedAt < 0 && world.brokenJoints.includes(breaking)) reportedAt = i
    }
    expect(reportedAt).toBeGreaterThanOrEqual(0)
    expect(world.brokenJoints).toHaveLength(0)
    expect(world.jointExists(breaking)).toBe(false)
    world.removeJoint(removable)
    expect(world.jointExists(removable)).toBe(false)
    world.dispose()
  })
})
