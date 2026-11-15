import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const newWorld = async (): Promise<PhysicsWorld> => (await createJoltEngine()).createWorld(KIT_WORLD)
const floor = (world: PhysicsWorld): BodyId => world.createBody({ shape: { kind: 'box', half: [20, 0.5, 20] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
const poseOf = (world: PhysicsWorld, id: BodyId): number[] => {
  const out = new Float64Array(7)
  world.readPose(id, out, 0)
  return [...out]
}

/** A scene with a rolling can, a sliding box, an ignored pair and a joint: every piece of adapter state the saved bytes carry. */
const scene = (world: PhysicsWorld): BodyId[] => {
  floor(world)
  const ids: BodyId[] = []
  ids.push(world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [0, 0.1, 0], mass: 0.3, user: 1, linearVelocity: [2, 0, 0], rolling: { coefficient: 0.02, radius: 0.1 } }))
  ids.push(world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', position: [3, 0.2, 0], mass: 4, user: 2, linearVelocity: [0, 0, 3] }))
  ids.push(world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', position: [3, 0.7, 0], mass: 4, user: 3 }))
  world.ignorePair(ids[1]!, ids[2]!, true)
  return ids
}

describe('contract: saved state', () => {
  it('save, restore, save gives the same bytes', async () => {
    const world = await newWorld()
    scene(world)
    for (let i = 0; i < 90; i++) world.step(1 / 120)
    const first = world.saveState()
    expect(world.restoreState(first)).toBe(true)
    const second = world.saveState()
    expect(second.length).toBe(first.length)
    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0)
    world.dispose()
  })

  it('save, run N, restore, run N repeats the same poses', async () => {
    const world = await newWorld()
    const ids = scene(world)
    for (let i = 0; i < 60; i++) world.step(1 / 120)
    const saved = world.saveState()
    for (let i = 0; i < 120; i++) world.step(1 / 120)
    const firstRun = ids.map((id) => poseOf(world, id))
    expect(world.restoreState(saved)).toBe(true)
    for (let i = 0; i < 120; i++) world.step(1 / 120)
    expect(ids.map((id) => poseOf(world, id))).toEqual(firstRun)
    world.dispose()
  })

  it('carries the ignored pairs and the rolling bodies', async () => {
    const world = await newWorld()
    const ids = scene(world)
    const saved = world.saveState()
    // the same bytes in a world that has none of it differ: the adapter's own state is in them
    const bare = await newWorld()
    floor(bare)
    ids.forEach((_, i) => bare.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [i, 0.1, 0], mass: 1, user: i }))
    expect(bare.restoreState(saved)).toBe(true)
    const again = bare.saveState()
    expect(Buffer.compare(Buffer.from(saved), Buffer.from(again))).toBe(0)
    world.dispose()
    bare.dispose()
  })
})

