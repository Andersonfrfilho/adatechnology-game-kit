import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { createPhysicsLoop, KIT_WORLD } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createAgentBodies, createCrowd, createDoorBodies, createDoors, createNavGrid, createRng } from '../../src'
import type { Crowd } from '../../src'
import { packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

/** Time limits are charged only in the cost lane (`pnpm --filter @adatechnology/game-crowd test:cost`, under `perf-measure.lock`). */
const COST_LANE = process.env.PHYSICS_COST === '1'
const AGENTS = 1000
const COLUMNS = 40

const percentile = (samples: readonly number[], quantile: number): number => {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))] ?? 0
}

const newScene = async (): Promise<{ readonly crowd: Crowd; readonly doors: ReturnType<typeof createDoors>; readonly loop: ReturnType<typeof createPhysicsLoop>; readonly dispose: () => void }> => {
  const grid = createNavGrid({ size: 128 })
  const doors = createDoors(grid, { random: createRng(3) })
  const crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid, doors, capacity: AGENTS + 50, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })
  const world = (await createJoltEngine()).createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  // a wall with a 1.2 m doorway at x = 0, the door a leaf on a hinge
  world.createBody({ shape: { kind: 'box', half: [10, 1.5, 0.1] }, motion: 'static', position: [-10.6, 1.5, 0], user: -1 })
  world.createBody({ shape: { kind: 'box', half: [10, 1.5, 0.1] }, motion: 'static', position: [10.6, 1.5, 0], user: -1 })
  doors.add(0, 0, 'x', 1.2)
  for (let k = 0; k < AGENTS; k++) {
    const i = crowd.spawn(((k % COLUMNS) - COLUMNS / 2) * 0.6, 3 + Math.floor(k / COLUMNS) * 0.6, 0)
    crowd.store.height[i] = 1.7
  }
  return { crowd, doors, loop: createPhysicsLoop(world), dispose: () => world.dispose() }
}

/** game-crowd's walk, simplified: toward the doorway, stopping at the wall line unless in the doorway, where they press on into the leaf. */
const walk = (crowd: Crowd, broken: boolean, h: number): void => {
  const { store } = crowd
  for (let i = 0; i < store.n; i++) {
    const dx = -store.x[i]!
    const dz = -store.z[i]!
    const distance = Math.hypot(dx, dz) || 1
    store.x[i] = store.x[i]! + (dx / distance) * 1.2 * h
    store.z[i] = Math.max(Math.abs(store.x[i]!) < 0.6 ? (broken ? -5 : 0.1) : 0.3, store.z[i]! + (dz / distance) * 1.2 * h)
  }
}

