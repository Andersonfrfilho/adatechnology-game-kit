import { appendFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bowl } from './bowl-energy'

const SEEDS = Array.from({ length: Number(process.env.BOWL_SEEDS ?? 16) }, (_, i) => i + Number(process.env.BOWL_FROM ?? 1))

describe('deepening bowl, energy criteria (DECISION-fable §2)', () => {
  for (const dt of [0.05, 1 / 60].filter((d) => !process.env.BOWL_DT || Math.abs(d - Number(process.env.BOWL_DT)) < 1e-3)) {
    it.each(SEEDS)(`C1-C4 (dt ${dt.toFixed(3)}, seed %i)`, { timeout: 60000 }, (seed) => {
      const r = bowl(seed, dt)
      const line = JSON.stringify({ solver: process.env.PIECE_SOLVER ?? 'jolt', iterations: Number(process.env.JOLT_ITERATIONS ?? 20), dt: Number(dt.toFixed(4)), seed, ...r })
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
