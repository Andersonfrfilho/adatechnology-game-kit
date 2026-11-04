import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerStructure, validateSpec, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { buildOfficeTower, commercialTemplateIds, register } from '../src'

registerResidential(engine, { region: 'br' })
register(engine, { region: 'br' })
registerStructure(engine)

const SEEDS = [1, 2, 3, 4, 5, 6]
/** The office tower is a spec built straight from its layout (`buildOfficeTower`), checked below. */
const BUILDINGS = commercialTemplateIds.filter((id) => id !== 'office_tower')

/** Construction tests (CLAUDE.md §11): every commercial typology is a structure a structural engineer signs, the validator of the SDK finds nothing. */
describe('commercial construction', () => {
  for (const id of BUILDINGS) {
    it(`${id}: confined masonry, concrete and load paths on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
      for (const seed of SEEDS) {
        const plan = engine.generate(id, { seed }) as unknown as { structure: Structure; doors: SourceDoor[] }
        expect(validateStructure(plan.structure, { doors: plan.doors }), `${id} seed ${seed}`).toEqual([])
      }
    })
  }

  it('office_tower: the frame, core and piles reach the ground with NBR 6118 sections', () => {
    expect(validateSpec(buildOfficeTower({ storeys: 20 }))).toEqual([])
  }, 180000)
})
