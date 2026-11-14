import { appendFileSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { bowl } from './bowl-energy'
import type { BowlResult } from './bowl-energy'

const SEEDS = Array.from({ length: Number(process.env.BOWL_SEEDS ?? 16) }, (_, i) => i + Number(process.env.BOWL_FROM ?? 1))
// the bowl is the Jolt gate; BOWL_OWN=1 runs it on the kit's own solver too, to read the same columns (it does not pass there: gate 0 measured 46/128)
const RUNS_HERE = process.env.PIECE_SOLVER === 'jolt' || process.env.BOWL_OWN === '1'

const runs: BowlResult[] = []

describe.skipIf(!RUNS_HERE)('deepening bowl, energy criteria (DECISION-fable §2)', () => {
  afterAll(() => {
    if (runs.length === 0) return
    const worst = (pick: (r: BowlResult) => number): number => Math.max(...runs.map(pick))
    const summary = {
      solver: process.env.PIECE_SOLVER ?? 'own',
      iterations: Number(process.env.JOLT_ITERATIONS ?? 20),
      cases: runs.length,
      worstC1: worst((r) => r.c1Excess),
      worstC2: worst((r) => r.c2Gain),
      worstC2Unconditioned: worst((r) => r.c2GainUnconditioned),
      worstC3: worst((r) => r.c3Lift),
      worstC4: worst((r) => r.c4AsleepAfter),
      worstDeepest: worst((r) => r.deepest),
      fellThrough: worst((r) => r.fellThrough),
    }
    console.log(`bowl worst ${JSON.stringify(summary)}`)
  })

  for (const dt of [0.05, 1 / 60].filter((d) => !process.env.BOWL_DT || Math.abs(d - Number(process.env.BOWL_DT)) < 1e-3)) {
    it.each(SEEDS)(`C1-C4 (dt ${dt.toFixed(3)}, seed %i)`, { timeout: 60000 }, async (seed) => {
      // each case is ~0.6 s of synchronous work: without a turn of the loop between them the runner's report times out after ~60 s (64 seeds, one process)
      await new Promise((resolve) => setTimeout(resolve, 0))
      const r = bowl(seed, dt)
      runs.push(r)
      const line = JSON.stringify({ solver: process.env.PIECE_SOLVER ?? 'own', iterations: Number(process.env.JOLT_ITERATIONS ?? 20), dt: Number(dt.toFixed(4)), seed, ...r })
      if (process.env.SPIKE_OUT) appendFileSync(process.env.SPIKE_OUT, `${line}\n`)
      expect.soft(r.c1Excess, 'C1').toBeLessThanOrEqual(0)
      expect.soft(r.c2Gain, 'C2').toBeLessThanOrEqual(0.035)
      expect.soft(r.c2GainUnconditioned, 'C2 without the C1 condition').toBeLessThanOrEqual(0.035)
      expect.soft(r.c3Lift, 'C3').toBeLessThanOrEqual(0.035)
      expect.soft(r.c4AsleepAfter, 'C4').toBeGreaterThan(0)
      expect.soft(r.lowest, 'nothing under the ground').toBeGreaterThan(-0.5)
      expect.soft(r.deepest, 'no centre ever under the ground').toBeLessThanOrEqual(0)
      expect.soft(r.fellThrough, 'nothing let through the ground').toBe(0)
    })
  }
})
