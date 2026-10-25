import { engine } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '../../game-floorplan-commercial/src'
import { register as registerPostApocalyptic } from '../../game-floorplan-post-apocalyptic/src'
import { register as registerResidential } from '../../game-floorplan-residential/src'

import { register as registerStructure } from '../src'

registerResidential(engine)
registerCommercial(engine)
registerPostApocalyptic(engine)
registerStructure(engine)

/** Templates of skyscrapers: tens of storeys each, so the loops over every template leave them to `tower-plan.test.ts` (one plan, 20 storeys). */
export const TOWER_TEMPLATES = ['office_tower', 'residential_tower']

export { engine }
