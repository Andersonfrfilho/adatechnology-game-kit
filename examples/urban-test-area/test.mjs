// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): every piece of the area: the five poles side by side, then the street grid, the terrain patch and each of the ten neighbourhoods on a sheet of their own from the air.
// Prints and shots/index.json go to examples/urban-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chunks, createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/urban-area.js')
const page = join(here, 'dist/sala-urbana.html')
if (!existsSync(bundle)) throw new Error('dist/urban-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('urban')) throw new Error('the bundle does not carry the urban module')
for (const id of ['street_grid', 'terrain_patch', 'pole_flood_tower', 'light_radius', 'urban_light_budget', 'urban_providers', 'mountain_resort', 'railway_village']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
for (const id of ['openCityPlans', 'fillDowntown', 'regional_city', 'mountain_village', 'commercial_center']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('UrbanArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-urbana.html does not boot the area')
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
const catalogue = await opened.page.evaluate(() => /** @type {any} */ (window).UrbanArea.createModule().items('en').map((/** @type {{ id: string }} */ item) => item.id))
const poles = catalogue.filter((/** @type {string} */ id) => id.startsWith('pole_'))
const scenes = catalogue.filter((/** @type {string} */ id) => !id.startsWith('pole_'))
const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), area: 'urban', seed: 'bench seed of the area (default); lamps share and light budget at the area defaults', catalogue: { count: catalogue.length, source: 'packages/game-urban-three (poles and neighbourhoods of defaultUrbanProviders of game-kit-defaults), the items of the area' } })
await recorder.sheet({ file: '01-poles-front', family: 'poles', entries: poles.map((/** @type {string} */ id) => ({ id })), view: { kind: 'front', fov: 26, elevationDeg: 3 }, yaw: 0, gap: 1.5, ruler: true })
for (const [at, id] of scenes.entries()) {
  await recorder.sheet({ file: `${String(at + 2).padStart(2, '0')}-scene-${id}`, family: 'scenes', entries: [{ id }], view: { kind: 'aerial', fov: 40, elevationDeg: 38 }, yaw: 0, gap: 0 })
}
const summary = recorder.finish()
await opened.browser.close()
if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
if (summary.sheets === 0) process.exit(1)
