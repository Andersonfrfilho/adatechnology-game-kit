import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { chainOfAnimal, corpseBodyKitOfAnimal, ragdollOfAnimal } from '@adatechnology/game-animals'
import type { QuadrupedSpec } from '@adatechnology/game-animals'
import { getSpecies } from '@adatechnology/game-animals-species'
import { KIT_RAGDOLL_SOLVER, KIT_WORLD } from '@adatechnology/game-physics'
import type { RagdollDesc } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { allAsleep, frame, sceneOf, seconds } from './lod-scenes'
import { expectCostAtMost, ground, report, stairs, stats } from './scenes'

/** 9x19 FMJ of game-weapons: 7.5 g at 365 m/s, stopped in the body: 2.74 N s. */
const NINE_MM_IMPULSE = 0.0075 * 365

const quadrupedOf = (id: string): QuadrupedSpec => {
  const body = getSpecies(id)?.body
  if (body?.kind !== 'quadruped') throw new Error(`${id} is not a quadruped`)
  return body
}

/** Dropped from 2 m onto the stairs and a box, shot at 1.5 s, in the kit's world: the worst joint past its limit, for how many frames in a row past 0.1 rad, and the sleep. */
const drop = async (desc: RagdollDesc): Promise<{ asleepAtS: number; longestFramesOver0_1rad: number; maxLimitExcessRad: number; worst: string }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld(KIT_WORLD) as JoltWorld
  ground(world)
  stairs(world, [0, 0, 0])
  world.createBody({ shape: { kind: 'box', half: [0.4, 0.3, 0.4] }, motion: 'static', position: [0.5, 0.3, 1.2], user: -1 })
  const made = world.createRagdoll({ ...desc, stabilize: true, solverSteps: KIT_RAGDOLL_SOLVER })
  const joints = desc.parts.flatMap((part, index) => (part.joint ? [{ id: made.joints[desc.parts.slice(0, index).filter((other) => other.joint).length] as (typeof made.joints)[number], joint: part.joint }] : []))
  let maxExcess = 0
  let worst = ''
  let overFrames = 0
  let longestOver = 0
  let asleepAt = -1
  for (let frame = 0; frame < 60 * 8; frame++) {
    if (frame === 90) world.addImpulse(made.bodies[0] as (typeof made.bodies)[number], [NINE_MM_IMPULSE, 0, 0], undefined)
    world.step(1 / 60)
    let frameExcess = 0
    joints.forEach(({ id, joint }, k) => {
      const angles = world.jointAngles(id)
      const excess = joint.kind === 'hinge' ? Math.max(joint.min - angles.hinge, angles.hinge - joint.max) : joint.kind === 'swingTwist' ? Math.max(angles.swing - Math.max(joint.normalHalfCone, joint.planeHalfCone), Math.abs(angles.twist) - joint.twistMax) : 0
      frameExcess = Math.max(frameExcess, excess)
      if (excess > maxExcess) {
        maxExcess = excess
        worst = `joint ${k} frame ${frame}`
      }
    })
    overFrames = frameExcess > 0.1 ? overFrames + 1 : 0
    longestOver = Math.max(longestOver, overFrames)
    const awake = made.bodies.some((body) => !world.isSleeping(body))
    if (!awake && asleepAt < 0) asleepAt = frame / 60
    if (awake) asleepAt = -1
  }
  world.dispose()
  return { asleepAtS: asleepAt, longestFramesOver0_1rad: longestOver, maxLimitExcessRad: maxExcess, worst }
}

describe('quadruped ragdoll (T5.5)', () => {
  it.each(['dog', 'cat', 'cow', 'horse'])('%s: R0 drops 2 m onto the stairs, takes a 9 mm shot: no joint 0.1 rad past its limit for over 3 frames, asleep within 4 s (B3)', { timeout: 60000 }, async (id) => {
    const r = await drop(ragdollOfAnimal({ body: quadrupedOf(id), at: [0, 2, -0.5] }))
    report(`ragdoll-animal-${id}`, r)
    expect(r.asleepAtS).toBeGreaterThan(0)
    expect(r.asleepAtS).toBeLessThanOrEqual(4)
    expect(r.longestFramesOver0_1rad).toBeLessThanOrEqual(3)
  })

  it.each(['dog', 'horse'])('%s: R1 chain drops the same way and sleeps within 4 s', { timeout: 60000 }, async (id) => {
    const r = await drop(chainOfAnimal({ body: quadrupedOf(id), at: [0, 2, -0.5] }))
    report(`chain-animal-${id}`, r)
    expect(r.asleepAtS).toBeGreaterThan(0)
    expect(r.asleepAtS).toBeLessThanOrEqual(4)
    expect(r.longestFramesOver0_1rad).toBeLessThanOrEqual(3)
  })

  it.each(['dog', 'cow', 'horse'])('costs: 1 %s R0 falling and piling in the kit\'s world: a 1/60 s frame (two steps), 3.0 ms median and 4.0 ms p99', { timeout: 60000 }, async (id) => {
    const engine = await createJoltEngine()
    const world = engine.createWorld(KIT_WORLD)
    ground(world)
    world.createRagdoll({ ...ragdollOfAnimal({ body: quadrupedOf(id), at: [0, 0.5, 0] }), stabilize: true, solverSteps: KIT_RAGDOLL_SOLVER })
    const frames: number[] = []
    for (let i = 0; i < 180; i++) {
      const t0 = performance.now()
      world.step(1 / 60)
      frames.push(performance.now() - t0)
    }
    const falling = stats(frames)
    report('ragdoll-animal-r0-kit-world', { id, frameFirst3s: falling })
    world.dispose()
    expectCostAtMost(falling.median, 3.0)
    expectCostAtMost(falling.p99, 4.0)
  })

  it('dead dogs and a horse go through the body LOD as people do, with no animal code in it: one ragdoll, the rest chains, all asleep in 14 s', { timeout: 60000 }, async () => {
    const scene = await sceneOf()
    const dog = corpseBodyKitOfAnimal({ body: quadrupedOf('dog') })
    const horse = corpseBodyKitOfAnimal({ body: quadrupedOf('horse') })
    const ids = [1, 2, 3, 4, 5]
    for (const id of ids) scene.corpses.add({ id, kit: id === 5 ? horse : dog, position: [(id % 3) * 1.2, 1 + id * 0.4, (id % 2) * 1.5], yaw: id })
    for (let f = 0; f < 60; f++) frame(scene.loop)
    const counts = scene.corpses.counts()
    seconds(scene.loop, 13)
    report('lod-animals', { counts })
    expect(counts.r0).toBeLessThanOrEqual(1)
    expect(counts.r1).toBeGreaterThan(0)
    expect(allAsleep(scene, ids)).toBe(true)
    scene.world.dispose()
  })

  it('a dead dog far from the player is made a capsule and still lies on the ground', { timeout: 60000 }, async () => {
    const scene = await sceneOf({ interest: () => [[500, 0, 0]] })
    const kit = corpseBodyKitOfAnimal({ body: quadrupedOf('dog') })
    const rung = scene.corpses.add({ id: 1, kit, position: [0, 0.5, 0], yaw: 0 })
    seconds(scene.loop, 6)
    expect(rung).not.toBe('r0')
    expect(allAsleep(scene, [1])).toBe(true)
    scene.world.dispose()
  })
})
