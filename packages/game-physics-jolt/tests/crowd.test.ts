import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { chainOfRig, createRig, GUIDE } from '@adatechnology/game-characters'
import type { BodyId, JointId, PhysicsWorld, RagdollId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { ground, ragdoll, report, stats } from './scenes'

const guideRig = createRig({ body: GUIDE, height: 1.8, build: 1 })

/** Agents walk toward a door in a wall (game-crowd moves them; the engine only meets them): kinematic capsules, moved every frame. */
const crowd = (world: PhysicsWorld, n: number): BodyId[] =>
  Array.from({ length: n }, (_, i) =>
    world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [((i % 40) - 20) * 0.6, 0.85, 3 + Math.floor(i / 40) * 0.6], layer: 'agent', user: i }),
  )

describe('case 4: crowd', () => {
  it('300 and 1000 kinematic agents pushing a door that gives way; cost per step', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    for (const n of [300, 1000]) {
      const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192 })
      ground(world, 100)
      // a wall with a 1.2 m doorway at x = 0, z = 0; the door a 40 kg leaf hinged on the frame, its hinge giving way past 600 N s in a step
      world.createBody({ shape: { kind: 'box', half: [10, 1.5, 0.1] }, motion: 'static', position: [-10.6, 1.5, 0], user: -1 })
      world.createBody({ shape: { kind: 'box', half: [10, 1.5, 0.1] }, motion: 'static', position: [10.6, 1.5, 0], user: -1 })
      const frame = world.createBody({ shape: { kind: 'box', half: [0.05, 1.05, 0.05] }, motion: 'static', position: [-0.65, 1.05, 0], user: -1 })
      const door = world.createBody({ shape: { kind: 'box', half: [0.6, 1.0, 0.03] }, motion: 'dynamic', mass: 40, position: [0, 1.02, 0], layer: 'prop', user: -2 })
      const hinge = world.createJoint({ kind: 'hinge', a: frame, b: door, point: [-0.6, 1.02, 0], axis: [0, 1, 0], normal: [1, 0, 0], min: -0.05, max: 0.05, breakImpulse: 40 })
      const agents = crowd(world, n)
      const pos = agents.map((_, i) => [((i % 40) - 20) * 0.6, 3 + Math.floor(i / 40) * 0.6])
      const steps: number[] = []
      let brokeAt = -1
      for (let f = 0; f < 600; f++) {
        // toward the door at 1.2 m/s, stopping at the wall line unless the doorway is open (game-crowd's flow field, simplified)
        for (const [i, a] of agents.entries()) {
          const p = pos[i]
          const dx = -p[0]
          const dz = -p[1]
          const d = Math.hypot(dx, dz) || 1
          p[0] += (dx / d) * 1.2 / 60
          // at the wall line they stop; in the doorway they press on into the door (0.1 m from its plane: through its 3 cm leaf) until it gives way
          p[1] = Math.max(Math.abs(p[0]) < 0.6 ? (brokeAt >= 0 ? -5 : 0.1) : 0.3, p[1] + (dz / d) * 1.2 / 60)
          world.moveKinematic(a, [p[0], 0.85, p[1]], [0, 0, 0, 1], 1 / 60)
        }
        const t0 = performance.now()
        world.step(1 / 60)
        steps.push(performance.now() - t0)
        if (brokeAt < 0 && world.brokenJoints.includes(hinge)) brokeAt = f / 60
      }
      report(`crowd-${n}`, { agents: n, doorBrokeAtS: brokeAt, step: stats(steps), active: world.activeCount, bodies: world.bodyCount })
      expect(brokeAt).toBeGreaterThan(0)
      world.dispose()
    }
  })

  it('100 dead bodies piling against a wall: full ragdolls, cheap chains, and the swap to one capsule far away', { timeout: 300000 }, async () => {
    const engine = await createJoltEngine()
    const results: Record<string, unknown> = {}
    // 0.03 m/s is Jolt's default sleep speed, 0.08 the kit's world (debris, the room), 0.1 the spike's
    for (const [kind, sleepSpeed] of [['ragdoll', 0.03], ['chain', 0.03], ['engineChain', 0.03], ['chain', 0.08], ['engineChain', 0.08], ['chain', 0.1]] as const) {
      const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192, sleepSpeed })
      ground(world, 100)
      world.createBody({ shape: { kind: 'box', half: [6, 1.5, 0.2] }, motion: 'static', position: [0, 1.5, -0.2], user: -1 })
      const made: BodyId[][] = []
      const links: JointId[][] = []
      const dolls: RagdollId[] = []
      for (let i = 0; i < 100; i++) {
        const at: [number, number, number] = [((i % 10) - 5) * 0.8, 0.3 + Math.floor(i / 10) * 0.45, 0.6 + (i % 3) * 0.3]
        if (kind === 'ragdoll') {
          const doll = ragdoll(world, at, i)
          made.push(doll.bodies)
          links.push(doll.joints.map((j) => j.id))
        }
        else if (kind === 'engineChain') {
          // the same cheap body as the engine's own ragdoll, stabilized (gate 0 B3)
          const doll = world.createRagdoll({ ...chainOfRig({ rig: guideRig, body: GUIDE, build: 1, at, user: i }), stabilize: true })
          dolls.push(doll.id)
          made.push([])
          links.push([])
        }
        else {
          // a cheap body: torso, and two legs as one capsule, on a swing-twist hip (3 bodies, 2 joints)
          const group = world.createGroup(3, [[0, 1], [0, 2], [1, 2]])
          const torso = world.createBody({ shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.17 }, motion: 'dynamic', mass: 40, position: [at[0], at[1] + 1.25, at[2]], layer: 'character', group: { id: group, sub: 0 }, user: i })
          const head = world.createBody({ shape: { kind: 'sphere', radius: 0.11 }, motion: 'dynamic', mass: 5, position: [at[0], at[1] + 1.75, at[2]], layer: 'character', group: { id: group, sub: 1 }, user: i })
          const legs = world.createBody({ shape: { kind: 'capsule', halfHeight: 0.3, radius: 0.15 }, motion: 'dynamic', mass: 25, position: [at[0], at[1] + 0.45, at[2]], layer: 'character', group: { id: group, sub: 2 }, user: i })
          const neck = world.createJoint({ kind: 'swingTwist', a: torso, b: head, point: [at[0], at[1] + 1.62, at[2]], twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 })
          const hip = world.createJoint({ kind: 'swingTwist', a: torso, b: legs, point: [at[0], at[1] + 0.92, at[2]], twistAxis: [0, -1, 0], planeAxis: [0, 0, 1], normalHalfCone: 1.2, planeHalfCone: 1.0, twistMin: -0.4, twistMax: 0.4 })
          made.push([torso, head, legs])
          links.push([neck, hip])
        }
      }
      const steps: number[] = []
      let asleep = -1
      for (let f = 0; f < 600; f++) {
        const t0 = performance.now()
        world.step(1 / 60)
        steps.push(performance.now() - t0)
        if (asleep < 0 && world.activeCount === 0) asleep = f / 60
      }
      // body LOD: far away a ragdoll becomes one capsule (remove its bodies and joints, make one): how long the swap takes for all 100
      const t0 = performance.now()
      for (const d of dolls) world.removeRagdoll(d)
      for (const [i, bodies] of made.entries()) {
        // the joints go first: a joint must not outlive its bodies
        for (const j of links[i] ?? []) world.removeJoint(j)
        for (const b of bodies) world.removeBody(b)
        world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'dynamic', mass: 75, position: [((i % 10) - 5) * 0.8, 0.3, 1], layer: 'character', sleeping: true, user: i })
      }
      const swap = performance.now() - t0
      results[`${kind}@sleep${sleepSpeed}`] = { bodies: made.flat().length + dolls.length * 3, step: stats(steps), stepFirst2s: stats(steps.slice(0, 120)), asleepAtS: asleep, lodSwap100Ms: Math.round(swap * 100) / 100 }
      world.dispose()
    }
    report('crowd-piles', results)
    // B3: 100 cheap bodies made as the engine's ragdolls fall asleep in the pile within 10 s, in the kit's world (sleep speed 0.08)
    const chains = results['engineChain@sleep0.08'] as { asleepAtS: number }
    expect(chains.asleepAtS).toBeGreaterThan(0)
    expect(chains.asleepAtS).toBeLessThanOrEqual(10)
  })
})
