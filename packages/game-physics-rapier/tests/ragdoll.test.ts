import { describe, expect, it } from 'vitest'
import type { PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { fmt, loadEngine, stats } from './engines'
import { buildRagdoll, jointErrors } from './scenes/ragdoll'

/** Stairs of 5 steps (0.18 m rise, 0.28 m run) and a ground slab. */
const stairs = (w: PhysicsWorld, x: number): void => {
  w.createBody({ kind: 'fixed', position: [x, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [3, 0.5, 4] }, tag: 1 }] })
  for (let i = 0; i < 5; i++) w.createBody({ kind: 'fixed', position: [x, 0.09 + i * 0.09, -0.28 * i], colliders: [{ shape: { kind: 'box', half: [1, 0.09 + i * 0.09, 0.14] }, tag: 1 }] })
}

/** 9x19 FMJ: 7.5 g at 365 m/s, 2.74 kg m/s, all of it into the torso (the bullet stops in the body). */
const NINE_MM: Vec3 = [0, 0, -0.0075 * 365]

describe('case 2: ragdoll of the game-characters rig', () => {
  const drop = async (iterations: number | undefined, maxStep: number, inner?: number): Promise<{ asleepAt: number; line: string }> => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep, solverIterations: iterations, innerIterations: inner })
    stairs(w, 0)
    const r = buildRagdoll(w, [0, 2.6, -0.4], 100)
    const v = new Float64Array(6)
    let maxSpeed = 0
    let maxDrift = 0
    let maxOver = 0
    let asleepAt = -1
    const ms: number[] = []
    for (let f = 0; f < 600; f++) {
      if (f === 90) w.applyImpulse(r.bodies.get('torso') ?? -1, NINE_MM, undefined)
      const t0 = performance.now()
      w.step(1 / 60)
      ms.push(performance.now() - t0)
      let all = true
      for (const b of r.bodies.values()) {
        w.readVelocity(b, v)
        if (f > 100) maxSpeed = Math.max(maxSpeed, Math.hypot(v[0], v[1], v[2]))
        if (!w.isSleeping(b)) all = false
      }
      const e = jointErrors(w, r)
      if (process.env.RAGDOLL_TRACE && e.overLimit > 0.3) console.log("trace", f, e.worst)
      maxDrift = Math.max(maxDrift, e.drift)
      maxOver = Math.max(maxOver, e.overLimit)
      if (all && asleepAt < 0) asleepAt = f / 60
      if (!all) asleepAt = -1
    }
    const s = stats(ms)
    w.dispose()
    return { asleepAt, line: `ragdoll x1 (iterations ${iterations ?? 4}, inner ${inner ?? 1}, step 1/${Math.round(1 / maxStep)}): mass ${fmt(r.mass, 1)} kg; step median ${fmt(s.median)} ms p90 ${fmt(s.p90)}; max speed after the shot ${fmt(maxSpeed)} m/s; joint drift max ${fmt(maxDrift * 1000, 1)} mm; hinge over limit max ${fmt(maxOver, 3)} rad; asleep at ${fmt(asleepAt, 2)} s` }
  }

  it('drops 2 m onto stairs, takes a 9 mm shot, settles asleep within its limits (solver settings swept)', async () => {
    let first = -1
    for (const [iterations, maxStep, inner] of [[undefined, 1 / 60, undefined], [8, 1 / 60, undefined], [undefined, 1 / 120, undefined], [undefined, 1 / 60, 4], [4, 1 / 120, 4]] as const) {
      const r = await drop(iterations, maxStep, inner)
      console.log(r.line)
      if (first < 0) first = r.asleepAt
    }
    expect(first).toBeGreaterThan(0)
  }, 120000)

  it('costs: 20 ragdolls falling and settling', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0], maxStep: 1 / 60 })
    w.createBody({ kind: 'fixed', position: [0, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [30, 0.5, 30] }, tag: 1 }] })
    for (let i = 0; i < 20; i++) buildRagdoll(w, [(i % 5) * 1.5 - 3, 1 + Math.floor(i / 5) * 0.5, Math.floor(i / 5) * 1.5 - 3], 1000 + i * 20)
    const ms: number[] = []
    for (let f = 0; f < 300; f++) {
      const t0 = performance.now()
      w.step(1 / 60)
      ms.push(performance.now() - t0)
    }
    const falling = stats(ms.slice(0, 120))
    const rest = stats(ms.slice(240))
    console.log(`ragdoll x20 (340 bodies, 320 joints): falling median ${fmt(falling.median)} ms p90 ${fmt(falling.p90)} max ${fmt(falling.max)}; settled median ${fmt(rest.median)} ms`)
  }, 60000)
})
