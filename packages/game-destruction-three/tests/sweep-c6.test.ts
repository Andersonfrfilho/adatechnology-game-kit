import { appendFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'

import { bowl } from './bowl-energy'
import type { BowlResult } from './bowl-energy'
import { stack } from './stack-energy'

// C6, the robustness sweep: off in the default `test`; `node tests/sweep-c6.mjs` runs it over 8 processes and prints the table (SWEEP_FROM / SWEEP_COUNT cut the seeds)
const RUNS = process.env.SWEEP === '1'
const FROM = Number(process.env.SWEEP_FROM ?? 1)
const SEEDS = Array.from({ length: Number(process.env.SWEEP_COUNT ?? 64) }, (_, i) => i + FROM)
const STEPS = [1 / 30, 0.05, 1 / 60, 1 / 144]
// the production floor (KIT_WORLD, 32) and the old 20 for comparison; 8 and 10 left C6 by the owner's decision of 2026-11-14 (SWEEP_ITS=8,10,20,32 brings them back)
const ITERATIONS = (process.env.SWEEP_ITS ?? `20,${KIT_WORLD.velocityIterations}`).split(',').map(Number)
const PUSHOUTS = [0.5, 1, 1.5]
const PRODUCTION_PUSHOUT = KIT_WORLD.maxPushOut
if (PRODUCTION_PUSHOUT === undefined) throw new Error('KIT_WORLD has no maxPushOut: the sweep turns it around that value')
const SCENARIOS: Record<string, (seed: number, dt: number) => BowlResult> = {
  bowl,
  'stack 20:1': (seed, dt) => stack(seed, dt, [10, 200]),
  'stack of 5': (seed, dt) => stack(seed, dt, [50, 50, 50, 50, 50]),
}

const failuresOf = (r: BowlResult): string[] => {
  const failed: string[] = []
  if (r.c1Excess > 0) failed.push('C1')
  // C2 as the spec defines it, with the C1 condition; the unconditioned column is printed, never judged (owner decision 2026-11-14)
  if (r.c2Gain > 0.035) failed.push('C2')
  if (r.c3Lift > 0.035) failed.push('C3')
  if (r.c4AsleepAfter <= 0) failed.push('C4')
  if (r.lowest <= -0.5 || r.deepest > 0) failed.push('C3b')
  if (r.fellThrough !== 0) failed.push('fellThrough')
  return failed
}

describe.skipIf(!RUNS)('C6 robustness sweep', () => {
  it.each(SEEDS)('seed %i, every scenario and cell', { timeout: 3_600_000 }, async (seed) => {
    const cells: string[] = []
    for (const [scenario, run] of Object.entries(SCENARIOS)) {
      for (const dt of STEPS) {
        for (const iterations of ITERATIONS) {
          for (const factor of PUSHOUTS) {
            // each cell is ~0.6 s of synchronous work: a turn of the loop between them keeps the runner's report alive
            await new Promise((resolve) => setTimeout(resolve, 0))
            process.env.JOLT_ITERATIONS = String(iterations)
            process.env.JOLT_PUSHOUT = String(PRODUCTION_PUSHOUT * factor)
            const r = run(seed, dt)
            const failed = failuresOf(r)
            const line = JSON.stringify({ scenario, seed, dt: Number(dt.toFixed(4)), iterations, pushOutFactor: factor, failed, ...r })
            if (process.env.SWEEP_OUT) appendFileSync(process.env.SWEEP_OUT, `${line}\n`)
            if (failed.length > 0) cells.push(`${scenario} dt ${dt.toFixed(4)} it ${iterations} x${factor}: ${failed.join(',')}`)
          }
        }
      }
    }
    delete process.env.JOLT_ITERATIONS
    delete process.env.JOLT_PUSHOUT
    expect.soft(cells, `seed ${seed}`).toEqual([])
  })
})
