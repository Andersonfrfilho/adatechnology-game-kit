import siteJson from '../../data/recorte-1.site.json'

import { parseSite } from './site'

/** The site of the reference district (lots, props, horde zones and the missing pieces), read from `data/recorte-1.site.json`. */
export const referenceSite = parseSite(siteJson)
