import { afterEach, describe, expect, it } from 'vitest'

import { corpseBodyKit, createRig, GUIDE } from '@adatechnology/game-characters'
import { AGE_PRESETS } from '@adatechnology/game-characters-people'
import { createCorpseBodies, createPhysicsLoop, KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, CorpseBodyKit } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createRunOver } from '@adatechnology/game-vehicles-driving'
import type { RunOverHit } from '@adatechnology/game-vehicles-driving'

import { createAgentBodies, createCrowd, createNavGrid, relocateCorpse, STATE } from '../../src'
import type { Crowd } from '../../src'
import { packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const STEP = 1 / 60
const CAR_MASS = 1300
const CAR_HALF = [0.9, 0.5, 2.2] as const
const KMH = 1 / 3.6
const kitCache = new Map<string, CorpseBodyKit>()
const kitOf = (height: number, build: number): CorpseBodyKit => {
  const key = `${height}:${build}`
  if (!kitCache.has(key)) kitCache.set(key, corpseBodyKit({ rig: createRig({ body: GUIDE, height, build }), body: GUIDE, build }))
  return kitCache.get(key)!
}

type Walker = { readonly x: number; readonly z: number; readonly height: number; readonly build: number }
type Car = { readonly x: number; readonly z: number; readonly kmh: number }
const ZOMBIE = { height: 1.8, build: 1 } as const
const ADULT = AGE_PRESETS.find((preset) => preset.id === 'adult')!
const CHILD = AGE_PRESETS.find((preset) => preset.id === 'child')!
const pedestrian = (preset: typeof ADULT): { height: number; build: number } => ({ height: (preset.heightMetres[0] + preset.heightMetres[1]) / 2, build: (preset.build[0] + preset.build[1]) / 2 })

const pending = new Set<() => void>()
afterEach(() => {
  for (const finish of [...pending]) finish()
})

type Shared = { readonly world: JoltWorld; readonly loop: ReturnType<typeof createPhysicsLoop> }

const makeScene = async (walkers: readonly Walker[], cars: readonly Car[], shared?: Shared) => {
  const crowd: Crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 128 }), capacity: 50, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })
  const engineWorld = shared?.world ?? ((await createJoltEngine()).createWorld(KIT_WORLD) as JoltWorld)
  if (!shared) engineWorld.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const loop = shared?.loop ?? createPhysicsLoop(engineWorld)
  const agents = createAgentBodies(loop, crowd)
  const hits: RunOverHit[] = []
  const runOver = createRunOver(loop, { crowd, agents, onHit: (hit) => hits.push(hit) })
  const bodies = createCorpseBodies(loop, { lod: { ragdollsMax: 1 }, onSettled: (corpse) => void relocateCorpse(crowd, corpse) })
  crowd.corpses.subscribe({
    added: (entry) => bodies.add({ id: entry.id, kit: kitOf(entry.data.height, entry.data.build), position: [entry.data.x, 0.02, entry.data.z], yaw: entry.data.yaw, ...(runOver.dyingVelocity ? { velocity: runOver.dyingVelocity } : {}) }),
    removed: (entry) => bodies.follower.removed(entry),
  })
  for (const walker of walkers) {
    const i = crowd.spawn(walker.x, walker.z, 0)
    crowd.store.height[i] = walker.height
    crowd.store.build[i] = walker.build
    crowd.store.state[i] = STATE.DORMANT
  }
  const carBodies: BodyId[] = cars.map((car) => {
    const body = engineWorld.createBody({
      shape: { kind: 'box', half: [...CAR_HALF] }, motion: 'dynamic', mass: CAR_MASS, position: [car.x, 0.55, car.z], linearVelocity: [0, 0, car.kmh * KMH], layer: 'vehicle', user: 1,
      material: { frictionStatic: 0, frictionDynamic: 0, restitution: 0 },
    })
    runOver.track({ body, half: CAR_HALF })
    return body
  })
  const velocity = new Float64Array(6)
  const pose = new Float64Array(7)
  const speedOf = (body: BodyId): number => (engineWorld.readVelocity(body, velocity, 0), velocity[2]!)
  const zOf = (body: BodyId): number => (engineWorld.readPose(body, pose, 0), pose[2]!)
  const run = (seconds: number): void => {
    for (let step = 0; step < seconds * 60; step++) {
      loop.step(STEP)
      crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
    }
  }
  /** Steps until the first hit and one frame more (the impulse is in the car's velocity then), at most `seconds`. */
  const untilHit = (seconds: number): void => {
    for (let step = 0; step < seconds * 60 && hits.length === 0; step++) run(1 / 60)
    run(1 / 60)
  }
  const dispose = (): void => {
    if (!pending.delete(dispose)) return
    runOver.dispose()
    agents.dispose()
    bodies.dispose()
    for (const body of carBodies) engineWorld.removeBody(body)
    crowd.dispose()
    if (!shared) engineWorld.dispose()
  }
  pending.add(dispose)
  return { crowd, world: engineWorld, bodies, hits, carBodies, speedOf, zOf, run, untilHit, dispose }
}

