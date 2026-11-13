import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import type { BodyDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground, report, stats } from './scenes'

interface Tail {
  readonly woke: number
  readonly firstFrameMs: number
  readonly steps: number[]
}

/**
 * Gate 0 B6: a wall, a slab and crates (500 bodies, asleep) hit by one blast that reaches all of them, so all 500 wake in one frame; the step cost of the
 * next 3 s. `frontSpeed` (m/s) spreads the blast's pushes over the frames its front takes to reach each body (a shock front, not every body at the same
 * instant): 0 hands them all in the one frame.
 */
const tail = async (frontSpeed: number): Promise<Tail> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192 }) as JoltWorld
  ground(world, 100)
  const descs: BodyDesc[] = []
  const block = (at: Vec3, half: Vec3, mass: number): void => {
    descs.push({ shape: { kind: 'box', half }, motion: 'dynamic', mass, position: at, sleeping: true, layer: 'debris', user: descs.length })
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38)
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4 - 0.0], [0.5, 0.075, 0.2], 150)
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20)
  const ids = world.createBodies(descs)
  for (let f = 0; f < 10; f++) world.step(1 / 60)
  const at: Vec3 = [0.5, 0.6, 1.2]
  const pose = new Float64Array(7)
  // each body's push and the frame the front reaches it
  const pushes = ids.map((id) => {
    world.readPose(id, pose, 0)
    const d: Vec3 = [pose[0] - at[0], pose[1] - at[1] + 0.3, pose[2] - at[2]]
    const l = Math.hypot(...d) || 1
    const k = 2500 * Math.max(0.05, 1 - l / 12)
    return { id, impulse: [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k] as Vec3, frame: frontSpeed > 0 ? Math.floor((l / frontSpeed) * 60) : 0 }
  })
  const steps: number[] = []
  let woke = 0
  for (let f = 0; f < 180; f++) {
    const before = world.activeCount
    for (const p of pushes) if (p.frame === f) world.addImpulse(p.id, p.impulse)
    const t0 = performance.now()
    world.step(1 / 60)
    steps.push(performance.now() - t0)
    woke = Math.max(woke, world.activeCount - before)
  }
  world.dispose()
  return { woke, firstFrameMs: steps[0] ?? 0, steps }
}

const ms = (x: number): number => Math.round(x * 1000) / 1000
/** Runs after the first one in the process: the wasm and the adapter's code paths have been through the same scene (V8's tiers, Jolt's first allocations). */
const WARM_UP = 2
const WARM_RUNS = 3

describe('case 5b: cascade tail (gate 0 B6), cold and warm', () => {
  // this file runs in a process of its own (vitest's forks pool), so the first scene is the first contact the wasm and the adapter's code have
  it('500 bodies woken in one frame: the first run in the process (cold), then the same scene after a warm-up (warm); and with a front crossing them', { timeout: 300000 }, async () => {
    const cold = await tail(0)
    report('cascade-tail', { phase: 'cold', frontSpeed: 0, wokeInOneFrame: cold.woke, firstFrameMs: ms(cold.firstFrameMs), first1s: stats(cold.steps.slice(0, 60)), all3s: stats(cold.steps) })
    for (let i = 0; i < WARM_UP; i++) await tail(0)
    for (let i = 0; i < WARM_RUNS; i++) {
      const warm = await tail(0)
      report('cascade-tail', { phase: 'warm', run: i + 1, frontSpeed: 0, wokeInOneFrame: warm.woke, firstFrameMs: ms(warm.firstFrameMs), first1s: stats(warm.steps.slice(0, 60)), all3s: stats(warm.steps) })
      expect(warm.woke).toBe(500)
    }
    for (const frontSpeed of [340, 150]) {
      const r = await tail(frontSpeed)
      report('cascade-tail', { phase: 'warm', frontSpeed, wokeInOneFrame: r.woke, firstFrameMs: ms(r.firstFrameMs), first1s: stats(r.steps.slice(0, 60)), all3s: stats(r.steps) })
    }
  })
})
