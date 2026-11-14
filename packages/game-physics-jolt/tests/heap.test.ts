import { describe, expect, it } from 'vitest'

import type { BodyDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground, report } from './scenes'

/**
 * Gate 0 B4: the worst scene in one world, made as the room makes its world (1/120 s, 20 passes, 8192 bodies): a city block of 2000 fixed colliders, the
 * 500-body cascade woken by a blast, 100 dead bodies piled as the engine's ragdolls, and the debris bench (160 resting pieces, 40 moving). The peak of the wasm
 * heap in use over 5 s, against the heap's fixed size; then the same made and thrown away five times, which must hand the heap back to the byte.
 */
const worst = async (): Promise<{ peak: number; total: number; before: number; after: number; bodies: number }> => {
  const engine = await createJoltEngine()
  const probe = engine.createWorld({}) as JoltWorld
  const total = probe.memoryTotal()
  probe.dispose()
  const before = (engine.createWorld({}) as JoltWorld)
  const used0 = before.memoryInUse()
  before.dispose()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08, penetrationSlop: 0.002, maxPushOut: 0.002, maxBodies: 8192 }) as JoltWorld
  ground(world, 200)
  // the city block: 2000 fixed boxes (walls, slabs, posts) on a 40 x 50 grid west of the rest
  const statics: BodyDesc[] = []
  for (let i = 0; i < 2000; i++) statics.push({ shape: { kind: 'box', half: [1 + (i % 3) * 0.5, 1.5, 0.1 + (i % 2) * 0.4] }, motion: 'static', position: [-60 - (i % 40) * 3, 1.5, -75 + Math.floor(i / 40) * 3], user: -1 })
  world.createBodies(statics)
  // the cascade: wall, slab and crates asleep, a blast at 30 frames reaching all of them
  const cascade: BodyDesc[] = []
  const block = (at: Vec3, half: Vec3, mass: number): void => {
    cascade.push({ shape: { kind: 'box', half }, motion: 'dynamic', mass, position: at, sleeping: true, layer: 'debris', user: cascade.length })
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38)
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4], [0.5, 0.075, 0.2], 150)
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20)
  const cascadeIds = world.createBodies(cascade)
  // 100 dead bodies against a wall
  world.createBody({ shape: { kind: 'box', half: [6, 1.5, 0.2] }, motion: 'static', position: [30, 1.5, -0.2], user: -1 })
  for (let i = 0; i < 100; i++) {
    const at: Vec3 = [30 + ((i % 10) - 5) * 0.8, 0.3 + Math.floor(i / 10) * 0.45, 0.6 + (i % 3) * 0.3]
    world.createRagdoll({
      stabilize: true,
      parts: [
        { body: { shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.17 }, mass: 40, position: [at[0], at[1] + 1.25, at[2]], layer: 'character', user: i }, parent: -1 },
        { body: { shape: { kind: 'sphere', radius: 0.11 }, mass: 5, position: [at[0], at[1] + 1.75, at[2]], layer: 'character', user: i }, parent: 0, joint: { kind: 'swingTwist', point: [at[0], at[1] + 1.62, at[2]], twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 } },
        { body: { shape: { kind: 'capsule', halfHeight: 0.3, radius: 0.15 }, mass: 25, position: [at[0], at[1] + 0.45, at[2]], layer: 'character', user: i }, parent: 0, joint: { kind: 'swingTwist', point: [at[0], at[1] + 0.92, at[2]], twistAxis: [0, -1, 0], planeAxis: [0, 0, 1], normalHalfCone: 1.2, planeHalfCone: 1.0, twistMin: -0.4, twistMax: 0.4 } },
      ],
    })
  }
  // the debris bench: 160 two-part pieces resting, 40 thrown
  const debris: BodyDesc[] = []
  for (let i = 0; i < 200; i++) {
    const moving = i >= 160
    debris.push({
      shape: { kind: 'compound', children: [{ shape: { kind: 'box', half: [0.08, 0.04, 0.06] }, position: [0, 0, 0], tag: 0 }, { shape: { kind: 'box', half: [0.04, 0.04, 0.04] }, position: [0.1, 0, 0], tag: 1 }] },
      motion: 'dynamic', mass: 2, position: [60 + (i % 20) * 0.4, moving ? 1 + (i % 5) * 0.3 : 0.04, Math.floor(i / 20) * 0.4], sleeping: !moving, continuous: moving,
      linearVelocity: moving ? [(i % 7) - 3, 2, (i % 5) - 2] : [0, 0, 0], layer: 'debris', user: 1000 + i,
    })
  }
  world.createBodies(debris)
  const pose = new Float64Array(7)
  let peak = world.memoryInUse()
  for (let f = 0; f < 300; f++) {
    if (f === 30) {
      for (const id of cascadeIds) {
        world.readPose(id, pose, 0)
        const d: Vec3 = [pose[0] - 0.5, pose[1] - 0.3, pose[2] - 1.2]
        const l = Math.hypot(...d) || 1
        const k = 2500 * Math.max(0.05, 1 - l / 12)
        world.addImpulse(id, [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k])
      }
    }
    world.step(1 / 60)
    peak = Math.max(peak, world.memoryInUse())
  }
  const bodies = world.bodyCount
  world.dispose()
  const after = engine.createWorld({}) as JoltWorld
  const used1 = after.memoryInUse()
  after.dispose()
  return { peak, total, before: used0, after: used1, bodies }
}

describe('gate 0 B4: wasm heap', () => {
  it('the worst scene in one world stays under half the heap, and five of them made and thrown away give the heap back', { timeout: 300000 }, async () => {
    const runs = []
    for (let i = 0; i < 5; i++) runs.push(await worst())
    const mb = (x: number): number => Math.round((x / 1048576) * 10) / 10
    report('heap-worst', { totalMB: mb(runs[0].total), bodies: runs[0].bodies, peakInUseMB: runs.map((r) => mb(r.peak)), peakShare: Math.round((runs[0].peak / runs[0].total) * 1000) / 1000, beforeBytes: runs.map((r) => r.before), afterBytes: runs.map((r) => r.after) })
    for (const r of runs) expect(r.peak).toBeLessThan(r.total * 0.5)
    // C9: after the first (which leaves Jolt's one-time allocations behind), every made-and-thrown-away world hands the heap back to the byte
    for (const r of runs.slice(1)) {
      expect(r.before).toBe(runs[0].after)
      expect(r.after).toBe(runs[0].after)
    }
    expect(runs[0].after - runs[0].before).toBeLessThan(4096)
  })
})
