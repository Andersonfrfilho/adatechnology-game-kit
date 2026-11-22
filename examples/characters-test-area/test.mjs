// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): the 13 undead types and the professions of the area, front and side, one row per sheet at one camera distance (same scale), with a height ruler (1.80 m declared, 2.10 m door) at the left of each row.
// Prints and shots/index.json go to examples/characters-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

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
  const catalogue = await opened.page.evaluate(() => /** @type {any} */ (window).CharactersArea.createModule().items('en').map((/** @type {{ id: string }} */ item) => item.id))
  const undead = catalogue.filter((/** @type {string} */ id) => id.startsWith('zombie_'))
  const people = catalogue.filter((/** @type {string} */ id) => id.startsWith('person_'))
  const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), knownDefectsFile: join(here, 'known-defects.json'), area: 'characters', seed: 'none (the bodies are drawn without random draws; ages and wounds at the area defaults)', catalogue: { count: catalogue.length, source: 'packages/game-characters-undead/src/data (UNDEAD_TYPES) and packages/game-characters-people/src/data (PROFESSIONS), the items of the area' } })
  // the bodies of the area face the camera at yaw PI (examples/characters-test-area placements), so a profile is a quarter turn
  const FRONT = Math.PI
  const SIDE = -Math.PI / 2
  const view = { kind: 'front', fov: 22, elevationDeg: 2 }
  let number = 0
  for (const [family, ids] of [['undead', undead], ['professions', people]]) {
    for (const [name, yaw] of /** @type {[string, number][]} */ ([['front', FRONT], ['side', SIDE]])) {
      number += 1
      const laid = await recorder.sheet({ file: `${String(number).padStart(2, '0')}-${family}-${name}`, family, entries: ids.map((/** @type {string} */ id) => ({ id })), view, yaw, gap: 0.45, ruler: true })
      // the professions are declared 1.80 m tall: the box of the drawn body says how tall they are
      if (family === 'professions' && name === 'front') {
        const heights = laid.cells.map((/** @type {{ size: { dy: number } }} */ cell) => cell.size.dy)
        if (Math.max(...heights) > 1.9) recorder.observe('professions', 'height-over-declared', `${Math.min(...heights).toFixed(2)}-${Math.max(...heights).toFixed(2)} m against 1.80 m declared`)
      }
    }
  }
  const summary = recorder.finish()
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
