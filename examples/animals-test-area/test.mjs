// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): every species of the area, side view, in sheets of at most eight, prints and shots/index.json in examples/animals-test-area/shots.
// Run: node build.mjs && node test.mjs   (the shots are not tracked: .gitignore; index.json is)
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/animals-area.js')
const page = join(here, 'dist/sala-animais.html')
if (!existsSync(bundle)) throw new Error('dist/animals-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('animals_area')) throw new Error('the bundle does not carry the animals_area module')
for (const id of ['visual_state', 'bite_all', 'skin_40', 'carcass_lure', 'bite_to_turn_timer', 'animal_']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (!existsSync(page)) {
  console.log('ok: bundle (no room page: build examples/test-room first)')
  process.exit(0)
}
if (!readFileSync(page, 'utf8').includes('AnimalsArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-animais.html does not boot the area')
console.log('ok: bundle and room page')

const require = createRequire(import.meta.url)
const { chromium } = /** @type {Partial<typeof import('playwright')>} */ (['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {})
if (!chromium) {
  console.log('ok: bundle and room page (playwright not found: contact sheets skipped)')
  process.exit(0)
}

const SHEET_SIZE = 8
const SEED = 'species seed 7 (the module default: drawSeed)'
const opened = await openRoomPage({ chromium, pageFile: page })
const species = await opened.page.evaluate(() => /** @type {any} */ (window).AnimalsArea.createModule().items('en').map((/** @type {{ id: string }} */ item) => item.id))
const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), area: 'animals', seed: SEED, catalogue: { count: species.length, source: 'packages/game-animals-species/src (SPECIES), the items of the area' } })
for (let first = 0; first < species.length; first += SHEET_SIZE) {
  const entries = species.slice(first, first + SHEET_SIZE).map((/** @type {string} */ id) => ({ id }))
  const number = String(first / SHEET_SIZE + 1).padStart(2, '0')
  await recorder.sheet({ file: `${number}-species-side-${String(first / SHEET_SIZE + 1)}`, family: 'species', entries, view: { kind: 'side', fov: 22, elevationDeg: 4 }, yaw: 'long-axis-x', gap: 0.6 })
}
const summary = recorder.finish()
await opened.browser.close()
if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
if (summary.sheets === 0) process.exit(1)
