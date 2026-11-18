import { describe, expect, it } from 'vitest'
import { planWorkers } from '../src/plan'

describe('planWorkers', () => {
  it('splits the cores as the design table says', () => {
    const lanes = (cores: number) => planWorkers({}, cores).lanes
    expect(lanes(1)).toEqual({ sim: 0, build: 0, background: 0 })
    expect(lanes(2)).toEqual({ sim: 1, build: 0, background: 0 })
    expect(lanes(4)).toEqual({ sim: 1, build: 2, background: 0 })
    expect(lanes(8)).toEqual({ sim: 3, build: 3, background: 1 })
    expect(lanes(16)).toEqual({ sim: 3, build: 4, background: 1 })
    expect(lanes(64)).toEqual({ sim: 3, build: 4, background: 1 })
  })

  it('one worker serves every lane; build lends a hand to sim; background never takes sim', () => {
    expect(planWorkers({}, 2).serves).toEqual([['sim', 'build', 'background']])
    const eight = planWorkers({}, 8)
    expect(eight.homes).toEqual(['sim', 'sim', 'sim', 'build', 'build', 'build', 'background'])
    expect(eight.serves).toEqual([['sim'], ['sim'], ['sim'], ['sim', 'build'], ['sim', 'build'], ['sim', 'build'], ['background']])
    expect(planWorkers({}, 4).serves.at(-1)).toEqual(['sim', 'build', 'background'])
  })

  it('leaves the reserved cores free and keeps the ceiling', () => {
    expect(planWorkers({ reserveCores: 3 }, 8).total).toBe(4)
    expect(planWorkers({ maxWorkers: 2 }, 16).total).toBe(2)
    expect(planWorkers({ workers: 0 }, 16).total).toBe(0)
    expect(planWorkers({ workers: 5 }, 2).total).toBe(5)
  })

  it('takes lanes by hand and the borrow switch', () => {
    const plan = planWorkers({ lanes: { sim: { workers: 2 }, build: { workers: 1, borrow: false }, background: { workers: 0 } } }, 16)
    expect(plan.lanes).toEqual({ sim: 2, build: 1, background: 0 })
    expect(plan.serves).toEqual([['sim'], ['sim'], ['build', 'background']])
  })
})
