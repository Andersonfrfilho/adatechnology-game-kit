// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/urban-area.js')
const page = join(here, 'dist/sala-urbana.html')
if (!existsSync(bundle)) throw new Error('dist/urban-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('urban')) throw new Error('the bundle does not carry the urban module')
for (const id of ['street_grid', 'terrain_patch', 'pole_flood_tower', 'light_radius', 'urban_light_budget', 'urban_providers', 'mountain_resort', 'railway_village']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('UrbanArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-urbana.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
