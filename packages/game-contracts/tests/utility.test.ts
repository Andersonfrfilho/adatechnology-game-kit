import { describe, expectTypeOf, it } from 'vitest'

import type { UtilityConnection, UtilityNetwork } from '../src'

describe('UtilityConnection', () => {
  it('names the five street networks and the two frames', () => {
    expectTypeOf<UtilityNetwork>().toEqualTypeOf<'power' | 'telecom' | 'sewer' | 'storm' | 'water'>()
    expectTypeOf<UtilityConnection['frame']>().toEqualTypeOf<'plan' | 'world'>()
    const sewer: UtilityConnection = { lot: 'lot_1', network: 'sewer', frame: 'world', at: [1, 0, 2], invert: -0.6 }
    expectTypeOf(sewer.at).toEqualTypeOf<readonly [number, number, number]>()
  })
})
