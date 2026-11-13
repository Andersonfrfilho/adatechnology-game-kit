import { describe, expect, it } from 'vitest'
import { loadEngine } from './engines'

describe('adapter smoke', () => {
  it('a box falls onto a fixed box and sleeps', async () => {
    const { engine, initMs } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] })
    w.createBody({ kind: 'fixed', position: [0, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [5, 0.5, 5] }, tag: 1 }] })
    const b = w.createBody({ kind: 'dynamic', position: [0, 1, 0], mass: 10, inertia: [0.3, 0.3, 0.3], colliders: [{ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, tag: 2 }] })
    for (let i = 0; i < 240; i++) w.step(1 / 60)
    const p = new Float64Array(7)
    w.readPose(b, p)
    console.log(`init ${initMs.toFixed(1)} ms, y ${p[1].toFixed(4)}, asleep ${w.isSleeping(b)}`)
    expect(p[1]).toBeCloseTo(0.2, 2)
    expect(w.isSleeping(b)).toBe(true)
  })
})
