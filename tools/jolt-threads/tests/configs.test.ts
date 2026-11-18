import { describe, expect, it } from 'vitest'

import { THREAD_CONFIGS, poolRounds, statsOf, summariseRound } from '../src/configs'
import type { RoundResult } from '../src/configs'

describe('jolt-threads summaries', () => {
  it('reads mean, p99 and worst', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(statsOf(values)).toEqual({ mean: 50.5, p99: 100, worst: 100 })
    expect(statsOf([])).toEqual({ mean: 0, p99: 0, worst: 0 })
  })

  it('keeps the wake frame apart and reads the joltStep and update columns', () => {
    const frames = [
      [0, 0, 0, 0, 90, 0, 40],
      [0, 0, 0, 0, 10, 0, 2],
      [0, 0, 0, 0, 12, 0, 4],
    ]
    expect(summariseRound(frames)).toEqual({ step: { mean: 3, p99: 4, worst: 4 }, wakeStep: 40, update: { mean: 11, p99: 12, worst: 12 }, frames: 2 })
  })

  it('pools rounds by the mean of means, the median p99 and the worst of all, skipping failed rounds', () => {
    const base = { config: 'single', load: 1, info: { build: 'single', workerThreads: 0, contactCallbacks: 'js', crossOriginIsolated: true, hardwareConcurrency: 8, fallback: null }, wakeStep: 0, update: { mean: 0, p99: 0, worst: 0 }, frames: 1 }
    const rounds: RoundResult[] = [
      { ...base, round: 1, step: { mean: 2, p99: 3, worst: 5 } },
      { ...base, round: 2, step: { mean: 4, p99: 6, worst: 9 } },
      { ...base, round: 3, step: { mean: 3, p99: 4, worst: 7 } },
      { ...base, round: 4, step: { mean: 99, p99: 99, worst: 99 }, error: 'crashed' },
    ]
    expect(poolRounds(rounds, (round) => round.step)).toEqual({ mean: 3, p99: 4, worst: 9 })
  })

  it('marks only the configs with the JS contact listener as valid for the game', () => {
    expect(THREAD_CONFIGS.filter((config) => config.isGameValid).map((config) => config.id)).toEqual(['single', 'mt0-js'])
    expect(THREAD_CONFIGS.filter((config) => config.query.includes('joltThreads')).every((config) => config.query.includes('joltContacts=off'))).toBe(true)
  })
})
