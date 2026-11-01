import { describe, expect, it } from 'vitest'

import { createChainScene, runChain } from './scenes'

/** 12 scenes: the queue of 6, 8 and 10 columns, each with four seeds. */
const COMBINATIONS = [6, 8, 10].flatMap((columns) => [11, 12, 13, 14].map((seed) => ({ columns, seed })))

describe('the chain beyond a grenade is not a coin toss', () => {
  it('knocks down at least one body beyond the direct shove in at least 10 of 12 scenes (landing radius 1.2 m)', () => {
    const beyond = COMBINATIONS.map(({ columns, seed }) => runChain(createChainScene({ columns, seed })).scene.crowd.stats.physics.fallsBeyondBlast)
    expect(beyond.filter((count) => count >= 1).length).toBeGreaterThanOrEqual(10)
    expect(Math.max(...beyond)).toBeLessThan(40)
  }, 120000)
})