describe('T7.1: the crowd as kinematic capsules in the engine', () => {
  it('1 000 agents are 1 000 capsules, push a door off its hinge, and the crowd is told it is broken', { timeout: 120000 }, async () => {
    const { crowd, doors, loop, dispose } = await newScene()
    const agents = createAgentBodies(loop, crowd)
    const doorBodies = createDoorBodies(loop, doors)
    expect(doorBodies.leafOf(0)).toBeDefined()
    const frames: number[] = []
    let brokeAt = -1
    for (let f = 0; f < 600; f++) {
      walk(crowd, doors.list[0]!.broken, loop.world.fixedStep)
      const started = performance.now()
      loop.stepFixed(1)
      frames.push(performance.now() - started)
      if (brokeAt < 0 && doors.list[0]!.broken) brokeAt = (f + 1) * loop.world.fixedStep
    }
    expect(agents.count).toBe(AGENTS)
    expect(brokeAt).toBeGreaterThan(0)
    expect(doors.list[0]!.open).toBe(true)
    expect(doorBodies.leafOf(0)).toBeUndefined()
    const median = percentile(frames.slice(10), 0.5)
    const p99 = percentile(frames.slice(10), 0.99)
    console.log(JSON.stringify({ name: 'T7.1-1000-agents', brokeAtS: brokeAt, stepMedianMs: Math.round(median * 1000) / 1000, stepP99Ms: Math.round(p99 * 1000) / 1000 }))
    // spec.md 6.2: 1 000 cinematic agents, median 0.5 ms, p99 1.0 ms (the capsules' own move included)
    if (COST_LANE) {
      expect(median).toBeLessThanOrEqual(0.5)
      expect(p99).toBeLessThanOrEqual(1)
    }
    agents.dispose()
    doorBodies.dispose()
    dispose()
  })

  it('the capsules follow a removal: capsule i is agent i of the store, and the extra ones leave the world', async () => {
    const { crowd, loop, dispose } = await newScene()
    const agents = createAgentBodies(loop, crowd)
    loop.stepFixed(1)
    for (let removed = 0; removed < 100; removed++) crowd.remove(0)
    loop.stepFixed(1)
    expect(agents.count).toBe(AGENTS - 100)
    expect(agents.bodyOf(AGENTS - 100)).toBeUndefined()
    expect(loop.world.bodyCount).toBeGreaterThanOrEqual(AGENTS - 100)
    agents.dispose()
    expect(agents.count).toBe(0)
    dispose()
  })

  it('a removal does not sweep the capsule that takes the vacancy through the world: it jumps there, pushing nothing on the way, and bodyOf(i) is agent i', async () => {
    const grid = createNavGrid({ size: 128 })
    const crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid, capacity: 10, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
    const loop = createPhysicsLoop(world)
    for (const x of [0, 4, 10]) crowd.store.height[crowd.spawn(x, 0, 0)] = 1.7
    const prop = world.createBody({ shape: { kind: 'box', half: [0.25, 0.25, 0.25] }, motion: 'dynamic', mass: 5, position: [7, 0.25, 0], user: -2 })
    const agents = createAgentBodies(loop, crowd)
    loop.stepFixed(1)
    const readPose = (id: ReturnType<typeof world.createBody>): number[] => {
      const out = new Float32Array(7)
      world.readPose(id, out, 0)
      return [...out]
    }
    const before = readPose(prop)
    // agent 2 (at x = 10) takes the place of agent 0 (at x = 0): capsule 0 has to be at x = 10 without crossing the prop at x = 7
    crowd.remove(0)
    loop.stepFixed(1)
    readPose(prop).forEach((value, k) => expect(value).toBeCloseTo(before[k]!, 3))
    expect(agents.count).toBe(2)
    for (let i = 0; i < crowd.store.n; i++) {
      // a kinematic move across ten metres leaves the capsule with the speed it needed to cover them
      const velocity = new Float32Array(6)
      world.readVelocity(agents.bodyOf(i)!, velocity, 0)
      expect(Math.hypot(velocity[0]!, velocity[1]!, velocity[2]!)).toBeLessThan(0.01)
      const pose = readPose(agents.bodyOf(i)!)
      expect(pose[0]).toBeCloseTo(crowd.store.x[i]!, 3)
      expect(pose[2]).toBeCloseTo(crowd.store.z[i]!, 3)
    }
    agents.dispose()
    world.dispose()
  })

  it('a leaf torn off its hinge is kept by the door bodies: the door shut again drops it before hanging a new one, and dispose takes it out of the world', async () => {
    const grid = createNavGrid({ size: 64 })
    const doors = createDoors(grid, { random: createRng(3) })
    doors.add(0, 0, 'x', 1.2)
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    const loop = createPhysicsLoop(world)
    const bodiesBefore = world.bodyCount
    const doorBodies = createDoorBodies(loop, doors)
    const hung = world.bodyCount
    expect(hung).toBe(bodiesBefore + 2)
    for (let cycle = 0; cycle < 5; cycle++) {
      world.addImpulse(doorBodies.leafOf(0)!, [0, 0, 5000])
      for (let step = 0; step < 10 && !doors.list[0]!.broken; step++) loop.stepFixed(1)
      expect(doors.list[0]!.broken).toBe(true)
      expect(doorBodies.leafOf(0)).toBeUndefined()
      // the frame is gone and the torn leaf is left: one body, not two
      expect(world.bodyCount).toBe(bodiesBefore + 1)
      // repaired and shut again
      doors.list[0]!.broken = false
      doors.list[0]!.open = false
      loop.stepFixed(1)
      expect(doorBodies.leafOf(0)).toBeDefined()
      expect(world.bodyCount).toBe(hung)
    }
    world.addImpulse(doorBodies.leafOf(0)!, [0, 0, 5000])
    for (let step = 0; step < 10 && !doors.list[0]!.broken; step++) loop.stepFixed(1)
    doorBodies.dispose()
    expect(world.bodyCount).toBe(bodiesBefore)
    world.dispose()
  })

  it('an agent that did not move is not moved again: no kinematic call for a crowd that stands still, and one that stops is told once so the capsule stops too', async () => {
    const { crowd, loop, dispose } = await newScene()
    const calls = { moves: 0 }
    const world = loop.world
    const move = world.moveKinematic.bind(world)
    world.moveKinematic = (...args: Parameters<typeof world.moveKinematic>): void => {
      calls.moves++
      move(...args)
    }
    const agents = createAgentBodies(loop, crowd)
    const frames: number[] = []
    for (let f = 0; f < 120; f++) {
      const started = performance.now()
      loop.stepFixed(1)
      frames.push(performance.now() - started)
      if (f === 20) calls.moves = 0
    }
    console.log(JSON.stringify({ name: 'T7.1-1000-idle-agents', moveCallsIn100Steps: calls.moves, stepMedianMs: Math.round(percentile(frames.slice(20), 0.5) * 1000) / 1000 }))
    expect(calls.moves).toBe(0)
    // one agent walks, then stops: the capsule is told where it is once more, and has no speed left
    const body = agents.bodyOf(7)!
    for (let f = 0; f < 10; f++) {
      crowd.store.x[7] = crowd.store.x[7]! + 0.05
      loop.stepFixed(1)
    }
    calls.moves = 0
    loop.stepFixed(1)
    loop.stepFixed(1)
    expect(calls.moves).toBeLessThanOrEqual(1)
    const velocity = new Float32Array(6)
    world.readVelocity(body, velocity, 0)
    expect(Math.hypot(velocity[0]!, velocity[1]!, velocity[2]!)).toBeLessThan(0.01)
    const pose = new Float32Array(7)
    world.readPose(body, pose, 0)
    expect(pose[0]).toBeCloseTo(crowd.store.x[7]!, 3)
    agents.dispose()
    dispose()
  })

  it('the state-hash of the crowd is the same with its agents in the engine as without it: nothing the engine does writes back into the store', { timeout: 120000 }, async () => {
    const run = async (withBodies: boolean): Promise<string> => {
      const grid = createNavGrid({ size: 128 })
      const crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid, capacity: 100, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })
      for (let k = 0; k < 60; k++) crowd.spawn(((k % 10) - 5) * 1.5, 8 + Math.floor(k / 10) * 1.5, 0)
      const world = (await createJoltEngine()).createWorld(KIT_WORLD)
      world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
      const loop = createPhysicsLoop(world)
      const agents = withBodies ? createAgentBodies(loop, crowd) : undefined
      for (let step = 0; step < 300; step++) {
        if (withBodies) loop.step(1 / 60)
        crowd.update(1 / 60, { bandCentre: [0, 0], flowTarget: [0, 0] })
      }
      const hash = hashCrowdState(crowd)
      expect(agents === undefined || agents.count === crowd.store.n).toBe(true)
      world.dispose()
      return hash
    }
    expect(await run(true)).toBe(await run(false))
  })
})
