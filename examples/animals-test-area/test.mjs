// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/animals-area.js')
const page = join(here, 'dist/sala-animais.html')
if (!existsSync(bundle)) throw new Error('dist/animals-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('animals_area')) throw new Error('the bundle does not carry the animals_area module')
for (const id of ['visual_state', 'bite_all', 'skin_40', 'carcass_lure', 'bite_to_turn_timer', 'animal_']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('AnimalsArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-animais.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
