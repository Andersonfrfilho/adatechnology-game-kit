import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import type { BodyDesc, BodyId, PhysicsWorld, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground, report, stats } from './scenes'

interface Cascade {
  readonly hash: string
  readonly steps: number[]
  readonly wokeInOneFrame: number
  readonly cylinderWentOffAtS: number
  readonly contactRows: number[]
  readonly hitsToDamage: number
  readonly heapBytes: number
  readonly wasmBytes: number
  readonly wrapperCache: number
}

/** A radial blow from `at`: every dynamic body within `radius` gets `impulse` N s scaled by distance, as our blast hands its pushes to the bodies. */
const blast = (world: PhysicsWorld, at: Vec3, radius: number, impulse: number, near: BodyId[], pose: Float64Array): number => {
  const n = world.overlapSphere(at, radius, near)
  for (let i = 0; i < n; i++) {
    world.readPose(near[i], pose, 0)
    const d: Vec3 = [pose[0] - at[0], pose[1] - at[1] + 0.3, pose[2] - at[2]]
    const l = Math.hypot(...d) || 1
    const k = impulse * Math.max(0, 1 - l / radius)
    world.addImpulse(near[i], [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k])
  }
  return n
}

/**
 * Blast -> gas cylinder goes off when hit hard enough (a contact row with impulse fed to our damage) -> wall of 400 blocks -> a slab of 50 pieces on it comes down
 * -> 50 crates around. Everything starts asleep; ~500 bodies wake within a frame of the cylinder going off.
 */
const PARKED_CAR_HULLS = 24

/** A parked car as the engine holds it (design 10.4): one shared compound of convex hulls, tagged by part, that every car of the model uses. */
const parkedCar: ShapeDesc = {
  kind: 'compound',
  children: Array.from({ length: PARKED_CAR_HULLS }, (_, i) => {
    const x = (i % 3) * 0.5 - 0.5, y = 0.15 + Math.floor(i / 12) * 0.5, z = (Math.floor(i / 3) % 4) * 1.1 - 1.65
    const points: number[] = []
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, r = 0.18 + 0.04 * Math.sin(k * 3 + i)
      points.push(x + r * Math.cos(a), y + 0.1 * Math.sin(k * 5), z + r * 1.6 * Math.sin(a))
    }
    return { shape: { kind: 'convex', points } as ShapeDesc, position: [0, 0, 0] as Vec3, tag: i }
  }),
}