describe('T6.26: cars run over the crowd (veiculos.md 7.8)', () => {
  it('a car at 30 km/h kills a zombie: the corpse is born R0 with the car\'s velocity and the car loses what the momentum says', { timeout: 60000 }, async () => {
    const scene = await makeScene([{ x: 0, z: 3, ...ZOMBIE }], [{ x: 0, z: -3, kmh: 30 }])
    const mass = scene.crowd.store.mass[0]!
    const before = scene.speedOf(scene.carBodies[0]!)
    scene.untilHit(3)
    expect(scene.hits).toHaveLength(1)
    const [hit] = scene.hits
    expect(hit!.outcome).toBe('kill')
    const reduced = (mass * CAR_MASS) / (mass + CAR_MASS)
    expect(hit!.energy).toBeCloseTo(0.5 * reduced * hit!.speed ** 2, 6)
    expect(scene.crowd.corpses.entries).toHaveLength(1)
    expect(scene.bodies.rungOf(scene.crowd.corpses.entries[0]!.id)).toBe('r0')
    const after = scene.speedOf(scene.carBodies[0]!)
    const expected = before - (mass / (mass + CAR_MASS)) * before
    expect(Math.abs(after - expected) / before).toBeLessThan(0.05)
    expect(Math.abs((CAR_MASS * after + mass * expected - CAR_MASS * before) / (CAR_MASS * before))).toBeLessThan(0.05)
    scene.dispose()
  })

  it.each([
    ['an adult zombie at 15 km/h is knocked down and lives', ZOMBIE, 15, 'knock', false],
    ['an adult zombie at 25 km/h dies of the energy of the hit', ZOMBIE, 25, 'knock', true],
    ['a child pedestrian at 20 km/h is knocked down and lives (a lighter body takes less energy)', pedestrian(CHILD), 20, 'knock', false],
    ['an adult pedestrian at 30 km/h dies', pedestrian(ADULT), 30, 'kill', true],
  ] as const)('%s', { timeout: 60000 }, async (_name, walker, kmh, outcome, dies) => {
    const scene = await makeScene([{ x: 0, z: 3, ...walker }], [{ x: 0, z: -3, kmh }])
    scene.untilHit(5)
    expect(scene.hits.map((hit) => hit.outcome)).toEqual([outcome])
    expect(scene.crowd.corpses.entries).toHaveLength(dies ? 1 : 0)
    if (!dies) expect(scene.crowd.store.state[0]).toBe(STATE.STUNNED)
    scene.dispose()
  })

  it('a car at 5 km/h only pushes: the body is moved aside, lives, stands, and the car is held a little', { timeout: 60000 }, async () => {
    const scene = await makeScene([{ x: 0.2, z: 3, ...ZOMBIE }], [{ x: 0, z: -3, kmh: 5 }])
    const before = scene.speedOf(scene.carBodies[0]!)
    scene.run(4)
    expect(scene.hits.length).toBeGreaterThan(0)
    expect(new Set(scene.hits.map((hit) => hit.outcome))).toEqual(new Set(['push']))
    expect(scene.crowd.corpses.entries).toHaveLength(0)
    expect(scene.crowd.store.n).toBe(1)
    expect(scene.crowd.store.state[0]).not.toBe(STATE.STUNNED)
    const after = scene.speedOf(scene.carBodies[0]!)
    expect(after).toBeLessThan(before)
    scene.dispose()
  })

  it('the agent is never a wall: a car at 40 km/h crosses twenty agents', { timeout: 60000 }, async () => {
    const walkers = Array.from({ length: 20 }, (_unused, k) => ({ x: (k % 2) * 0.8 - 0.4, z: 8 + k * 1.5, ...ZOMBIE }))
    const scene = await makeScene(walkers, [{ x: 0, z: -8, kmh: 40 }])
    scene.run(12)
    expect(scene.crowd.store.n + scene.crowd.corpses.entries.length).toBe(20)
    expect(scene.crowd.corpses.entries.length).toBeGreaterThan(4)
    expect(scene.zOf(scene.carBodies[0]!)).toBeGreaterThan(20)
    scene.dispose()
  })

  const crowded = async (): Promise<{ readonly hash: string; readonly registry: string; readonly rungs: number; readonly cars: string; readonly hits: number }> => {
    const walkers = Array.from({ length: 10 }, (_unused, k) => ({ x: (k % 2 ? 3 : -3) + ((k >> 1) % 3) * 0.7 - 0.7, z: 6 + (k >> 1) * 2.5, ...ZOMBIE }))
    const scene = await makeScene(walkers, [{ x: -3, z: -8, kmh: 36 }, { x: 3, z: -8, kmh: 28 }])
    scene.run(5)
    const registry = JSON.stringify(scene.crowd.corpses.entries.map((entry) => ({ id: entry.id, data: entry.data })))
    const cars = JSON.stringify(scene.carBodies.map((body) => Number(scene.speedOf(body).toFixed(9))))
    const result = { hash: hashCrowdState(scene.crowd), registry, rungs: scene.bodies.rungHash(), cars, hits: scene.hits.length }
    scene.dispose()
    return result
  }

  it('two cars and ten zombies give the same hashCrowdState, corpses and car speeds in two runs', { timeout: 120000 }, async () => {
    const first = await crowded()
    const second = await crowded()
    expect(first.hits).toBeGreaterThan(4)
    expect(JSON.parse(first.registry).length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  })

  it('the heap is what it was after three warm-up cycles: makes and throws away the run-over, the agents and the corpses', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD) as JoltWorld
    const shared = { world, loop: createPhysicsLoop(world) }
    world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
    const cycle = async (): Promise<void> => {
      const scene = await makeScene([{ x: 0, z: 3, ...ZOMBIE }, { x: 1.5, z: 5, ...ZOMBIE }], [{ x: 0, z: -3, kmh: 30 }], shared)
      scene.run(1.5)
      expect(scene.hits.length).toBeGreaterThan(0)
      scene.dispose()
    }
    for (let round = 0; round < 3; round++) await cycle()
    const bodiesAfterWarmUp = world.bodyCount
    const heapAfterWarmUp = world.memoryInUse()
    for (let round = 0; round < 3; round++) await cycle()
    expect(world.bodyCount).toBe(bodiesAfterWarmUp)
    // the allocator's bookkeeping moves a few bytes between cycles (measured: 8 to 24); one leaked ragdoll is kilobytes
    expect(Math.abs(world.memoryInUse() - heapAfterWarmUp)).toBeLessThan(256)
    world.dispose()
  })
})
