import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

import { createImpactReader, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyDesc, BodyId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
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
const run = async (): Promise<Cascade> => {
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
  // contacts -> damage through the engine's impact reader: the strongest blow on each body of the frame, told once, with arrays made once (no allocation per contact)
  const loop = createPhysicsLoop(world)
  let blows = 0
  const stopReader = createImpactReader(loop, {
    minImpulse: 1,
    bodiesMax: 1024,
    onImpact: (impact) => {
      blows++
      // the cylinder goes off on a blow over 150 N s (a crate thrown into it), then blows the wall apart
      if (wentOff < 0 && impact.body === cylinder && impact.impulse > 150) wentOff = frame / 60
    },
  })
  let frame = 0
  for (let f = 0; f < 600; f++) {
    frame = f
    if (f === 30) blast(world, [3, 0.5, 1.5], 3, 400, near, pose)
    if (f === 31) {
      heap0 = process.memoryUsage().heapUsed
      wasm0 = world.memoryInUse()
    }
    const t0 = performance.now()
    const before = world.activeCount
    loop.stepFixed(1)
    steps.push(performance.now() - t0)
    contactRows.push(world.contacts.count)
    hitsToDamage = blows
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
  stopReader()
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
    // the JS heap does not grow with the frames (the cost lane's note: spec.md 6.2 asks it of the cascade; the engine's own heap is `heap.test.ts`)
    expect(a.heapBytes).toBeLessThan(2_000_000)
  })

  it('the impact reader makes nothing per contact row and per frame: the bouncing frames allocate only a few bytes for each blow it tells', { timeout: 120000 }, async () => {
    setFlagsFromString('--expose_gc')
    const collect = runInNewContext('gc') as () => void
    const engine = await createJoltEngine()
    const frames = async (withReader: boolean): Promise<{ readonly allocated: number; readonly told: number }> => {
      const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 1024, contactReportSpeed: 0.2 })
      ground(world, 20)
      const loop = createPhysicsLoop(world)
      for (let i = 0; i < 80; i++) {
        world.createBody({ shape: { kind: 'sphere', radius: 0.15 }, motion: 'dynamic', mass: 2, position: [(i % 10) * 0.35 - 1.6, 0.5 + Math.floor(i / 10) * 0.4, 0], material: { frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0.85 }, layer: 'debris', user: i })
      }
      let told = 0
      const stop = withReader ? createImpactReader(loop, { minImpulse: 0.01, bodiesMax: 256, onImpact: () => told++ }) : undefined
      for (let f = 0; f < 60; f++) loop.stepFixed(1)
      collect()
      const before = process.memoryUsage().heapUsed
      for (let f = 0; f < 240; f++) loop.stepFixed(1)
      const allocated = process.memoryUsage().heapUsed - before
      stop?.()
      world.dispose()
      return { allocated, told }
    }
    await frames(true)
    const without = await frames(false)
    const withReader = await frames(true)
    report('impact-reader-allocation', { withoutBytes: without.allocated, withBytes: withReader.allocated, blowsTold: withReader.told })
    expect(withReader.told).toBeGreaterThan(200)
    // a blow told is the unit: the numbers handed to `onImpact` cost a few bytes each (about 100), a row that is not told costs none, and a frame with no blow nothing
    expect((withReader.allocated - without.allocated) / withReader.told).toBeLessThan(200)
  })
})
