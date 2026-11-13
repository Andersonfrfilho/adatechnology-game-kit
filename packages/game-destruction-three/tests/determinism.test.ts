import { describe, expect, it } from 'vitest'
import { deepeningBowl } from './bowl-scene'

describe('the contact solver is deterministic', () => {
  it('the same seed and fixed step give the same result, to the bit', () => {
    for (const dt of [0.05, 1 / 60]) expect(deepeningBowl(7, dt)).toEqual(deepeningBowl(7, dt))
  })
})
