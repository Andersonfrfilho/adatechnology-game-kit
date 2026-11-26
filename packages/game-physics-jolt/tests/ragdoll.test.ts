import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { chainOfRig, createRig, GUIDE } from '@adatechnology/game-characters'
import { KIT_RAGDOLL_SOLVER, KIT_WORLD } from '@adatechnology/game-physics'
import type { WorldDesc } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { engineRagdoll, expectCostAtMost, ground, ragdoll, report, stairs, stats } from './scenes'
import type { Ragdoll } from './scenes'

/** 9x19 FMJ of game-weapons: 7.5 g at 365 m/s, stopped in the body: 2.74 N s. */
const NINE_MM_IMPULSE = 0.0075 * 365

describe('case 2: ragdoll', () => {
  /** Dropped from 2 m onto the stairs and a box, shot at 1.5 s: speeds, the worst joint past its limit and for how many frames in a row past 0.1 rad, sleep. */
  const drop = async (make: (world: JoltWorld) => Ragdoll, worldDesc: WorldDesc = { fixedStep: 1 / 60 }): Promise<Record<string, unknown> & { asleepAtS: number; longestFramesOver0_1rad: number; maxLimitExcessRad: number }> => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(worldDesc) as JoltWorld
    ground(world)
    stairs(world, [0, 0, 0])
    world.createBody({ shape: { kind: 'box', half: [0.4, 0.3, 0.4] }, motion: 'static', position: [0.5, 0.3, 1.2], user: -1 })
    const doll = make(world)
    const pose = new Float64Array(7)
    const vel = new Float64Array(6)
    let maxSpeed = 0
    let maxExcess = 0
    let worst = ''
    let overFrames = 0
    let longestOver = 0
    let asleepAt = -1
    let lateSpeed = 0
    const steps: number[] = []
    const excessOf = (j: Ragdoll['joints'][number]): number => {
      const a = world.jointAngles(j.id)
      if (j.desc.kind === 'hinge') return Math.max(j.desc.min - a.hinge, a.hinge - j.desc.max)
      if (j.desc.kind === 'swingTwist') return Math.max(a.swing - Math.max(j.desc.normalHalfCone, j.desc.planeHalfCone), Math.abs(a.twist) - j.desc.twistMax)
      return 0
    }
    for (let i = 0; i < 60 * 8; i++) {
      if (i === 90) world.addImpulse(doll.bodies[1], [NINE_MM_IMPULSE, 0, 0], undefined)
      const t0 = performance.now()
      world.step(1 / 60)
      steps.push(performance.now() - t0)
      let awake = 0
      for (const b of doll.bodies) {
        world.readVelocity(b, vel, 0)
        const s = Math.hypot(vel[0], vel[1], vel[2])
        maxSpeed = Math.max(maxSpeed, s)
        if (i > 60 * 5) lateSpeed = Math.max(lateSpeed, s)
        if (!world.isSleeping(b)) awake++
        world.readPose(b, pose, 0)
        expect(Number.isFinite(pose[1])).toBe(true)
      }
      let frameExcess = 0
      doll.joints.forEach((j, k) => {
        const e = excessOf(j)
        frameExcess = Math.max(frameExcess, e)
        if (e > maxExcess) {
          maxExcess = e
          worst = `${k} ${j.desc.kind} frame ${i} ${JSON.stringify(world.jointAngles(j.id))}`
        }
      })
      overFrames = frameExcess > 0.1 ? overFrames + 1 : 0
      longestOver = Math.max(longestOver, overFrames)
      if (awake === 0 && asleepAt < 0) asleepAt = i / 60
      if (awake > 0) asleepAt = -1
    }
    world.dispose()
    return { maxSpeed, lateSpeed, maxLimitExcessRad: maxExcess, worst, longestFramesOver0_1rad: longestOver, asleepAtS: asleepAt, step: stats(steps) }
  }

  it('drops onto the stairs from 2 m, takes a 9 mm shot, settles asleep within its limits (loose bodies and joints)', async () => {
    const r = await drop((world) => ragdoll(world, [0, 2 + 0.36, -0.5], 0))
    report('ragdoll-stairs', r)
    expect(r.asleepAtS).toBeGreaterThan(0)
    // measured 17 frames (0.28 s) on the ankle at the 2 m landing: soft limits, see the report; the gate only catches a joint that stays broken
    expect(r.longestFramesOver0_1rad).toBeLessThan(30)
  })

  it('the same as the engine\'s own ragdoll, stabilized, 20 velocity and 8 position passes (gate 0 B3): no joint 0.1 rad past its limit for over 3 frames, asleep within 4 s', async () => {
    const r = await drop((world) => engineRagdoll(world, [0, 2 + 0.36, -0.5], 0, true, { velocity: 20, position: 8 }))
    report('ragdoll-stairs-engine', r)
    expect(r.asleepAtS).toBeGreaterThan(0)
    expect(r.asleepAtS).toBeLessThanOrEqual(4)
    expect(r.longestFramesOver0_1rad).toBeLessThanOrEqual(3)
  })

  it('production R0 in the kit\'s world (120 Hz, 32/2), stabilized, 20/8: no joint 0.1 rad past its limit for over 3 frames, asleep within 4 s (B3)', async () => {
    const r = await drop((world) => engineRagdoll(world, [0, 2 + 0.36, -0.5], 0, true, KIT_RAGDOLL_SOLVER), KIT_WORLD)
    report('ragdoll-stairs-kit-world', r)
    expect(r.asleepAtS).toBeGreaterThan(0)
    expect(r.asleepAtS).toBeLessThanOrEqual(4)
    expect(r.longestFramesOver0_1rad).toBeLessThanOrEqual(3)
  })

  /** The quota of full ragdolls (R0): the most that fits the C7 in the kit's world, measured (specs/008 evidence, T5.1). */
  const RAGDOLLS_MAX = 1

  /** `r0` production R0 and the rest as R1 chains, all dropped at once into the kit's world: a 1/60 s frame (two steps) over the first 3 s, while they fall and pile. */
  const costOfDead = async (total: number, r0: number): Promise<{ bodies: number; falling: ReturnType<typeof stats> }> => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD)
    const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })
    ground(world)
    for (let i = 0; i < total; i++) {
      const at: [number, number, number] = [(i % 5) * 0.7, 0.5 + Math.floor(i / 5) * 0.6, (i % 3) * 0.3]
      if (i < r0) engineRagdoll(world, at, i, true, KIT_RAGDOLL_SOLVER)
      else world.createRagdoll({ ...chainOfRig({ rig, body: GUIDE, build: 1, at, user: i }), stabilize: true })
    }
    const frames: number[] = []
    for (let i = 0; i < 180; i++) {
      const t0 = performance.now()
      world.step(1 / 60)
      frames.push(performance.now() - t0)
    }
    const bodies = world.bodyCount
    world.dispose()
    return { bodies, falling: stats(frames) }
  }

  it(`costs: ${RAGDOLLS_MAX} production R0 falling and piling in the kit's world: a 1/60 s frame (two steps) within the C7 budget, 3.0 ms median and 4.0 ms p99`, { timeout: 60000 }, async () => {
    const { bodies, falling } = await costOfDead(RAGDOLLS_MAX, RAGDOLLS_MAX)
    report('ragdoll-r0-kit-world', { r0: RAGDOLLS_MAX, bodies, frameFirst3s: falling })
    expect(bodies).toBe(RAGDOLLS_MAX * 17 + 1)
    expectCostAtMost(falling.median, 3.0)
    expectCostAtMost(falling.p99, 4.0)
  })

  it(`costs: 20 dead bodies, ${RAGDOLLS_MAX} R0 and the rest R1 chains, in the kit's world: the same C7 budget`, { timeout: 60000 }, async () => {
    const { falling } = await costOfDead(20, RAGDOLLS_MAX)
    report('ragdoll-policy-x20-kit-world', { r0: RAGDOLLS_MAX, frameFirst3s: falling })
    expectCostAtMost(falling.median, 3.0)
    expectCostAtMost(falling.p99, 4.0)
  })

  it('costs: 20 ragdolls falling and piling (loose bodies, the spike\'s 60 Hz world, kept for comparison)', { timeout: 60000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    ground(world)
    for (let i = 0; i < 20; i++) ragdoll(world, [(i % 5) * 0.7, 0.5 + Math.floor(i / 5) * 0.6, (i % 3) * 0.3], i)
    const steps: number[] = []
    let asleep = -1
    for (let i = 0; i < 60 * 10; i++) {
      const t0 = performance.now()
      world.step(1 / 60)
      steps.push(performance.now() - t0)
      if (asleep < 0 && world.activeCount === 0) asleep = i / 60
    }
    report('ragdoll-x20', { bodies: world.bodyCount, asleepAtS: asleep, activeAtEnd: world.activeCount, stepFirst3s: stats(steps.slice(0, 180)), stepAll: stats(steps) })
    world.dispose()
  })
})
