// Checks the build output: the bundle exposes the proving module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/proving-area.js')
const page = join(here, 'dist/sala-banco-de-provas.html')
if (!existsSync(bundle)) throw new Error('dist/proving-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
for (const id of ['vehicles_proving', 'accel_0_100', 'top_speed', 'brake_100_0', 'turn_circle', 'wet_brake_80_0', 'mud_traction', 'reverse_camera', 'certify_now', 'rear_view']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('ProvingArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-banco-de-provas.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