describe('contract: body queries and events', () => {
  it('has() follows the body', async () => {
    const world = await newWorld()
    const id = floor(world)
    expect(world.has(id)).toBe(true)
    world.removeBody(id)
    expect(world.has(id)).toBe(false)
    world.dispose()
  })

  it('tag is -1 for a plain shape and an untagged child, the part for a tagged one, on queries and contacts', async () => {
    const world = await newWorld()
    floor(world)
    const compound = world.createBody({
      shape: { kind: 'compound', children: [
        { shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, position: [-0.5, 0, 0], tag: 5 },
        { shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, position: [0.5, 0, 0] },
      ] },
      motion: 'static', position: [0, 3, 0], user: 9,
    })
    const hits: RayHit[] = []
    world.rayAll([-0.5, 6, 0], [0, -1, 0], 10, hits)
    expect(hits.find((h) => h.body === compound)?.tag).toBe(5)
    world.rayAll([0.5, 6, 0], [0, -1, 0], 10, hits)
    expect(hits.find((h) => h.body === compound)?.tag).toBe(-1)
    expect(world.rayFirst([10, 6, 0], [0, -1, 0], 10)?.tag).toBe(-1)
    // a ball dropped on the tagged child, and one on the plain floor: their contact rows carry 5 and -1
    world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [-0.5, 3.8, 0], mass: 1, user: 1, linearVelocity: [0, -4, 0] })
    world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [10, 1.5, 0], mass: 1, user: 2, linearVelocity: [0, -4, 0] })
    const tags = new Map<number, number>()
    for (let i = 0; i < 120; i++) {
      world.step(1 / 120)
      const c = world.contacts
      for (let r = 0; r < c.count; r++) {
        if (c.userA[r] === 9) tags.set(c.userB[r]!, c.tagA[r]!)
        else if (c.userB[r] === 9) tags.set(c.userA[r]!, c.tagB[r]!)
        else if (c.userA[r] === 0) tags.set(c.userB[r]!, c.tagA[r]!)
        else if (c.userB[r] === 0) tags.set(c.userA[r]!, c.tagB[r]!)
      }
    }
    expect(tags.get(1)).toBe(5)
    expect(tags.get(2)).toBe(-1)
    world.dispose()
  })

  it('counts dropped contacts only past the speed filter, and clearEvents resets them', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ ...KIT_WORLD, maxContacts: 2 })
    floor(world)
    // slow touches are under the filter: no rows, nothing dropped
    for (let i = 0; i < 5; i++) world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [i, 0.1, 0], mass: 1, user: i + 1 })
    for (let i = 0; i < 30; i++) world.step(1 / 120)
    expect(world.contacts.dropped).toBe(0)
    // five fast ones into a table of two rows
    for (let i = 0; i < 5; i++) world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [i + 10, 0.6, 0], mass: 1, user: i + 10, linearVelocity: [0, -8, 0] })
    let kept = 0
    let dropped = 0
    for (let i = 0; i < 20; i++) {
      world.step(1 / 120)
      kept += world.contacts.count
      dropped += world.contacts.dropped
    }
    expect(kept + dropped).toBeGreaterThanOrEqual(5)
    expect(dropped).toBeGreaterThan(0)
    world.clearEvents()
    expect(world.contacts.count).toBe(0)
    expect(world.contacts.dropped).toBe(0)
    world.dispose()
  })

  it('exposes jointAngles and wheelContacts on the contract', async () => {
    const world = await newWorld()
    expect(typeof world.jointAngles).toBe('function')
    expect(typeof world.wheelContacts).toBe('function')
    world.dispose()
  })
})

describe('contract: slider joint', () => {
  it('a drawer slides within its limits and stops at them', async () => {
    const world = await newWorld()
    // the rail's frame, clear of the drawer (they would collide where they overlap)
    const frame = world.createBody({ shape: { kind: 'box', half: [0.5, 0.05, 0.5] }, motion: 'static', position: [0, 0.5, 0], user: 1 })
    const drawer = world.createBody({ shape: { kind: 'box', half: [0.2, 0.1, 0.2] }, motion: 'dynamic', position: [0, 1, 0], mass: 2, user: 2, allowSleep: false })
    world.createJoint({ kind: 'slider', a: frame, b: drawer, point: [0, 1, 0], axis: [1, 0, 0], min: 0, max: 0.4 })
    const xs: number[] = []
    const pose = new Float64Array(7)
    const run = (seconds: number): void => {
      for (let i = 0; i < seconds * 120; i++) {
        world.step(1 / 120)
        world.readPose(drawer, pose, 0)
        xs.push(pose[0]!)
      }
    }
    world.addImpulse(drawer, [10, 0, 0])
    run(2)
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.4 + 0.03)
    expect(Math.max(...xs)).toBeGreaterThan(0.39)
    world.readPose(drawer, pose, 0)
    expect(pose[0]).toBeCloseTo(0.4, 1)
    // off the axis it does not move: y and z stay where the rail holds them
    expect(pose[1]).toBeCloseTo(1, 2)
    expect(pose[2]).toBeCloseTo(0, 2)
    world.addImpulse(drawer, [-10, 0, 0])
    xs.length = 0
    run(2)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.03)
    world.readPose(drawer, pose, 0)
    expect(pose[0]).toBeCloseTo(0, 1)
    world.dispose()
  })
})
