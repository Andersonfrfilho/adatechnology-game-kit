import { afterEach, describe, expect, it } from 'vitest'

import { register as registerRural } from '../../game-floorplan-rural/src'
import { STRUCTURAL_VIOLATION, validateStructure } from '../src'
import type { StructuredResult } from '../src'
import { engine, TOWER_TEMPLATES } from './support'

registerRural(engine)

// (a turn of the event loop between the tests, or the worker misses vitest's heartbeat in a long run of synchronous plans)
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)))

describe('every support that bears touches what it rests on (SUPPORT_WITHOUT_CONTACT), on every template, seeds 1-3', () => {
  const templates = (engine.listTemplates() as { id: string }[]).map((t) => t.id)
  it('sweeps the templates of the residential, commercial, post-apocalyptic and rural packs, the towers too', () => {
    expect(templates.length).toBeGreaterThan(25)
    expect(templates).toEqual(expect.arrayContaining(['mansion', 'high_end_contemporary', 'metalworks', 'gas_station', 'wood_frame_house', ...TOWER_TEMPLATES]))
  })
  for (const template of templates) {
    it(template, () => {
      for (const seed of [1, 2, 3]) {
        const result = engine.generate(template, { seed, state: 'normal' }) as StructuredResult
        if (!result.structure) continue
        const found = validateStructure(result.structure, { doors: result.doors }).filter((v) => v.code === STRUCTURAL_VIOLATION.SUPPORT_WITHOUT_CONTACT)
        expect(found.map((v) => v.message), `${template}#${seed}`).toEqual([])
      }
    })
  }
})
