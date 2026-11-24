import * as THREE from 'three'

import scriptsJson from '../../data/recorte-1.scripts.json'
import { startDistrict } from '../game/main'
import { createProbe } from './probe'
import type { DistrictProbe } from './probe'
import { districtOptionsOf, parsePageChoice } from './scenario'
import { parseScripts } from './scripts'

declare global {
  interface Window {
    /** Set when the district is up: the hook the browser checks read. */
    __district?: DistrictProbe
    /** Set when it could not come up: the message. */
    __districtError?: string
  }
}

const container = document.getElementById('app')
if (!container) throw new Error('the page has no #app')
const choice = parsePageChoice(location.search)
const scripts = parseScripts(scriptsJson)
startDistrict(THREE, districtOptionsOf({ scripts, choice, container }))
  .then((district) => {
    window.__district = createProbe(district, choice, scripts)
  })
  .catch((error: unknown) => {
    window.__districtError = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    console.error(window.__districtError)
  })
