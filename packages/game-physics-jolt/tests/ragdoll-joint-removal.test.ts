import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { engineRagdoll, ground } from './scenes'

const ELBOW_JOINT = 5 // part 6 (left forearm) hangs from joint 5: one joint per part but the root
const CYCLES = 10

const centreOf = (world: JoltWorld, id: BodyId): [number, number, number] => {
  const pose = new Float64Array(7)
  world.readPose(id, pose, 0)
  return [pose[0]!, pose[1]!, pose[2]!]
}

const distanceBetween = (world: JoltWorld, a: BodyId, b: BodyId): number => {
  const [from, to] = [centreOf(world, a), centreOf(world, b)]
  return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
}

/** A velocity of `speed` m/s along the line from `from` to `to`. */
const awayFrom = (world: JoltWorld, from: BodyId, to: BodyId, speed: number): [number, number, number] => {
  const [a, b] = [centreOf(world, from), centreOf(world, to)]
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return [((b[0] - a[0]) / length) * speed, ((b[1] - a[1]) / length) * speed, ((b[2] - a[2]) / length) * speed]
}

describe('removeJoint on a ragdoll\'s own joint (a limb torn off)', () => {
  it('frees the two sides of each other, keeps both as bodies of the ragdoll, and the ragdoll still leaves whole', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD) as JoltWorld
    ground(world)
    const torn = engineRagdoll(world, [0, 1, 0], 0, true)
    const whole = engineRagdoll(world, [10, 1, 0], 0, true)
    const [upperTorn, lowerTorn] = [torn.joints[ELBOW_JOINT]!.desc.a, torn.joints[ELBOW_JOINT]!.desc.b]
    const [upperWhole, lowerWhole] = [whole.joints[ELBOW_JOINT]!.desc.a, whole.joints[ELBOW_JOINT]!.desc.b]
    const bone = distanceBetween(world, upperTorn, lowerTorn)
    world.removeJoint(torn.joints[ELBOW_JOINT]!.id)
    expect(world.jointAngles(torn.joints[ELBOW_JOINT]!.id)).toEqual({ swing: 0, twist: 0, hinge: 0 })
    // the same push on the forearm of a ragdoll whose joint was torn off and on one whose joint stands
    for (const [upper, lower] of [[upperTorn, lowerTorn], [upperWhole, lowerWhole]] as const) world.setVelocity(lower, awayFrom(world, upper, lower, 4), [0, 0, 0])
    for (let i = 0; i < 90; i++) world.step(1 / 60)
    expect(distanceBetween(world, upperTorn, lowerTorn)).toBeGreaterThan(bone * 2)
    expect(distanceBetween(world, upperWhole, lowerWhole)).toBeLessThan(bone * 1.5)
    expect(() => world.removeBody(lowerTorn)).toThrow(/removeRagdoll/)
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
