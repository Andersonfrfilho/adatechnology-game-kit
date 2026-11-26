import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { engineRagdoll, ground } from './scenes'

const ELBOW_JOINT = 5 // part 6 (left forearm) hangs from joint 5: one joint per part but the root
const CYCLES = 10

const heightOf = (world: JoltWorld, id: BodyId): number => {
  const pose = new Float64Array(7)
  world.readPose(id, pose, 0)
  return pose[1]!
}

describe('removeJoint on a ragdoll\'s own joint (a limb torn off)', () => {
  it('frees the two sides of each other, keeps both as bodies of the ragdoll, and the ragdoll still leaves whole', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD) as JoltWorld
    ground(world)
    const doll = engineRagdoll(world, [0, 1, 0], 0, true)
    const joint = doll.joints[ELBOW_JOINT]!
    const lower = doll.bodies[doll.joints.indexOf(joint) + 1]!
    world.removeJoint(joint.id)
    expect(world.jointAngles(joint.id)).toEqual({ swing: 0, twist: 0, hinge: 0 })
    for (let i = 0; i < 240; i++) world.step(1 / 60)
    expect(Number.isFinite(heightOf(world, lower))).toBe(true)
    expect(() => world.removeBody(lower)).toThrow(/removeRagdoll/)
    world.dispose()
  })

  it('hands the heap back to the byte over cycles of make, tear a joint off, step, remove', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD) as JoltWorld
    ground(world)
    const cycle = (): void => {
      const made = world.createRagdoll({ stabilize: true, parts: engineRagdollParts() })
      world.removeJoint(made.joints[0]!)
      for (let i = 0; i < 30; i++) world.step(1 / 60)
      world.removeRagdoll(made.id)
    }
    cycle()
    const before = world.memoryInUse()
    for (let i = 0; i < CYCLES; i++) cycle()
    expect(world.memoryInUse()).toBe(before)
    world.dispose()
  })
})

const engineRagdollParts = (): Parameters<JoltWorld['createRagdoll']>[0]['parts'] => [
  { body: { shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.17 }, mass: 40, position: [0, 1.25, 0], layer: 'character', user: 1 }, parent: -1 },
  { body: { shape: { kind: 'sphere', radius: 0.11 }, mass: 5, position: [0, 1.75, 0], layer: 'character', user: 1 }, parent: 0, joint: { kind: 'swingTwist', point: [0, 1.62, 0], twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 } },
]
