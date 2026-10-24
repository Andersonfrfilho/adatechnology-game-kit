// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/vehicles-area.js')
const page = join(here, 'dist/sala-veiculos.html')
if (!existsSync(bundle)) throw new Error('dist/vehicles-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('vehicles_area')) throw new Error('the bundle does not carry the vehicles_area module')
for (const id of ['paint_by_seed', 'drive_lane', 'damageables', 'vehicles_9mm_windshield', 'vehicles_drive_semi', 'compact_hatch', 'attack_helicopter']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('VehiclesArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-veiculos.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
