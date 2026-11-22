// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): every species of the area, front view, six to a sheet.
// Prints and shots/index.json go to examples/vegetation-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chunks, createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

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
if (!existsSync(page)) {
  console.log('ok: bundle (no room page: build examples/test-room first)')
  process.exit(0)
}
console.log('ok: bundle and room page')

const require = createRequire(import.meta.url)
const { chromium } = /** @type {Partial<typeof import('playwright')>} */ (['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {})
if (!chromium) {
  console.log('ok: bundle and room page (playwright not found: contact sheets skipped)')
  process.exit(0)
}

const opened = await openRoomPage({ chromium, pageFile: page })
try {
  const catalogue = await opened.page.evaluate(() => /** @type {any} */ (window).VegetationArea.createModule().items('en').map((/** @type {{ id: string }} */ item) => item.id))
  const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), knownDefectsFile: join(here, 'known-defects.json'), area: 'vegetation', seed: 'bench seed of the area (default), wind 0, condition and season at the area defaults', catalogue: { count: catalogue.length, source: 'packages/game-vegetation-species (defaultVegetationSpecies of game-kit-defaults), the items of the area' } })
  for (const [at, ids] of chunks(catalogue, 6).entries()) {
    await recorder.sheet({ file: `${String(at + 1).padStart(2, '0')}-species-front-${at + 1}`, family: 'species', entries: ids.map((/** @type {string} */ id) => ({ id })), view: { kind: 'front', fov: 28, elevationDeg: 4 }, yaw: 0, gap: 1.2 })
  }
  const summary = recorder.finish()
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
