import { describe, expect, it } from 'vitest'

import { createRig, GUIDE, ragdollOfRig } from '@adatechnology/game-characters'
import { KIT_WORLD, LAYER_PAIRS } from '@adatechnology/game-physics'
import type { BodyId, Quat } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'
import { ground } from './scenes'

const UPRIGHT: Quat = [0, 0, 0, 1]
const BOX = { kind: 'box', half: [0.5, 0.5, 0.5] } as const

describe('the body LOD contract (T5.4 step 1)', () => {
  it('the corpse layer meets the fixed world, debris, props, characters, vehicles, sensors and other corpses, and not agents', () => {
    const meets = (other: string): boolean => LAYER_PAIRS.some(([a, b]) => (a === 'corpse' && b === other) || (b === 'corpse' && a === other))
    for (const other of ['static', 'debris', 'prop', 'character', 'vehicle', 'sensor', 'corpse']) expect(meets(other), other).toBe(true)
    expect(meets('agent')).toBe(false)
  })

  it('a corpse falls onto the ground and rests on it, and a kinematic agent walks through it', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    ground(world)
    const corpse = world.createBody({ shape: BOX, motion: 'dynamic', mass: 20, position: [0, 3, 0], layer: 'corpse', user: 1 })
    const agent = world.createBody({ shape: BOX, motion: 'kinematic', position: [0, 0.5, 0], layer: 'agent', user: 2 })
    const pose = new Float64Array(7)
    for (let i = 0; i < 240; i++) world.step(1 / 60)
    world.readPose(corpse, pose, 0)
    expect(pose[1]).toBeGreaterThan(0.3)
    expect(pose[1]).toBeLessThan(0.55)
    expect(world.contactBodies(corpse, [])).toBeGreaterThan(0)
    const touching: BodyId[] = []
    world.contactBodies(corpse, touching)
    expect(touching.includes(agent)).toBe(false)
    world.dispose()
  })

  it('overlapShape finds the bodies a shape would sit inside, once each, and nothing where there is room', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    ground(world)
    const prop = world.createBody({ shape: BOX, motion: 'static', position: [4, 0.5, 0], user: 1 })
    const corpse = world.createBody({ shape: BOX, motion: 'static', position: [6, 0.5, 0], layer: 'corpse', user: 2 })
    const sensor = world.createBody({ shape: BOX, motion: 'static', position: [8, 0.5, 0], layer: 'sensor', user: 3 })
    const found: BodyId[] = []
    expect(world.overlapShape(BOX, [4.4, 0.5, 0], UPRIGHT, found)).toBe(1)
    expect(found[0]).toBe(prop)
    const both = world.overlapShape({ kind: 'capsule', halfHeight: 0.3, radius: 1 }, [5, 0.5, 0], UPRIGHT, found)
    expect(both).toBeGreaterThanOrEqual(2)
    expect(found.includes(prop) && found.includes(corpse)).toBe(true)
    expect(world.overlapShape(BOX, [6.2, 0.5, 0], UPRIGHT, found, { layers: ['corpse'] })).toBe(1)
    expect(found[0]).toBe(corpse)
    expect(world.overlapShape(BOX, [5.1, 0.5, 0], UPRIGHT, found, { layers: ['static'] })).toBe(0)
    expect(world.overlapShape(BOX, [8, 0.5, 0], UPRIGHT, found)).toBe(0)
    expect(sensor).toBeDefined()
    expect(world.overlapShape(BOX, [0, 5, 0], UPRIGHT, found)).toBe(0)
    // a rotated box reaches where an upright one does not
    expect(world.overlapShape({ kind: 'box', half: [0.5, 0.5, 0.5] }, [5.1, 0.5, 0], [0, 0.3827, 0, 0.9239], found, { layers: ['static'] })).toBeGreaterThan(0)
    world.dispose()
  })

  it('contactBodies lists what a body rests on and on whom, resting contact included, and a sleeping pile keeps it', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    const floor = ground(world)
    const lower = world.createBody({ shape: BOX, motion: 'dynamic', mass: 10, position: [0, 0.5, 0], user: 1 })
    const upper = world.createBody({ shape: BOX, motion: 'dynamic', mass: 10, position: [0, 1.52, 0], user: 2 })
    for (let i = 0; i < 360; i++) world.step(1 / 60)
    expect(world.isSleeping(lower) && world.isSleeping(upper)).toBe(true)
    const out: BodyId[] = []
    expect(world.contactBodies(lower, out)).toBe(2)
    expect(out.includes(floor) && out.includes(upper)).toBe(true)
    expect(world.contactBodies(upper, out)).toBe(1)
    expect(out[0]).toBe(lower)
    const alone = world.createBody({ shape: BOX, motion: 'dynamic', mass: 10, position: [20, 10, 0], user: 3 })
    expect(world.contactBodies(alone, out)).toBe(0)
    world.dispose()
  })

  it('a ragdoll made sleeping stays asleep until woken, with its parts in place', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    ground(world)
    const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })
    const lying = { ...ragdollOfRig({ rig, body: GUIDE, build: 1, at: [0, 0.4, 0], user: 5 }), sleeping: true }
    const made = world.createRagdoll(lying)
    const placed = new Float64Array(7)
    world.readPose(made.bodies[0] as BodyId, placed, 0)
    for (let i = 0; i < 60; i++) world.step(1 / 60)
    expect(made.bodies.every((b) => world.isSleeping(b))).toBe(true)
    const first = new Float64Array(7)
    world.readPose(made.bodies[0] as BodyId, first, 0)
    expect(first[1]).toBeCloseTo(placed[1] as number, 6)
    world.wake(made.bodies[0] as BodyId)
    expect(world.isSleeping(made.bodies[0] as BodyId)).toBe(false)
    const awake = world.createRagdoll(ragdollOfRig({ rig, body: GUIDE, build: 1, at: [5, 0.4, 0], user: 6 }))
    expect(awake.bodies.some((b) => !world.isSleeping(b))).toBe(true)
    world.dispose()
  })
})