const run = async (parked = 0): Promise<Cascade> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192, contactReportSpeed: 1 }) as JoltWorld
  ground(world, 100)
  const descs: BodyDesc[] = []
  const block = (at: Vec3, half: Vec3, mass: number, user: number): void => {
    descs.push({ shape: { kind: 'box', half }, motion: 'dynamic', mass, position: at, sleeping: true, layer: 'debris', user })
  }
  // the wall: 20 x 20 blocks of 40 x 20 x 20 cm, staggered
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38, descs.length)
  // the slab on top: 5 x 10 pieces of 1 x 0.15 x 0.4 m reaching back over the wall
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4 - 0.0], [0.5, 0.075, 0.2], 150, descs.length)
  // 50 crates in front
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20, descs.length)
  const ids = world.createBodies(descs)
  // parked cars in the island of the blast, asleep, all from one shared compound of hulls
  if (parked > 0) {
    const shared = world.createSharedShape(parkedCar)
    for (let i = 0; i < parked; i++) ids.push(world.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 1200, position: [(i % 5) * 2.4 - 4.8, 0.9, 3 + Math.floor(i / 5) * 1.6], sleeping: true, layer: 'vehicle', user: 5000 + i }))
  }
  // the gas cylinder by the wall
  const cylinder = world.createBody({ shape: { kind: 'cylinder', halfHeight: 0.6, radius: 0.15 }, motion: 'dynamic', mass: 30, position: [0.5, 0.6, 0.6], layer: 'prop', user: 99999 })
  const near: BodyId[] = []
  const pose = new Float64Array(7)
  const steps: number[] = []
  const contactRows: number[] = []
  let wentOff = -1
  let woke = 0
  let hitsToDamage = 0
  let heap0 = 0
  let wasm0 = 0
  // what our damage keeps of each blow: the strongest per body this frame, in arrays made once (no allocation per contact)
  const blow = new Float32Array(16384)
  for (let f = 0; f < 600; f++) {
    if (f === 30) blast(world, [3, 0.5, 1.5], 3, 400, near, pose)
    if (f === 31) {
      heap0 = process.memoryUsage().heapUsed
      wasm0 = world.memoryInUse()
    }
    const t0 = performance.now()
    const before = world.activeCount
    world.step(1 / 60)
    steps.push(performance.now() - t0)
    const c = world.contacts
    contactRows.push(c.count)
    // contacts -> damage: the impulse each row carries, by the user value (our part), the cylinder among them
    for (let i = 0; i < c.count; i++) {
      const j = c.impulse[i]
      if (c.userA[i] >= 0 && c.userA[i] < blow.length) blow[c.userA[i]] = Math.max(blow[c.userA[i]], j)
      if (c.userB[i] >= 0 && c.userB[i] < blow.length) blow[c.userB[i]] = Math.max(blow[c.userB[i]], j)
      hitsToDamage++
      // the cylinder goes off on a blow over 150 N s (a crate thrown into it), then blows the wall apart
      if (wentOff < 0 && (c.userA[i] === 99999 || c.userB[i] === 99999) && j > 150) wentOff = f / 60
    }
    blow.fill(0)
    if (wentOff >= 0 && Math.round(wentOff * 60) === f) {
      world.readPose(cylinder, pose, 0)
      const at: Vec3 = [pose[0], pose[1], pose[2]]
      world.removeBody(cylinder)
      const a0 = world.activeCount
      blast(world, at, 9, 2500, near, pose)
      world.step(0)
      woke = Math.max(woke, world.activeCount - a0)
    }
    woke = Math.max(woke, world.activeCount - before)
  }
  const hash = createHash('sha256')
  const all = new Float64Array(7)
  for (const id of ids) {
    world.readPose(id, all, 0)
    hash.update(all)
  }
  const cache = (Object.values(engine.jolt) as unknown[]).reduce<number>((n, v) => {
    const c = (v as { __cache__?: Record<string, unknown> } | null)?.__cache__
    return n + (c ? Object.keys(c).length : 0)
  }, 0)
  const out = {
    hash: hash.digest('hex').slice(0, 16), steps, wokeInOneFrame: woke, cylinderWentOffAtS: wentOff, contactRows, hitsToDamage,
    heapBytes: process.memoryUsage().heapUsed - heap0, wasmBytes: world.memoryInUse() - wasm0, wrapperCache: cache,
  }
  world.dispose()
  return out
}

describe('case 5: chain reaction', () => {
  it('blast -> cylinder -> wall -> slab: ~500 bodies wake at once; step cost, contact rows, determinism', { timeout: 300000 }, async () => {
    const a = await run()
    const b = await run()
    const after = a.steps.slice(30)
    report('cascade', {
      cylinderWentOffAtS: a.cylinderWentOffAtS, wokeInOneFrame: a.wokeInOneFrame, stepAfterBlast: stats(after), stepBefore: stats(a.steps.slice(0, 30)),
      maxContactRowsPerStep: Math.max(...a.contactRows), hitsToDamage: a.hitsToDamage, jsHeapGrowthBytes: a.heapBytes, wasmHeapGrowthBytes: a.wasmBytes,
      wrapperCacheEntries: a.wrapperCache, hash: a.hash, sameInProcess: a.hash === b.hash,
    })
    expect(a.hash).toBe(b.hash)
  })

  it('T6.21: the same with 20 parked cars of hulls in the island of the blast: they wake, and the run is the same twice', { timeout: 300000 }, async () => {
    const a = await run(20)
    const b = await run(20)
    const plain = await run()
    report('cascade-parked-cars', {
      cars: 20, hullsPerCar: PARKED_CAR_HULLS, wokeInOneFrame: a.wokeInOneFrame, plainWokeInOneFrame: plain.wokeInOneFrame, stepAfterBlast: stats(a.steps.slice(30)), plainStepAfterBlast: stats(plain.steps.slice(30)),
      maxContactRowsPerStep: Math.max(...a.contactRows), hash: a.hash, sameInProcess: a.hash === b.hash,
    })
    expect(a.hash).toBe(b.hash)
    expect(a.cylinderWentOffAtS).toBeGreaterThan(0)
    // the cars are in the island: more bodies wake than without them
    expect(a.wokeInOneFrame).toBeGreaterThan(plain.wokeInOneFrame)
  })
})
