import { describe, expect, it } from 'vitest'

import { create } from '../src'
import { GameInteractables, GameInteractablesHousehold, TEMPLATES, planOf } from './support/plans'

/** The household kit draws the kitchen sink's worktop 0.9 m high, whatever the box the plan gives it. */
const SINK_WORKTOP = 0.9

describe('kitchen sink and the base cabinet beside it', () => {
  it('share the worktop height: the cabinet is never higher than the sink', () => {
    const adapter = create({ GameInteractables, GameInteractablesHousehold })
    let cabinets = 0
    for (const template of TEMPLATES) {
      for (const seed of [1, 2, 3, 4]) {
        const plan = planOf(template, seed)
        for (const entry of adapter.plan(plan, { seed }).items) {
          if (!entry.id.endsWith('#cabinet') || entry.type !== 'kitchen_cabinet_base') continue
          cabinets++
          expect(entry.item.h, `${template} ${seed} ${entry.id}`).toBe(SINK_WORKTOP)
        }
      }
    }
    expect(cabinets).toBeGreaterThan(0)
  })
})
