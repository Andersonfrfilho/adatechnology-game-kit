// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/weapons-area.js')
const page = join(here, 'dist/sala-armas.html')
if (!existsSync(bundle)) throw new Error('dist/weapons-area.js missing: run node build.mjs')
if (!readFileSync(bundle, 'utf8').includes('weapons_area')) throw new Error('the bundle does not carry the weapons_area module')
for (const id of ['toggle_light', 'toggle_laser', 'toggle_stock', 'switch_underbarrel']) {
  if (!readFileSync(bundle, 'utf8').includes(id)) throw new Error(`the bundle does not carry the accessory bench control "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('WeaponsArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-armas.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
