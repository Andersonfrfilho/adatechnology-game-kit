import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { KIT_WORLD, PhysicsCostMeter, WakeQueue, chooseForPhysics, physicsPieceCount } from '@adatechnology/game-physics'
import type { BodyDesc, Vec3, WorldDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltBuild, JoltWorld } from '../src/index'
import { expectCostAtMost, ground, report, stats } from './scenes'

interface Tail {
  readonly bodies: number
  readonly woke: number
  readonly firstFrameMs: number
  readonly steps: number[]
}

/**
 * The two builds the kit runs: `multithread` (SIMD, 0 job threads; the desktop app and the isolated room, needs `SharedArrayBuffer`) and `single` (a page without isolation).
 * The physics is the same (hash of case 5, `cascade.test.ts`); the step is not. `JOLT_BUILD=single|multithread` runs only that one. Limits in ms (spec.md 6.2, evidence.md T7.4):
 * `multithread` carries the C7 limits; `single` carries the band measured on 2026-11-26 (Intel Core Ultra 9 275HX, Node, load 4 to 5: median 0.587 to 0.954, p99 3.54 to 5.60, wake 6.1 to 9.6) because it has no SIMD.
 */
const LIMITS: Record<JoltBuild, { readonly median: number; readonly p99: number; readonly wake: number }> = {
  multithread: { median: 0.6, p99: 4.0, wake: 10 },
  single: { median: 1.0, p99: 6.0, wake: 10 },
}
const BUILDS: readonly JoltBuild[] = process.env.JOLT_BUILD === 'single' || process.env.JOLT_BUILD === 'multithread' ? [process.env.JOLT_BUILD] : ['multithread', 'single']

/** The world the bench runs in: the kit's (120 Hz, 20 passes, contact listener); `B6_LEGACY=1` brings back the gate 0 one (60 Hz, Jolt's 10 passes, no `KIT_WORLD`) for comparison. */
const worldDesc = (): WorldDesc => (process.env.B6_LEGACY === '1' ? { fixedStep: 1 / 60, maxBodies: 8192 } : KIT_WORLD)

/**
 * Gate 0 B6: a wall, a slab and crates (500 candidates) hit by one blast that reaches all of them; the step cost of the next 3 s. `wake` 'burst' is the way before spec 008
 * D4 (`B6_WAKE=burst`): all 500 are bodies, asleep, and every push comes in the one frame. 'queue' is the production recipe: the blast's count is
 * `physicsPieceCount` at the wake cost per body (defaults: 24 to 300 pieces), the nearest the player first (`chooseForPhysics`) become bodies and the rest stay fixed where they
 * stand (the kit does not loosen them), and the pushes wait in the `WakeQueue`: each frame lets out what the step cost measured on the frames before leaves room for under the target.
 */
const PLAYER: Vec3 = [-6, 1, 6]

type Wake = 'burst' | 'budget' | 'queue'

