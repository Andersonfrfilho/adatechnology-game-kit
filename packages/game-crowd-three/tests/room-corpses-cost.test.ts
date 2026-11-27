import { loadavg } from 'node:os'

import { describe, expect, it } from 'vitest'

import { crowdRoom, dropPile } from './room-corpses-support'

/**
 * Spec 008, TS.7, cost lane (`pnpm --filter @adatechnology/game-crowd-three test:cost`: `PHYSICS_COST=1`, under `perf-measure.lock`): the 100 dead of the pile through the crowd and
 * the room, in the `KIT_WORLD`. The owner's limits for the pile (2026-11-26): asleep in 14 s, the loop's step 6 ms at the median and 10 ms at p99, over the 5 s of deaths and the 3 s after.
 */
const LIMITS = { sleepSeconds: 14, medianMs: 6, p99Ms: 10 } as const
const WINDOW_FRAMES = 100 * 3 + 180
const SEEDS = [3, 5, 8]

const quantile = (values: readonly number[], share: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] as number
}

describe.runIf(process.env.PHYSICS_COST === '1')('100 dead in a pile through the crowd and the room (cost lane)', () => {
  it.each(SEEDS)('seed %d: asleep in 14 s, step median 6 ms and p99 10 ms', { timeout: 240000 }, async (seed) => {
    const pile = await crowdRoom('engine', { seed }, true)
    const run = dropPile(pile, 16)
    const window = run.costs.slice(0, WINDOW_FRAMES)
    const result = { seed, asleepAtS: run.asleepAtS, median: quantile(window, 0.5), p99: quantile(window, 0.99), max: Math.max(...window), load: loadavg()[0] }
    console.info(`[TS.7] cost ${JSON.stringify(result)}`)
    pile.room.dispose()
    pile.world!.dispose()
    expect(run.asleepAtS).toBeGreaterThan(0)
    expect(run.asleepAtS).toBeLessThanOrEqual(LIMITS.sleepSeconds)
    expect(result.median).toBeLessThanOrEqual(LIMITS.medianMs)
    expect(result.p99).toBeLessThanOrEqual(LIMITS.p99Ms)
  })
})
