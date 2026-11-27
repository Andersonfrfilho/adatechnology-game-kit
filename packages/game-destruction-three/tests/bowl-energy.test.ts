import { appendFileSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'

import { bowl } from './bowl-energy'
import type { BowlResult } from './bowl-energy'

const SEEDS = Array.from({ length: Number(process.env.BOWL_SEEDS ?? 16) }, (_, i) => i + Number(process.env.BOWL_FROM ?? 1))

const runs: BowlResult[] = []

describe('deepening bowl, energy criteria (DECISION-fable §2)', () => {
  afterAll(() => {
    if (runs.length === 0) return
    const worst = (pick: (r: BowlResult) => number): number => Math.max(...runs.map(pick))
    const summary = {
      iterations: Number(process.env.JOLT_ITERATIONS ?? KIT_WORLD.velocityIterations),
      cases: runs.length,
      worstC1: worst((r) => r.c1Excess),
      worstC2: worst((r) => r.c2Gain),
      // printed for information only (owner decision 2026-11-14): C2 is judged as the spec defines it, with the C1 condition
      worstC2Unconditioned: worst((r) => r.c2GainUnconditioned),
      worstC3: worst((r) => r.c3Lift),
      worstC4: worst((r) => r.c4AsleepAfter),
      worstDeepest: worst((r) => r.deepest),
      fellThrough: worst((r) => r.fellThrough),
    }
    console.log(`bowl worst ${JSON.stringify(summary)}`)
  })

  // dt 1/144 (the C6 rate that is not a step of the 120 Hz world) runs when asked for: `BOWL_DT=0.00694`
const FRAME_STEPS = process.env.BOWL_DT ? [0.05, 1 / 60, 1 / 144] : [0.05, 1 / 60]
for (const dt of FRAME_STEPS.filter((d) => !process.env.BOWL_DT || Math.abs(d - Number(process.env.BOWL_DT)) < 1e-4)) {
    it.each(SEEDS)(`C1-C4 (dt ${dt.toFixed(3)}, seed %i)`, { timeout: 60000 }, async (seed) => {
      // each case is ~0.6 s of synchronous work: without a turn of the loop between them the runner's report times out after ~60 s (64 seeds, one process)
      await new Promise((resolve) => setTimeout(resolve, 0))
      const r = bowl(seed, dt)
      runs.push(r)
      const line = JSON.stringify({ iterations: Number(process.env.JOLT_ITERATIONS ?? KIT_WORLD.velocityIterations), dt: Number(dt.toFixed(4)), seed, ...r })
      if (process.env.SPIKE_OUT) appendFileSync(process.env.SPIKE_OUT, `${line}\n`)
      expect.soft(r.c1Excess, 'C1').toBeLessThanOrEqual(0)
      expect.soft(r.c2Gain, 'C2').toBeLessThanOrEqual(0.035)
      expect.soft(r.c3Lift, 'C3').toBeLessThanOrEqual(0.035)
      expect.soft(r.c4AsleepAfter, 'C4').toBeGreaterThan(0)
      expect.soft(r.lowest, 'nothing under the ground').toBeGreaterThan(-0.5)
      expect.soft(r.deepest, 'no centre ever under the ground').toBeLessThanOrEqual(0)
      expect.soft(r.fellThrough, 'nothing let through the ground').toBe(0)
    })
  }
})
