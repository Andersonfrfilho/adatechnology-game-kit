import { describe, expect, it } from 'vitest'

import { resolveSimulationTick } from '../src/world'

describe('the tick of the world (spec 010 T3.4)', () => {
  it('the tick is two physics steps and a world with another fixed step is refused at boot', () => {
    expect(resolveSimulationTick({ loopStep: 1 / 120, nominalTick: 1 / 60 })).toBe(1 / 60)
    expect(resolveSimulationTick({ loopStep: undefined, nominalTick: 1 / 60 })).toBe(1 / 60)
    expect(() => resolveSimulationTick({ loopStep: 1 / 60, nominalTick: 1 / 60 })).toThrow()
  })
})
