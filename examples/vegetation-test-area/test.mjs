// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/vegetation-area.js')
const page = join(here, 'dist/sala-vegetacao.html')
if (!existsSync(bundle)) throw new Error('dist/vegetation-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('vegetation')) throw new Error('the bundle does not carry the vegetation module')
for (const id of ['plant_lot', 'toggle_walker', 'piece_boxes', 'axe_fells_crown', 'walk_on_grass', 'mango_young_30', 'potted_cactus', 'quintal-']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('VegetationArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-vegetacao.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