const tail = async (wake: Wake, build: JoltBuild): Promise<Tail> => {
  const engine = await createJoltEngine({ build })
  const world = engine.createWorld(worldDesc()) as JoltWorld
  ground(world, 100)
  const descs: BodyDesc[] = []
  const meter = new PhysicsCostMeter()
  const blocks: Array<{ at: Vec3; half: Vec3; mass: number; size: number; distance: number }> = []
  const block = (at: Vec3, half: Vec3, mass: number): void => {
    blocks.push({ at, half, mass, size: 2 * Math.max(...half), distance: Math.hypot(at[0] - PLAYER[0], at[1] - PLAYER[1], at[2] - PLAYER[2]) })
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38)
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4 - 0.0], [0.5, 0.075, 0.2], 150)
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20)
  const count = wake !== 'burst' ? physicsPieceCount({}, meter.wakeCostPerBodyMs, 0) : blocks.length
  const { physics } = chooseForPhysics(blocks, count)
  const chosen = new Set(physics)
  for (const b of blocks) {
    const dynamic = chosen.has(b)
    descs.push({ shape: { kind: 'box', half: b.half }, motion: dynamic ? 'dynamic' : 'static', ...(dynamic ? { mass: b.mass, sleeping: true } : {}), position: b.at, layer: 'debris', user: descs.length })
  }
  const ids = world.createBodies(descs).filter((_, i) => chosen.has(blocks[i] as (typeof blocks)[number]))
  for (let f = 0; f < 10; f++) world.step(1 / 60)
  const at: Vec3 = [0.5, 0.6, 1.2]
  const pose = new Float64Array(7)
  // each body's push and the frame the front reaches it
  const pushes = ids.map((id) => {
    world.readPose(id, pose, 0)
    const d: Vec3 = [pose[0] - at[0], pose[1] - at[1] + 0.3, pose[2] - at[2]]
    const l = Math.hypot(...d) || 1
    const k = 2500 * Math.max(0.05, 1 - l / 12)
    return { id, impulse: [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k] as Vec3, player: Math.hypot(pose[0]! - PLAYER[0], pose[1]! - PLAYER[1], pose[2]! - PLAYER[2]) }
  })
  const queue = new WakeQueue<() => void>()
  if (wake === 'queue') for (const p of pushes) queue.push(p.player, () => world.addImpulse(p.id, p.impulse))
  let lastMs = 0
  const steps: number[] = []
  let woke = 0
  for (let f = 0; f < 180; f++) {
    const before = world.activeCount
    if (wake === 'queue') for (const apply of queue.release(1 / 60, lastMs, meter.wakeCostPerBodyMs)) apply()
    else if (f === 0) for (const p of pushes) world.addImpulse(p.id, p.impulse)
    const t0 = performance.now()
    world.step(1 / 60)
    lastMs = performance.now() - t0
    meter.observe(lastMs, world.activeCount)
    steps.push(lastMs)
    woke = Math.max(woke, world.activeCount - before)
  }
  world.dispose()
  return { bodies: ids.length, woke, firstFrameMs: steps[0] ?? 0, steps }
}

/** Frames over a limit (ms): the budget lets one per blast pass 6 ms (condition 10). */
const over = (steps: readonly number[], limit: number): number => steps.filter((x) => x > limit).length
const ms = (x: number): number => Math.round(x * 1000) / 1000
/** Runs after the first one in the process: the wasm and the adapter's code paths have been through the same scene (V8's tiers, Jolt's first allocations). */
const WARM_UP = 2
const WARM_RUNS = 3

/** `burst`: before D4; `budget`: the piece count only (an ablation); `queue`: the production recipe. */
const MODE: Wake = process.env.B6_WAKE === 'burst' || process.env.B6_WAKE === 'budget' ? process.env.B6_WAKE : 'queue'

describe.each(BUILDS)('case 5b: cascade tail (gate 0 B6), cold and warm, %s build', (build) => {
  // this file runs in a process of its own (vitest's forks pool), so the first scene of a build is the first contact its wasm and the adapter's code have
  it('500 bodies woken by one blast: the first run in the process (cold), then the same scene after a warm-up (warm)', { timeout: 300000 }, async () => {
    const limits = LIMITS[build]
    const cold = await tail(MODE, build)
    report('cascade-tail', { build, phase: 'cold', wake: MODE, wokeInOneFrame: cold.woke, firstFrameMs: ms(cold.firstFrameMs), first1s: stats(cold.steps.slice(0, 60)), all3s: stats(cold.steps) })
    for (let i = 0; i < WARM_UP; i++) await tail(MODE, build)
    const medians: number[] = []
    const p99s: number[] = []
    for (let i = 0; i < WARM_RUNS; i++) {
      const warm = await tail(MODE, build)
      const all3s = stats(warm.steps)
      report('cascade-tail', { build, phase: 'warm', run: i + 1, wake: MODE, wokeInOneFrame: warm.woke, firstFrameMs: ms(warm.firstFrameMs), first1s: stats(warm.steps.slice(0, 60)), all3s, head: warm.steps.slice(0, 12).map(ms), over5ms: over(warm.steps, 5), over6ms: over(warm.steps, 6) })
      // condition 10 and the C7 line of the 5b (spec.md 6.2): the wake frame, the median and the p99 of the 3 s, the production recipe (`queue`) warm, each build against its own limits
      if (MODE === 'queue') {
        expectCostAtMost(warm.firstFrameMs, limits.wake)
        medians.push(all3s.median)
        p99s.push(all3s.p99)
      }
      if (MODE === 'burst') expect(warm.woke).toBe(500)
      if (MODE !== 'burst') expect(warm.bodies).toBe(250)
    }
    // the middle of the warm runs: one run that another process disturbed does not decide the line
    const middle = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
    if (MODE === 'queue') {
      expectCostAtMost(middle(medians), limits.median)
      expectCostAtMost(middle(p99s), limits.p99)
    }
  })
})
