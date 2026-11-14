import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const H = KIT_WORLD.fixedStep ?? 1 / 120
const newWorld = async (): Promise<PhysicsWorld> => (await createJoltEngine()).createWorld(KIT_WORLD)

/** Counts the fixed steps a world runs, however they are asked for. */
const countSteps = (world: PhysicsWorld): { readonly count: () => number } => {
  let count = 0
  const stepFixed = world.stepFixed.bind(world)
  world.stepFixed = (h: number): void => {
    count++
    stepFixed(h)
  }
  return { count: () => count }
}

describe('PhysicsLoop', () => {
  it('only the loop steps: the seam world has no step, and a second loop for the world throws', async () => {
    const world = await newWorld()
    const loop = createPhysicsLoop(world)
    // @ts-expect-error a seam cannot step
    void loop.world.step
    // @ts-expect-error nor clear the events of the others
    void loop.world.clearEvents
    expect(() => createPhysicsLoop(world)).toThrow(/already has a physics loop/)
    world.dispose()
  })

  it('limits a long frame: step(5) runs at most 12 fixed steps', async () => {
    const world = await newWorld()
    const steps = countSteps(world)
    const loop = createPhysicsLoop(world)
    loop.step(5)
    expect(steps.count()).toBeLessThanOrEqual(12)
    expect(steps.count()).toBeGreaterThanOrEqual(11)
    expect(loop.frame.steps).toBe(steps.count())
    world.dispose()
  })

  it('a 144 Hz caller gets frames of 0 and 1 steps, and frame.steps says which', async () => {
    const world = await newWorld()
    const steps = countSteps(world)
    const loop = createPhysicsLoop(world)
    const seen: number[] = []
    loop.add({ afterSteps: (_dt, frame) => seen.push(frame.steps) }, 'rules')
    for (let i = 0; i < 144; i++) loop.step(1 / 144)
    expect(new Set(seen)).toEqual(new Set([0, 1]))
    expect(seen.reduce((a, b) => a + b, 0)).toBe(steps.count())
    // a second of frames is a second of steps
    expect(steps.count()).toBeGreaterThanOrEqual(119)
    expect(steps.count()).toBeLessThanOrEqual(120)
    expect(loop.frame.time).toBeCloseTo(steps.count() * H, 9)
    world.dispose()
  })

  it('runs phases in order: crowd, actors, step, contacts, rules; registration order inside one; unsubscribe works', async () => {
    const world = await newWorld()
    const loop = createPhysicsLoop(world)
    const log: string[] = []
    const phase = (name: string): { beforeStep: () => void; afterSteps: () => void } => ({ beforeStep: () => log.push(`${name}:before`), afterSteps: () => log.push(`${name}:after`) })
    loop.add(phase('rules'), 'rules')
    loop.add(phase('actors1'), 'actors')
    const removeActors2 = loop.add(phase('actors2'), 'actors')
    loop.add(phase('contacts'), 'contacts')
    loop.add(phase('crowd'), 'crowd')
    loop.step(H)
    expect(log).toEqual(['crowd:before', 'actors1:before', 'actors2:before', 'contacts:after', 'rules:after'])
    removeActors2()
    log.length = 0
    loop.step(H)
    expect(log).toEqual(['crowd:before', 'actors1:before', 'contacts:after', 'rules:after'])
    world.dispose()
  })

  it('contacts of both fixed steps of a frame are visible in afterSteps', async () => {
    const world = await newWorld()
    world.createBody({ shape: { kind: 'box', half: [20, 0.5, 20] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    // two fast balls that land in different steps of the same frame
    world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [0, 0.1 + 8 * H * 0.9, 0], mass: 1, user: 1, linearVelocity: [0, -8, 0] })
    world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', position: [5, 0.1 + 8 * H * 1.9, 0], mass: 1, user: 2, linearVelocity: [0, -8, 0] })
    const loop = createPhysicsLoop(world)
    const users = new Set<number>()
    let framesWithRows = 0
    loop.add({
      afterSteps: () => {
        const c = world.contacts
        if (c.count > 0) framesWithRows++
        for (let r = 0; r < c.count; r++) {
          if (c.userA[r] === 1 || c.userB[r] === 1) users.add(1)
          if (c.userA[r] === 2 || c.userB[r] === 2) users.add(2)
        }
      },
    }, 'contacts')
    loop.step(3 * H)
    expect(loop.frame.steps).toBe(3)
    expect([...users].sort()).toEqual([1, 2])
    expect(framesWithRows).toBe(1)
    // the next frame starts clean
    loop.step(H)
    expect(world.contacts.count).toBe(0)
    world.dispose()
  })

  it('a kinematic moved in beforeStep(h) moves at the speed asked, whatever the caller frame rate', async () => {
    const world = await newWorld()
    const mover = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'kinematic', position: [0, 1, 0], user: 1 })
    const loop = createPhysicsLoop(world)
    const speed = 2
    const target = { x: 0 }
    loop.add({
      beforeStep: (h) => {
        target.x += speed * h
        world.moveKinematic(mover, [target.x, 1, 0], [0, 0, 0, 1], h)
      },
    }, 'actors')
    for (let i = 0; i < 144; i++) loop.step(1 / 144)
    const pose = new Float64Array(7)
    world.readPose(mover, pose, 0)
    const velocity = new Float64Array(6)
    world.readVelocity(mover, velocity, 0)
    expect(pose[0]).toBeCloseTo(target.x, 3)
    // two metres a second of simulated time, not of caller time: the steps run are what count
    expect(target.x).toBeCloseTo(speed * loop.frame.time, 6)
    expect(velocity[0]).toBeCloseTo(speed, 1)
    world.dispose()
  })
})
