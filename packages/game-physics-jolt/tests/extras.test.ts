import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import type { BodyDesc, BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { eulerXYZ, ground, report, stairs, stats } from './scenes'

describe('case 7: small demos', () => {
  it('(a) character controller: stairs, a 30 degree ramp, pushing a crate; 1 and 50 controllers', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 }) as JoltWorld
    ground(world)
    stairs(world, [0, 0, 0])
    world.createBody({ shape: { kind: 'box', half: [1, 0.05, 3] }, motion: 'static', position: [4, 1.5 * Math.sin(Math.PI / 6), -1.3], rotation: eulerXYZ(Math.PI / 6, 0, 0), user: -1 })
    const crate = world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 30, position: [-4, 0.3, -2], layer: 'prop', user: 5 })
    const me = world.createCharacter([0, 0, 1], 0.3, 0.6, 75, 400)
    const p = new Float64Array(3)
    let top = 0
    for (let i = 0; i < 180; i++) {
      me.update(1 / 60, 0, -1.5)
      world.step(1 / 60)
      me.position(p)
      top = Math.max(top, p[1])
    }
    const ramp = world.createCharacter([4, 0, 2], 0.3, 0.6, 75, 400)
    let rampTop = 0
    for (let i = 0; i < 240; i++) {
      ramp.update(1 / 60, 0, -1.5)
      world.step(1 / 60)
      ramp.position(p)
      rampTop = Math.max(rampTop, p[1])
    }
    const pusher = world.createCharacter([-4, 0, 0], 0.3, 0.6, 75, 400)
    const c = new Float64Array(7)
    for (let i = 0; i < 180; i++) {
      pusher.update(1 / 60, 0, -1.2)
      world.step(1 / 60)
    }
    world.readPose(crate, c, 0)
    const crowd = Array.from({ length: 50 }, (_, i) => world.createCharacter([(i % 10) - 5, 0, 6 + Math.floor(i / 10)], 0.3, 0.6, 75, 400))
    const t50: number[] = []
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now()
      for (const [k, ch] of crowd.entries()) ch.update(1 / 60, Math.sin(i / 30 + k), Math.cos(i / 30 + k))
      t50.push(performance.now() - t0)
      world.step(1 / 60)
    }
    const t1: number[] = []
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now()
      me.update(1 / 60, 1, 0)
      t1.push(performance.now() - t0)
      world.step(1 / 60)
    }
    report('character', { stairsTopReached: top, stairsTop: 0.9, rampTopReached: rampTop, crateMovedZ: c[2] + 2, update1: stats(t1), update50: stats(t50) })
    expect(top).toBeGreaterThan(0.85)
    for (const ch of [me, ramp, pusher, ...crowd]) ch.dispose()
    world.dispose()
  })

  it('(b) pick up, carry, drop and throw; a grenade bouncing to rest; 200 casings with continuous collision', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    ground(world)
    const can = world.createBody({ shape: { kind: 'cylinder', halfHeight: 0.06, radius: 0.033 }, motion: 'dynamic', mass: 0.4, position: [0, 0.06, 0], layer: 'prop', user: 1 })
    world.setMotion(can, 'kinematic')
    for (let i = 0; i < 60; i++) {
      world.moveKinematic(can, [i / 60, 1.2, 0], [0, 0, 0, 1], 1 / 60)
      world.step(1 / 60)
    }
    world.setMotion(can, 'dynamic')
    world.setVelocity(can, [6, 3, 0], [0, 0, 5])
    const pose = new Float64Array(7)
    let landed = -1
    for (let i = 0; i < 180; i++) {
      world.step(1 / 60)
      world.readPose(can, pose, 0)
      if (landed < 0 && world.touching(can)) landed = i / 60
    }
    const thrownTo = pose[0]
    // a 400 g grenade (6 cm ball) thrown at 12 m/s onto concrete: bounces, rolls, rests
    const grenade = world.createBody({ shape: { kind: 'sphere', radius: 0.03 }, motion: 'dynamic', mass: 0.4, position: [0, 1.5, 5], material: { frictionStatic: 0.6, frictionDynamic: 0.5, restitution: 0.35 }, linearVelocity: [0, 4, 11], continuous: true, user: 2 })
    let bounces = 0
    let lastVy = 0
    let restAt = -1
    for (let i = 0; i < 600; i++) {
      world.step(1 / 60)
      const v = new Float64Array(6)
      world.readVelocity(grenade, v, 0)
      if (lastVy < -0.5 && v[1] > 0.2) bounces++
      lastVy = v[1]
      if (restAt < 0 && world.isSleeping(grenade)) restAt = i / 60
    }
    world.readPose(grenade, pose, 0)
    const grenadeRest = [...pose.slice(0, 3)]
    // 200 9 mm casings (10 x 19 mm) ejected at 4-6 m/s: none ends under the floor
    const casings: BodyId[] = []
    const t: number[] = []
    for (let i = 0; i < 200; i++) {
      casings.push(world.createBody({ shape: { kind: 'cylinder', halfHeight: 0.0095, radius: 0.005 }, motion: 'dynamic', mass: 0.004, position: [10, 1.4, (i % 20) * 0.02], linearVelocity: [4 + (i % 7) * 0.3, 2 + (i % 5) * 0.2, (i % 3) - 1], angularVelocity: [20, 5, 0], continuous: true, material: { frictionStatic: 0.4, frictionDynamic: 0.3, restitution: 0.4 }, user: 100 + i }))
      const t0 = performance.now()
      world.step(1 / 60)
      t.push(performance.now() - t0)
    }
    for (let i = 0; i < 300; i++) {
      const t0 = performance.now()
      world.step(1 / 60)
      t.push(performance.now() - t0)
    }
    let under = 0
    let asleep = 0
    for (const c of casings) {
      world.readPose(c, pose, 0)
      if (pose[1] < 0) under++
      if (world.isSleeping(c)) asleep++
    }
    report('pick-throw-grenade-casings', { thrownLandedAtS: landed, thrownTo, grenadeBounces: bounces, grenadeRestAtS: restAt, grenadeRest, casingsUnderFloor: under, casingsAsleep: asleep, step200casings: stats(t) })
    expect(under).toBe(0)
    world.dispose()
  })

  it('(c) 2000 fixed colliders added and removed at runtime; precision 5 km from the origin', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192 })
    ground(world)
    const descs: BodyDesc[] = Array.from({ length: 2000 }, (_, i) => ({ shape: { kind: 'box', half: [0.5, 0.5, 0.1] }, motion: 'static', position: [(i % 50) - 25, 0.5 + Math.floor(i / 50) * 0.01, Math.floor(i / 50)], user: i }))
    const mem0 = world.memoryInUse()
    let t0 = performance.now()
    const batch = world.createBodies(descs)
    const addBatch = performance.now() - t0
    const memPer = (world.memoryInUse() - mem0) / 2000
    t0 = performance.now()
    world.step(1 / 60)
    const firstStep = performance.now() - t0
    t0 = performance.now()
    for (const b of batch) world.removeBody(b)
    const remove = performance.now() - t0
    t0 = performance.now()
    const single = descs.map((d) => world.createBody(d))
    const addOne = performance.now() - t0
    for (const b of single) world.removeBody(b)
    // 5 km out: a box at rest on a floor there, and a slow slide
    const far = 5000
    world.createBody({ shape: { kind: 'box', half: [5, 0.5, 5] }, motion: 'static', position: [far, -0.5, far], user: -1 })
    const box = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 10, position: [far, 0.2, far], user: 1 })
    const near = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 10, position: [2, 0.2, 2], user: 2 })
    world.setVelocity(box, [0.3, 0, 0], [0, 0, 0])
    world.setVelocity(near, [0.3, 0, 0], [0, 0, 0])
    for (let i = 0; i < 120; i++) world.step(1 / 60)
    const a = new Float64Array(7)
    const b = new Float64Array(7)
    world.readPose(box, a, 0)
    world.readPose(near, b, 0)
    report('static-churn-far', {
      add2000BatchMs: addBatch, add2000OneByOneMs: addOne, remove2000Ms: remove, firstStepAfterMs: firstStep, wasmBytesPerStatic: Math.round(memPer),
      slideAt5km: a[0] - far, slideAtOrigin: b[0] - 2, restHeightAt5km: a[1], restHeightAtOrigin: b[1], floatStepAt5km: Math.fround(5000.0001) - 5000,
    })
    world.dispose()
  })

  it('(d) save, run, load, run again: bit-identical', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 }) as JoltWorld
    ground(world)
    const ids = Array.from({ length: 100 }, (_, i) => world.createBody({ shape: { kind: 'box', half: [0.2, 0.1, 0.15] }, motion: 'dynamic', mass: 5, position: [(i % 10) * 0.3, 1 + Math.floor(i / 10) * 0.3, (i % 3) * 0.1], user: i }))
    for (let i = 0; i < 30; i++) world.step(1 / 60)
    const t0 = performance.now()
    const saved = world.saveState()
    const saveMs = performance.now() - t0
    const hashAfter = (): string => {
      for (let i = 0; i < 120; i++) world.step(1 / 60)
      const h = createHash('sha256')
      const p = new Float64Array(7)
      for (const id of ids) {
        world.readPose(id, p, 0)
        h.update(p)
      }
      return h.digest('hex').slice(0, 16)
    }
    const first = hashAfter()
    const ok = world.restoreState(saved)
    const second = hashAfter()
    report('save-load', { bytes: saved.length, saveMs, restored: ok, first, second, identical: first === second })
    expect(first).toBe(second)
    world.dispose()
  })
})
