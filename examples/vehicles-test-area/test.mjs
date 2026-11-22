// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): every model of the fleet in 3/4 front view with the doors closed, six to a sheet, then the models that have doors, hood or lid (leaves) again with every leaf open.
// Prints and shots/index.json go to examples/vehicles-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chunks, createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

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
  const fleet = await opened.page.evaluate(() => {
    const area = /** @type {any} */ (window).VehiclesArea
    const report = area.loadFleetCatalogueInto(/** @type {any} */ (window).__testRoom)
    return { itemIds: report.items, fleetIds: area.fleetVehicleIds, problems: report.problems }
  })
  const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), knownDefectsFile: join(here, 'known-defects.json'), area: 'vehicles', seed: 'colour seed of the area bench (default), light quality, doors closed unless the sheet says open', catalogue: { count: fleet.itemIds.length, source: 'packages/game-vehicles-fleet/src/groups.ts (fleetVehicleIds), loaded as items by loadFleetCatalogueInto of examples/vehicles-test-area/src/entry.js' } })
  // the vehicles face +x at yaw 0 (the hood is at +x), so the camera stands at 45 degrees between the front (+x) and the side (+z)
  const view = { kind: '3q-front', fov: 28, azimuthDeg: 45, elevationDeg: 14 }
  /** @type {string[]} */
  const withLeaves = []
  for (const [at, ids] of chunks(fleet.itemIds, 6).entries()) {
    const laid = await recorder.sheet({ file: `${String(at + 1).padStart(2, '0')}-fleet-closed-${at + 1}`, family: 'fleet', entries: ids.map((/** @type {string} */ id) => ({ id })), view, yaw: 0, gap: 1.2 })
    for (const cell of laid.cells) if (cell.leaves.length > 0) withLeaves.push(cell.id)
  }
  const firstOpen = Math.ceil(fleet.itemIds.length / 6) + 1
  for (const [at, ids] of chunks(withLeaves, 3).entries()) {
    await recorder.sheet({ file: `${String(firstOpen + at).padStart(2, '0')}-fleet-open-${at + 1}`, family: 'fleet-open', entries: ids.map((/** @type {string} */ id) => ({ id })), view, yaw: 0, gap: 4, openLeaves: true })
  }
  // packages/game-vehicles-fleet/src/groups.ts `water`: a hull sits below the waterline, which is the ground of this room
  recorder.exempt('sinks', ['river_skiff', 'speedboat', 'fishing_boat', 'jet_ski', 'sailboat', 'rescue_dinghy', 'patrol_boat'], 'water vessels: the hull is meant to be under the waterline')
  const summary = recorder.finish()
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
