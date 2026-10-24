import { engine } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'

import { register as registerStructure } from '../src'

registerResidential(engine)
registerCommercial(engine)
registerPostApocalyptic(engine)
registerStructure(engine)

export { engine }
