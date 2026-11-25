import { engine } from '@adatechnology/game-floorplan'
import { PANEL_ENVELOPE, register as registerStructure } from '@adatechnology/game-floorplan-structure'
import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { register, residentialItems, residentialTemplateIds } from '../src'
import { OPENING_RULE, layoutDefectsOf } from './support/layout-defects'

register(engine, { region: 'br' })
registerStructure(engine)

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1)
/** The tower is a spec built from its layout, not a furnished house. */
const HOUSES = residentialTemplateIds.filter((id) => id !== 'residential_tower')

/**
 * Layout of the furnished house, on the plan (no GPU): nothing runs into anything else or into a wall, what hangs on a wall (the panel with its door
 * open, sockets, switches, pictures, the air conditioner, curtains and blinds) keeps a gap, every door and drawer opens into free room, and the exposed
 * pipes never cross a doorway. The exemptions are in `support/layout-defects.ts`.
 */
describe('residential layout', () => {
  it('the catalogue keeps clear at least the opening the rule asks of each item with doors or drawers', () => {
    for (const item of residentialItems) {
      const rule = OPENING_RULE[item.category]
      if (rule) expect(item.opening ?? 0, item.type).toBeGreaterThanOrEqual(rule)
    }
  })

  let outbuildings = 0
  for (const id of HOUSES) {
    it(`${id}: no clash on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
      const found: string[] = []
      for (const seed of SEEDS) {
        const result = engine.generate(id, { seed }) as unknown as StructuredResult
        outbuildings += result.outbuildings.length
        for (const d of layoutDefectsOf(result, PANEL_ENVELOPE)) found.push(`seed ${seed} ${d.kind}: ${d.a} x ${d.b} (${d.depth.toFixed(3)} m)`)
      }
      expect(found).toEqual([])
    })
  }

  it('the sweep reaches houses with an outbuilding (edícula)', () => {
    expect(outbuildings).toBeGreaterThan(0)
  })
})
