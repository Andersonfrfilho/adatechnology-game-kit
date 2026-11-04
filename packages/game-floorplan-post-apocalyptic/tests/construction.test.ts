import { register as registerStructure, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { postApocalypticStates } from '../src'
import { engine } from './support'

registerStructure(engine)

const SEEDS = [1, 2, 3, 4]
/** Every template the post-apocalyptic states apply to (towers are specs built apart: their own packages check them). */
const TEMPLATES = engine.listTemplates().map((t) => t.id).filter((id) => !/tower/.test(id))

/** Construction tests (CLAUDE.md §11): a fortified or abandoned building is still the same structure, the validator of the SDK finds nothing. */
describe('post-apocalyptic construction', () => {
  for (const state of postApocalypticStates) {
    for (const id of TEMPLATES) {
      it(`${id} ${state}: structure on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
        for (const seed of SEEDS) {
          const plan = engine.generate(id, { seed, state }) as unknown as { structure: Structure; doors: SourceDoor[] }
          expect(validateStructure(plan.structure, { doors: plan.doors }), `${id} ${state} seed ${seed}`).toEqual([])
        }
      })
    }
  }
})
