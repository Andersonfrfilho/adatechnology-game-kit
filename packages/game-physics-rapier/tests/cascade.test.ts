import { describe, expect, it } from 'vitest'
import type { PhysicsEngine, PhysicsWorld } from '@adatechnology/game-physics'
import { fmt, loadEngine, stats } from './engines'

/**
 * A slab (4 x 0.2 x 4 m, 1900 kg) on four pillars, a pile of 400 bricks and 60 props on and around it and a gas cylinder, all asleep; then the cylinder goes off:
 * every body within 8 m gets the blast's impulse and two pillars are gone (the wall broke), so the slab comes down and ~500 bodies wake in the same frame.
 * Contact forces over 2 kN are reported as events, as hits for game-destruction.
 */
const build = (w: PhysicsWorld): { pillars: number[]; all: number[]; cylinder: number } => {
  w.createBody({ kind: 'fixed', position: [0, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [40, 0.5, 40] }, tag: 1 }] })
  const all: number[] = []
  const pillars: number[] = []
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) pillars.push(w.createBody({ kind: 'dynamic', position: [x, 1.25, z], mass: 300, colliders: [{ shape: { kind: 'box', half: [0.15, 1.25, 0.15] }, tag: 2, contactForceOver: 2000 }] }))
  all.push(...pillars)
  const slab = w.createBody({ kind: 'dynamic', position: [0, 2.6, 0], mass: 1900, inertia: [2540, 5070, 2540], colliders: [{ shape: { kind: 'box', half: [2, 0.1, 2] }, tag: 3, contactForceOver: 2000 }] })
  all.push(slab)
  let k = 0
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        // bricks on the slab in four layers
        all.push(w.createBody({ kind: 'dynamic', position: [-1.6 + i * 0.35, 2.73 + layer * 0.075, -1.6 + j * 0.35], mass: 2.4, colliders: [{ shape: { kind: 'box', half: [0.11, 0.035, 0.055] }, tag: 100 + k++, contactForceOver: 2000 }] }))
      }
    }
  }
  for (let i = 0; i < 60; i++) all.push(w.createBody({ kind: 'dynamic', position: [-6 + (i % 12), 0.2, 3 + Math.floor(i / 12) * 0.8], mass: 8, colliders: [{ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, tag: 600 + i, contactForceOver: 2000 }] }))
  const cylinder = w.createBody({ kind: 'dynamic', position: [3, 0.3, 0], mass: 30, colliders: [{ shape: { kind: 'cylinder', halfHeight: 0.3, radius: 0.15 }, tag: 700 }] })
  all.push(cylinder)
  return { pillars, all, cylinder }
}

const hashPoses = (w: PhysicsWorld, ids: readonly number[]): string => {
  const p = new Float64Array(7)
  let h = 2166136261
  for (const id of ids) {
    w.readPose(id, p)
    const u = new Uint32Array(p.buffer)
    for (const x of u) h = Math.imul(h ^ x, 16777619) >>> 0
  }
  return h.toString(16)
}

const run = (engine: PhysicsEngine): { hash: string; wakeMs: number; ms: number[]; events: number; maxEventsPerStep: number; drainMs: number; heapDelta: number; awake: number } => {
  const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 })
  const { pillars, all, cylinder } = build(w)
  for (let f = 0; f < 240; f++) w.step(1 / 60)
  for (const b of all) w.sleep(b)
  w.drainContactForces(() => undefined)
  const heap0 = process.memoryUsage()
  const p = new Float64Array(7)
  w.readPose(cylinder, p)
  const cx = p[0], cy = p[1], cz = p[2]
  // the cylinder goes off: impulse ~ 400 N s at 1 m, falling with the square of the distance, on everything within 8 m; two pillars are blown away
  w.removeBody(cylinder)
  for (const id of pillars.slice(1, 3)) w.removeBody(id)
  const bodies = all.filter((b) => b !== cylinder && !pillars.slice(1, 3).includes(b))
  for (const b of bodies) {
    w.readPose(b, p)
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz
    const d = Math.max(1, Math.hypot(dx, dy, dz))
    if (d > 8) continue
    const j = Math.min(60, 400 / (d * d))
    w.applyImpulse(b, [(dx / d) * j, (dy / d) * j + 0.3 * j, (dz / d) * j])
  }
  let awake = 0
  for (const b of bodies) if (!w.isSleeping(b)) awake++
  const ms: number[] = []
  let events = 0
  let maxEventsPerStep = 0
  let drainMs = 0
  let wakeMs = 0
  for (let f = 0; f < 180; f++) {
    const t0 = performance.now()
    w.step(1 / 60)
    const t1 = performance.now()
    let n = 0
    // our damage hook: what game-destruction would get, with nothing kept from the reused event
    w.drainContactForces((e) => {
      n += e.force > 0 ? 1 : 0
    })
    drainMs += performance.now() - t1
    if (f === 0) wakeMs = t1 - t0
    ms.push(t1 - t0)
    events += n
    maxEventsPerStep = Math.max(maxEventsPerStep, n)
  }
  const heap1 = process.memoryUsage()
  const hash = hashPoses(w, bodies)
  w.dispose()
  return { hash, wakeMs, ms, events, maxEventsPerStep, drainMs, heapDelta: heap1.heapUsed - heap0.heapUsed + (heap1.arrayBuffers - heap0.arrayBuffers), awake }
}

describe('case 5: chain reaction', () => {
  it('~500 bodies woken in one frame: step spike, contact-force events, determinism', async () => {
    const { engine } = await loadEngine()
    const a = run(engine)
    const b = run(engine)
    const s = stats(a.ms)
    console.log(
      `cascade: ${a.awake} woken at once; first step ${fmt(a.wakeMs)} ms; 3 s after: median ${fmt(s.median)} p90 ${fmt(s.p90)} p99 ${fmt(s.p99)} max ${fmt(s.max)} ms; force events ${a.events} (max ${a.maxEventsPerStep}/step), drain ${fmt(a.drainMs / 180, 4)} ms/step; JS heap+buffers delta ${fmt(a.heapDelta / 1024, 0)} KB; same run twice: ${a.hash === b.hash ? 'identical' : 'DIFFERENT'} (${a.hash})`,
    )
    if (process.env.CASCADE_HASH_OUT) console.log(`cascade-hash ${a.hash}`)
    expect(a.hash).toBe(b.hash)
  }, 120000)
})
