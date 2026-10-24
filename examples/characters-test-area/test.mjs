// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/characters-area.js')
const page = join(here, 'dist/sala-personagens.html')
if (!existsSync(bundle)) throw new Error('dist/characters-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('characters_area')) throw new Error('the bundle does not carry the characters_area module')
for (const id of ['hit_preset', 'death_rule', 'region_x_caliber', 'benchmark_1000', 'zombie_', 'person_']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('CharactersArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-personagens.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)
