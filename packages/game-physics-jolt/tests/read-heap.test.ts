import { describe, expect, it } from 'vitest'

import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'

const BODY_COUNT = 1000

/** The reads as they were before the heap: one crossing per component. */
const referencePose = (world: JoltWorld, id: BodyId, out: Float64Array, offset: number): void => {
  const b = world.entry(id).body
  const p = b.GetPosition()
  const q = b.GetRotation()
  out.set([p.GetX(), p.GetY(), p.GetZ(), q.GetX(), q.GetY(), q.GetZ(), q.GetW()], offset)
}

const referenceVelocity = (world: JoltWorld, id: BodyId, out: Float64Array, offset: number): void => {
  const b = world.entry(id).body
  const v = b.GetLinearVelocity()
  const w = b.GetAngularVelocity()
  out.set([v.GetX(), v.GetY(), v.GetZ(), w.GetX(), w.GetY(), w.GetZ()], offset)
}

describe('readPose and readVelocity from the heap', () => {
  it('give the same bytes as the per-component reads over 1,000 bodies', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ maxBodies: 2048 }) as JoltWorld
    const ids: BodyId[] = []
    for (let i = 0; i < BODY_COUNT; i++) {
      const id = world.createBody({
        shape: { kind: 'box', half: [0.2, 0.3, 0.1] },
        motion: 'dynamic',
        mass: 2,
        position: [(i % 10) * 1.7 - 8.3, 5 + Math.floor(i / 100) * 1.3, (Math.floor(i / 10) % 10) * 1.9 - 9.1],
        rotation: [Math.sin(i) * 0.3, Math.cos(i * 0.7) * 0.2, 0.1, 1],
        user: i,
      })
      world.setVelocity(id, [Math.sin(i * 1.3) * 4, Math.cos(i) * 3, i * 0.013 - 6], [Math.sin(i * 0.31), i * 0.002, -Math.cos(i * 0.17) * 2])
      ids.push(id)
    }
    for (let step = 0; step < 5; step++) world.step(1 / 60)
    const pose = new Float64Array(BODY_COUNT * 7)
    const velocity = new Float64Array(BODY_COUNT * 6)
    const expectedPose = new Float64Array(BODY_COUNT * 7)
    const expectedVelocity = new Float64Array(BODY_COUNT * 6)
    ids.forEach((id, i) => {
      world.readPose(id, pose, i * 7)
      world.readVelocity(id, velocity, i * 6)
      referencePose(world, id, expectedPose, i * 7)
      referenceVelocity(world, id, expectedVelocity, i * 6)
    })
    expect(Buffer.from(pose.buffer).equals(Buffer.from(expectedPose.buffer))).toBe(true)
    expect(Buffer.from(velocity.buffer).equals(Buffer.from(expectedVelocity.buffer))).toBe(true)
    expect(pose.some((value) => value !== 0)).toBe(true)
    world.dispose()
  })

  it('readActiveBodies lists the awake bodies, and not the sleeping ones', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({}) as JoltWorld
    const awake = world.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 1, position: [0, 5, 0], user: 1 })
    const asleep = world.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 1, position: [4, 5, 0], sleeping: true, user: 2 })
    const out: BodyId[] = []
    const count = world.readActiveBodies(out)
    expect(count).toBe(out.length)
    expect(out).toContain(awake)
    expect(out).not.toContain(asleep)
    world.dispose()
  })
})
