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
