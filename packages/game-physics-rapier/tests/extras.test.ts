import { describe, expect, it } from 'vitest'
import type { PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import type { RapierWorld } from '../src/index'
import { fmt, loadEngine, stats } from './engines'

const floor = (w: PhysicsWorld, at: Vec3 = [0, 0, 0]): number => w.createBody({ kind: 'fixed', position: [at[0], at[1] - 0.5, at[2]], colliders: [{ shape: { kind: 'box', half: [60, 0.5, 60] }, tag: 1, surface: { friction: { static: 0.8, dynamic: 0.6 }, restitution: 0.3 } }] })

describe('case 7: light demos', () => {
  it('(a) character controller: stairs, ramp, pushing a crate; 1 and 50 controllers', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] }) as RapierWorld
    floor(w)
    // stairs of 18 cm along +x from x = 2, a 30 degree ramp along -x, a 40 kg crate at z = 3
    for (let i = 0; i < 8; i++) w.createBody({ kind: 'fixed', position: [2.15 + i * 0.28, 0.09 + i * 0.09, 0], colliders: [{ shape: { kind: 'box', half: [0.14, 0.09 + i * 0.09, 1] }, tag: 2 }] })
    const a = Math.PI / 6
    w.createBody({ kind: 'fixed', position: [-4, 1, 0], rotation: [0, 0, -Math.sin(a / 2), Math.cos(a / 2)], colliders: [{ shape: { kind: 'box', half: [2.3, 0.05, 1] }, tag: 3 }] })
    const crate = w.createBody({ kind: 'dynamic', position: [0, 0.3, 3], mass: 40, colliders: [{ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, tag: 4 }] })
    const make = (x: number, z: number): { id: number; kcc: ReturnType<RapierWorld['world']['createCharacterController']>; pos: Vec3 } => {
      const id = w.createBody({ kind: 'kinematic', position: [x, 0.9, z], colliders: [{ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.3 }, tag: 9 }] })
      const kcc = w.world.createCharacterController(0.02)
      kcc.enableAutostep(0.25, 0.2, false)
      kcc.enableSnapToGround(0.3)
      kcc.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
      kcc.setApplyImpulsesToDynamicBodies(true)
      kcc.setCharacterMass(80)
      return { id, kcc, pos: [x, 0.9, z] }
    }
    const walk = (c: ReturnType<typeof make>, dir: Vec3, frames: number): number => {
      const rb = w.world.getRigidBody(c.id)
      const col = rb.collider(0)
      let vy = 0
      let ms = 0
      for (let f = 0; f < frames; f++) {
        vy = Math.max(vy - 9.81 / 60, -20)
        const t0 = performance.now()
        c.kcc.computeColliderMovement(col, { x: dir[0] / 60, y: vy / 60, z: dir[2] / 60 })
        const m = c.kcc.computedMovement()
        if (c.kcc.computedGrounded()) vy = 0
        c.pos = [c.pos[0] + m.x, c.pos[1] + m.y, c.pos[2] + m.z]
        w.moveKinematic(c.id, c.pos, [0, 0, 0, 1])
        ms += performance.now() - t0
        w.step(1 / 60)
      }
      return ms / frames
    }
    const up = make(0, 0)
    const msOne = walk(up, [1.4, 0, 0], 240)
    const stairsTop = up.pos[1]
    const ramp = make(-1.5, 0)
    walk(ramp, [-1.4, 0, 0], 180)
    const pusher = make(0, 1.8)
    const p = new Float64Array(7)
    w.readPose(crate, p)
    const crate0 = p[2]
    walk(pusher, [0, 0, 1.4], 120)
    w.readPose(crate, p)
    console.log(`kcc: up 8 stairs of 18 cm: centre y ${fmt(stairsTop, 2)} m (top of stairs + 0.9 = ${fmt(1.44 + 0.9, 2)}); 30 deg ramp: y ${fmt(ramp.pos[1], 2)} m; crate pushed ${fmt(p[2] - crate0, 2)} m; one controller ${fmt(msOne, 3)} ms/frame`)
    const crowd = Array.from({ length: 50 }, (_, i) => make(-10 + (i % 10), -10 + Math.floor(i / 10)))
    let kccMs = 0
    for (let f = 0; f < 60; f++) for (const c of crowd) kccMs += walk(c, [1, 0, 0.3], 1)
    console.log(`kcc: 50 controllers ${fmt(kccMs / 60, 3)} ms/frame for the controllers' moves (world step not counted)`)
    expect(stairsTop).toBeGreaterThan(1.5)
  }, 60000)

  it('(b) a grenade thrown bounces and rests; 200 shell casings with CCD', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] })
    floor(w)
    w.createBody({ kind: 'fixed', position: [8, 1, 0], colliders: [{ shape: { kind: 'box', half: [0.1, 1, 3] }, tag: 2, surface: { friction: { static: 0.6, dynamic: 0.5 }, restitution: 0.4 } }] })
    const g = w.createBody({ kind: 'dynamic', position: [0, 1.6, 0], velocity: [9, 4, 0.5], spin: [0, 0, -8], mass: 0.4, ccd: true, angularDamping: 0.5, colliders: [{ shape: { kind: 'capsule', halfHeight: 0.03, radius: 0.03 }, tag: 3, surface: { friction: { static: 0.6, dynamic: 0.5 }, restitution: 0.4 } }] })
    const p = new Float64Array(7)
    let restAt = -1
    let bounces = 0
    let lastVy = 0
    const v = new Float64Array(6)
    for (let f = 0; f < 600; f++) {
      w.step(1 / 60)
      w.readVelocity(g, v)
      if (lastVy < -0.5 && v[1] > 0.2) bounces++
      lastVy = v[1]
      if (restAt < 0 && w.isSleeping(g)) restAt = f / 60
    }
    w.readPose(g, p)
    // casings: 9 mm brass, 4 g, ejected at 3-5 m/s up and right, onto the floor
    const casings: number[] = []
    for (let i = 0; i < 200; i++) casings.push(w.createBody({ kind: 'dynamic', position: [-5 + (i % 20) * 0.3, 1.4, -5 + Math.floor(i / 20) * 0.3], velocity: [2 + (i % 3), 3 + (i % 5) * 0.4, (i % 7) * 0.2 - 0.6], spin: [i % 11, 15, 3], mass: 0.004, inertia: [1e-7, 2e-7, 1e-7], ccd: true, colliders: [{ shape: { kind: 'cylinder', halfHeight: 0.0095, radius: 0.0049 }, tag: 10, surface: { friction: { static: 0.4, dynamic: 0.3 }, restitution: 0.3 } }] }))
    const ms: number[] = []
    for (let f = 0; f < 300; f++) {
      const t0 = performance.now()
      w.step(1 / 60)
      ms.push(performance.now() - t0)
    }
    let below = 0
    let asleep = 0
    for (const c of casings) {
      const q = new Float64Array(7)
      w.readPose(c, q)
      if (q[1] < -0.01) below++
      if (w.isSleeping(c)) asleep++
    }
    const s = stats(ms)
    console.log(`throw: grenade ${bounces} bounces, rests at x ${fmt(p[0], 2)} y ${fmt(p[1], 3)} asleep at ${fmt(restAt, 2)} s; 200 casings: ${below} under the floor, ${asleep} asleep at 5 s, step median ${fmt(s.median)} ms p90 ${fmt(s.p90)} max ${fmt(s.max)}`)
  }, 60000)

  it('(c) 2 000 fixed colliders added and removed at runtime; precision 5 km from the origin', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] })
    floor(w)
    for (let i = 0; i < 50; i++) w.createBody({ kind: 'dynamic', position: [(i % 10) - 5, 0.5, Math.floor(i / 10) - 2], colliders: [{ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, tag: 2 }] })
    for (let f = 0; f < 60; f++) w.step(1 / 60)
    const t0 = performance.now()
    const ids: number[] = []
    for (let i = 0; i < 2000; i++) ids.push(w.createBody({ kind: 'fixed', position: [20 + (i % 50) * 1.2, 0.5, 20 + Math.floor(i / 50) * 1.2], colliders: [{ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, tag: 3 }] }))
    const add = performance.now() - t0
    const t1 = performance.now()
    w.step(1 / 60)
    const firstStep = performance.now() - t1
    const t2 = performance.now()
    for (const id of ids) w.removeBody(id)
    const remove = performance.now() - t2
    const t3 = performance.now()
    w.step(1 / 60)
    const afterRemove = performance.now() - t3
    // a crate on a floor 5 km out: Rapier is f32, positions are good to ~0.5 mm there
    const far = engine.createWorld({ gravity: [0, -9.81, 0] })
    floor(far, [5000, 0, 5000])
    const crate = far.createBody({ kind: 'dynamic', position: [5000, 0.3, 5000], colliders: [{ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, tag: 2 }] })
    const p = new Float64Array(7)
    let lo = Infinity, hi = -Infinity, xlo = Infinity, xhi = -Infinity
    for (let f = 0; f < 600; f++) {
      far.step(1 / 60)
      far.readPose(crate, p)
      if (f > 120) {
        lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); xlo = Math.min(xlo, p[0]); xhi = Math.max(xhi, p[0])
      }
    }
    console.log(`statics: add 2000 ${fmt(add, 1)} ms, next step ${fmt(firstStep, 2)} ms; remove 2000 ${fmt(remove, 1)} ms, next step ${fmt(afterRemove, 2)} ms. 5 km out: crate y ${fmt(p[1], 4)} (wobble ${fmt((hi - lo) * 1000, 2)} mm, drift x ${fmt((xhi - xlo) * 1000, 2)} mm), asleep ${far.isSleeping(crate)}`)
  }, 60000)

  it('(d) save and load: a snapshot restored steps on bit-identical', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] })
    floor(w)
    const ids: number[] = []
    for (let i = 0; i < 100; i++) ids.push(w.createBody({ kind: 'dynamic', position: [(i % 10) * 0.45 - 2, 0.5 + Math.floor(i / 10) * 0.45, (i % 3) * 0.1], spin: [i % 3, 0, 1], colliders: [{ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, tag: 2 }] }))
    for (let f = 0; f < 30; f++) w.step(1 / 60)
    const t0 = performance.now()
    const snap = w.snapshot()
    const saveMs = performance.now() - t0
    const run = (): string => {
      for (let f = 0; f < 120; f++) w.step(1 / 60)
      const p = new Float64Array(7 * ids.length)
      ids.forEach((id, k) => w.readPose(id, p, k * 7))
      return Buffer.from(p.buffer).toString('base64').slice(0, 24) + Buffer.from(p.buffer).reduce((h, b) => (Math.imul(h ^ b, 16777619) >>> 0), 2166136261).toString(16)
    }
    const a = run()
    const t1 = performance.now()
    w.restore(snap)
    const loadMs = performance.now() - t1
    const b = run()
    console.log(`snapshot: ${snap.byteLength} bytes for 100 bodies, save ${fmt(saveMs, 2)} ms, load ${fmt(loadMs, 2)} ms; continued run after load ${a === b ? 'bit-identical' : 'DIFFERENT'}`)
    expect(a).toBe(b)
  }, 60000)
})
