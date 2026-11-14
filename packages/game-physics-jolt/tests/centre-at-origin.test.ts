import { describe, expect, it } from 'vitest'

import type { BodyDesc, ShapeDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

/** A pole as the room draws it: thin plates, all near one end, so the parts' own centroid is 2.2 m from the middle. */
const POLE: ShapeDesc = {
  kind: 'compound',
  children: [
    { shape: { kind: 'box', half: [0.11, 0.01, 0.11] }, position: [0, -3.75, 0], tag: 0 },
    { shape: { kind: 'box', half: [0.11, 0.01, 0.11] }, position: [0, 0.38, 0], tag: 1 },
    { shape: { kind: 'box', half: [0.7, 0.05, 0.03] }, position: [0, 3.18, 0], tag: 2 },
  ],
}

const fall = async (extra: Partial<BodyDesc>): Promise<{ drop: number; speed: number; pose: Float64Array; velocity: Float64Array }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld()
  const body = world.createBody({ shape: POLE, motion: 'dynamic', mass: 950, position: [0, 50, 0], angularVelocity: [2, 0, 0], linearDamping: 0, angularDamping: 0, user: 0, ...extra })
  for (let i = 0; i < 60; i++) world.stepFixed(world.fixedStep)
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  world.readPose(body, pose, 0)
  world.readVelocity(body, velocity, 0)
  world.dispose()
  return { drop: 50 - pose[1]!, speed: Math.hypot(velocity[0]!, velocity[1]!, velocity[2]!), pose, velocity }
}

describe('centreAtOrigin: the pose and the velocity name the same point (spec 008 T3.8b)', () => {
  it('a spinning pole in free fall drops as one body about its origin, and its velocity is the origin\'s', async () => {
    const seconds = 60 * (1 / 60)
    const centred = await fall({ centreAtOrigin: true })
    expect(Math.abs(centred.drop - 0.5 * 9.81 * seconds * seconds)).toBeLessThan(0.1)
    expect(Math.abs(centred.velocity[1]! + 9.81 * seconds)).toBeLessThan(0.1)
    expect(Math.abs(centred.pose[0]!)).toBeLessThan(1e-6)
    expect(Math.abs(centred.pose[2]!)).toBeLessThan(1e-6)
  })

  it('left out, the engine turns it about the parts\' centroid: the origin swings, which is why the room read a speed its pose did not travel', async () => {
    const seconds = 60 * (1 / 60)
    const plain = await fall({})
    expect(Math.abs(plain.drop - 0.5 * 9.81 * seconds * seconds)).toBeGreaterThan(0.5)
  })

  it('setShape keeps the origin as the centre of mass', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld()
    const body = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 950, centreAtOrigin: true, position: [0, 50, 0], angularVelocity: [2, 0, 0], user: 0 })
    world.setShape(body, POLE, { mass: 950 })
    for (let i = 0; i < 60; i++) world.stepFixed(world.fixedStep)
    const pose = new Float64Array(7)
    world.readPose(body, pose, 0)
    const seconds = 60 * (1 / 60)
    expect(Math.abs(50 - pose[1]! - 0.5 * 9.81 * seconds * seconds)).toBeLessThan(0.1)
    world.dispose()
  })
})
