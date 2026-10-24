// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/items-area.js')
const page = join(here, 'dist/sala-itens.html')
if (!existsSync(bundle)) throw new Error('dist/items-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('items_area')) throw new Error('the bundle does not carry the items_area module')
for (const id of ['roll_finds', 'age_days', 'simple_shapes', 'stand_models']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (!text.includes('canned_beans')) throw new Error('the bundle does not carry the goods catalog')
if (existsSync(page) && !readFileSync(page, 'utf8').includes('ItemsArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-itens.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
