import type { ResidentialRegion } from '../types'
import { facadeColors } from './facade-colors'
import { swatches } from './swatches'
import { zones } from './zones'

/** Brazil: paint swatches, facade colours and typical municipal zones. */
export const br: ResidentialRegion = { id: 'br', swatches, facadeColors, zones }
