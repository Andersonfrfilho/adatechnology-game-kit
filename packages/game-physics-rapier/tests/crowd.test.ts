import { describe, it } from 'vitest'
import type { PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { fmt, loadEngine, stats } from './engines'
import { buildRagdoll } from './scenes/ragdoll'

/** Layers: 1 world, 2 bodies (ragdolls, chains), 4 crowd agents, 8 debris. Agents do not meet each other: game-crowd separates them itself. */
const WORLD = 1
const BODIES = 2
const AGENTS = 4
const DEBRIS = 8

const ground = (w: PhysicsWorld): void => {
  w.createBody({ kind: 'fixed', position: [0, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [80, 0.5, 80] }, tag: 1, layer: WORLD }] })
}

/** A dead body made cheap: pelvis, chest and head as three capsules on two ball joints (8 kg, 30 kg, 26 kg). */
const chain = (w: PhysicsWorld, at: Vec3, tag: number): number[] => {
  const parts: Array<[number, number, number]> = [
    [0.15, 0.2, 26],
    [0.17, 0.25, 30],
    [0.1, 0.1, 8],
  ]
  const ids: number[] = []
  let y = at[1]
  for (const [r, h, m] of parts) {
    ids.push(w.createBody({ kind: 'dynamic', position: [at[0], y + h + r, at[2]], mass: m, inertia: [m * 0.05, m * 0.02, m * 0.05], colliders: [{ shape: { kind: 'capsule', halfHeight: h, radius: r }, tag, layer: BODIES, meets: WORLD | BODIES | DEBRIS }] }))
    y += 2 * (h + r)
  }
  for (let i = 1; i < ids.length; i++) w.createJoint({ kind: 'ball', a: ids[i - 1], b: ids[i], anchorA: [0, parts[i - 1][1] + parts[i - 1][0], 0], anchorB: [0, -parts[i][1] - parts[i][0], 0], limits: { twist: [-0.4, 0.4], swingY: [-0.8, 0.8], swingZ: [-0.8, 0.8] } })
  return ids
}

