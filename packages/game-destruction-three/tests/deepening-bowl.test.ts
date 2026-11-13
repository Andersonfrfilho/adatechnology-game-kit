import { describe, expect, it } from 'vitest'
import { deepeningBowl } from './bowl-scene'

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1)

describe('a sheet on plates in a bowl that deepens under them', () => {
  for (const dt of [0.05, 1 / 60]) {
    it.each(SEEDS)(`is never carried up nor sent up by the contacts (dt ${dt.toFixed(3)}, seed %i)`, (seed) => {
      const { lift, fastestUp, sheetY } = deepeningBowl(seed, dt)
      if (process.env.BOWL_REPORT) console.log(`bowl dt ${dt.toFixed(3)} seed ${seed} lift ${lift.toFixed(4)} up ${fastestUp.toFixed(3)} y ${sheetY.toFixed(3)}`)
      expect(lift).toBeLessThanOrEqual(0.035)
      expect(fastestUp).toBeLessThanOrEqual(0.05)
    })
  }
})
