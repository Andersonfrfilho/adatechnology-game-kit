import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerStructure, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { register, ruralTemplateIds } from '../src'

registerResidential(engine)
register(engine)
registerStructure(engine)

const SEEDS = [1, 2, 3, 4, 5, 6]
/** Each template on its defaults and on the options that change how it is built (storeys, basement, foundation, rooms). */
const VARIANTS: [string, Record<string, unknown>][] = [
  ...ruralTemplateIds.map((id): [string, Record<string, unknown>] => [id, {}]),
  ['wood_frame_house', { floors: 2, basement: 'basement', fireplace: true }],
  ['a_frame_chalet', { foundation: 'stilts' }],
  ['a_frame_chalet', { foundation: 'slab' }],
  ['log_cabin', { rooms: 2, water: 'well' }],
  ['shack', { rooms: 2, bathroom: 'indoor' }],
  ['campsite', { tents: 4 }],
]

/** Construction tests (CLAUDE.md §11): wood frame, logs, shacks and tents carry their load down to the ground, the validator of the SDK finds nothing. */
describe('rural construction', () => {
  for (const [id, options] of VARIANTS) {
    it(`${id} ${JSON.stringify(options)}: load paths and concrete on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
      for (const seed of SEEDS) {
        const plan = engine.generate(id, { seed, ...options }) as unknown as { structure: Structure; doors: SourceDoor[] }
        expect(validateStructure(plan.structure, { doors: plan.doors }), `${id} seed ${seed}`).toEqual([])
      }
    })
  }
})