describe('case 4: crowd', () => {
  for (const count of [300, 1000]) {
    it(`${count} kinematic agents push a hinged door that breaks under force, among 100 debris`, async () => {
      const { engine } = await loadEngine()
      const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 })
      ground(w)
      // a wall with a door gap at x = 0, the door hinged on its left post
      w.createBody({ kind: 'fixed', position: [0, 1.2, -10.5], colliders: [{ shape: { kind: 'box', half: [0.1, 1.2, 10] }, tag: 2, layer: WORLD }] })
      w.createBody({ kind: 'fixed', position: [0, 1.2, 10.5], colliders: [{ shape: { kind: 'box', half: [0.1, 1.2, 10] }, tag: 2, layer: WORLD }] })
      const post = w.createBody({ kind: 'fixed', position: [0, 1.05, -0.5], colliders: [] })
      const door = w.createBody({ kind: 'dynamic', position: [0, 1.06, 0], mass: 30, inertia: [11, 2.5, 13], colliders: [{ shape: { kind: 'box', half: [0.0225, 1.05, 0.45] }, tag: 3, layer: WORLD, contactForceOver: 50 }] })
      let hinge: number | null = w.createJoint({ kind: 'hinge', a: post, b: door, anchorA: [0, 0, 0], anchorB: [0, -0.01, -0.5], axis: [0, 1, 0], range: [-0.05, 0.05] })
      for (let i = 0; i < 100; i++) w.createBody({ kind: 'dynamic', position: [-3 - (i % 10) * 0.3, 0.1 + Math.floor(i / 10) * 0.21, -2 + (i % 7) * 0.5], mass: 5, colliders: [{ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, tag: 4, layer: DEBRIS }] })
      const agents: Array<{ id: number; x: number; z: number; speed: number }> = []
      for (let i = 0; i < count; i++) {
        const x = 2 + (i % 25) * 0.6
        const z = (Math.floor(i / 25) % 40) * 0.6 - 12
        agents.push({ id: w.createBody({ kind: 'kinematic', position: [x, 0.9, z], colliders: [{ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, tag: 5, layer: AGENTS, meets: WORLD | DEBRIS | BODIES }] }), x, z, speed: 1.2 + (i % 5) * 0.1 })
      }
      const ms: number[] = []
      let broke = -1
      let doorForce = 0
      let events = 0
      const dt = 1 / 60
      for (let f = 0; f < 600; f++) {
        // the crowd walks to the door (game-crowd steers; here a straight line to it, stopping at the wall's face)
        for (const a of agents) {
          const dx = -a.x
          const dz = -a.z
          const d = Math.hypot(dx, dz)
          const stepLen = Math.min(d, a.speed * dt)
          a.x = Math.max(a.x + (dx / d) * stepLen, broke >= 0 ? -20 : 0.15)
          a.z += (dz / d) * stepLen
          w.moveKinematic(a.id, [a.x, 0.9, a.z], [0, 0, 0, 1])
        }
        const t0 = performance.now()
        w.step(dt)
        let force = 0
        w.drainContactForces((e) => {
          events++
          if (e.tagA === 3 || e.tagB === 3) force += e.force
        })
        ms.push(performance.now() - t0)
        doorForce = Math.max(doorForce, force)
        // the door's hinge gives way at 4 kN (rapier.js does not report joint forces: the push on the door stands for it)
        if (hinge !== null && force > 4000) {
          w.removeJoint(hinge)
          hinge = null
          broke = f / 60
        }
      }
      const s = stats(ms)
      console.log(`crowd ${count} kinematic + 100 debris + door: step median ${fmt(s.median)} ms p90 ${fmt(s.p90)} p99 ${fmt(s.p99)} max ${fmt(s.max)}; door push max ${fmt(doorForce, 0)} N, hinge broke at ${broke} s; contact force events ${events}`)
    }, 120000)
  }

  for (const kind of ['ragdoll', 'chain'] as const) {
    it(`100 dead bodies as ${kind}s piling against a wall`, async () => {
      const { engine } = await loadEngine()
      const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 })
      ground(w)
      w.createBody({ kind: 'fixed', position: [0, 2, 0], colliders: [{ shape: { kind: 'box', half: [0.2, 2, 3] }, tag: 2, layer: WORLD }] })
      const all: number[] = []
      for (let i = 0; i < 100; i++) {
        const at: Vec3 = [-0.6 - (i % 4) * 0.5, 0.3 + Math.floor(i / 12) * 0.9, -2.2 + (Math.floor(i / 4) % 3) * 1.5]
        if (kind === 'ragdoll') all.push(...buildRagdoll(w, at, 100 + i * 20, BODIES, WORLD | BODIES).bodies.values())
        else all.push(...chain(w, at, 100 + i))
        // each pushed toward the wall
        for (const b of all.slice(-(kind === 'ragdoll' ? 17 : 3))) w.setVelocity(b, [2, 0, 0], [0, 0, 0])
      }
      const ms: number[] = []
      const v = new Float64Array(6)
      for (let f = 0; f < 600; f++) {
        const t0 = performance.now()
        w.step(1 / 60)
        ms.push(performance.now() - t0)
      }
      let fast = 0
      let asleep = 0
      for (const b of all) {
        w.readVelocity(b, v)
        if (Math.hypot(v[0], v[1], v[2]) > 0.5) fast++
        if (w.isSleeping(b)) asleep++
      }
      const s = stats(ms)
      console.log(`crowd 100 dead ${kind}s (${all.length} bodies): step median ${fmt(s.median)} ms p90 ${fmt(s.p90)} max ${fmt(s.max)}; at 10 s: ${asleep}/${all.length} asleep, ${fast} faster than 0.5 m/s`)
    }, 120000)
  }

  it('body LOD: a ragdoll swapped for one capsule and back, 50 times', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 })
    ground(w)
    const swap: number[] = []
    for (let i = 0; i < 50; i++) {
      const r = buildRagdoll(w, [i * 2, 0.05, 0], 100, BODIES, WORLD | BODIES)
      w.step(1 / 60)
      const t0 = performance.now()
      for (const b of r.bodies.values()) w.removeBody(b)
      const capsule = w.createBody({ kind: 'dynamic', position: [i * 2, 0.9, 0], mass: 64, colliders: [{ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, tag: 1, layer: BODIES }] })
      swap.push(performance.now() - t0)
      w.step(1 / 60)
      w.removeBody(capsule)
    }
    const s = stats(swap)
    console.log(`crowd LOD swap ragdoll -> capsule: median ${fmt(s.median)} ms max ${fmt(s.max)}`)
  }, 60000)
})
