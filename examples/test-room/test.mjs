// End-to-end test of dist/test-room.html (the room with the SDK's real content loaded) with Playwright (Chromium, software GL): opens it via file:// with the network blocked,
// runs every scenario (?scenario=all), prints the report and saves screenshots plus the behaviour log to shots/.
// Run: node build.mjs && node test.mjs   (Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH, e.g. /opt/pw-browsers)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* try the next one */
    }
  }
  throw new Error('playwright not found (set NODE_PATH or install it)')
}
const { chromium } = loadPlaywright()

const dist = join(here, 'dist/test-room.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
const shotsDir = join(here, 'shots')
mkdirSync(shotsDir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const external = []
const consoleErrors = []
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await context.route('**/*', (route) => {
  const url = route.request().url()
  if (/^(file|data|blob|about):/.test(url)) return route.continue()
  external.push(url)
  return route.abort()
})
const page = await context.newPage()
// the weapon thumbnails (../weapon-svg/) exist only in the built site: on file:// each one is a CORS error plus a bare "Failed to load resource"
const isThumbnailError = (text) => /weapon-svg|^Failed to load resource: net::ERR_FAILED$/.test(text)
page.on('console', (m) => {
  if (m.type() === 'error' && !isThumbnailError(m.text())) consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

const url = pathToFileURL(dist).href
await page.goto(`${url}?scenario=all`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const report = await page.evaluate(() => window.__testRoomReport)


console.log(`\nscenarios: ${report.passed} passed, ${report.failed} failed`)
for (const r of report.results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
  for (const c of r.checks) if (!c.ok) console.log(`   ✗ ${c.label}`)
}

// the default page carries the SDK's real items (the teams' content) and none of the old procedural demo ones
const DEMO_IDS = ['chair', 'sofa_demo', 'shelf', 'old_tv', 'steel_sheet', 'glass_pane', 'concrete_block', 'brick_column', 'building_frame', 'car_door', 'small_tree', 'potted_plant', 'coffee_cup', 'glass_bottle', 'wooden_crate', 'steel_drum', 'plastic_bucket', 'jerrycan', 'rental_car']
const content = await page.evaluate(() => {
  const r = window.__furnitureReport
  const lists = { household: r.items, weapons: r.weapons?.items ?? [], goods: r.itemsArea?.items ?? [], vehicles: r.vehicles?.items ?? [], vegetation: r.vegetation?.items ?? [], characters: r.characters?.items ?? [], animals: r.animals?.items ?? [] }
  const all = Object.values(lists).flat()
  const room = window.__testRoom
  const spawnable = {}
  for (const id of ['weapon_pistol_9mm', 'fridge', 'item_canned_beans', 'sedan', 'mango_tree', 'zombie_walker']) {
    try {
      spawnable[id] = !!room.spawn(id, [0, 0, -5], 0)
    } catch {
      spawnable[id] = false
    }
    room.clear()
  }
  return { counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])), all, spawnable, problems: Object.values(r).flatMap((x) => x?.problems ?? []).length }
})
const extra = content.all.filter((id) => id.startsWith('weapon_') || id.startsWith('item_')).length
const demoLeft = DEMO_IDS.filter((id) => content.all.includes(id))
const spawnOk = Object.values(content.spawnable).every(Boolean)
const contentOk = content.counts.household === 51 && content.counts.weapons > 100 && content.counts.goods > 300 && demoLeft.length === 0 && spawnOk && extra > 400
console.log(`${contentOk ? 'PASS' : 'FAIL'}  default page loads the SDK content`, JSON.stringify({ counts: content.counts, demoLeft, spawnable: content.spawnable }))
if (!contentOk) report.failed++

// screenshots: a fresh room per scene, driven through window.__testRoom
async function shot(name, setup) {
  await page.goto(`${url}?ui=1`, { timeout: 180000 })
  await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
  await page.evaluate(setup)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotsDir, `${name}.png`) })
}
await shot('overview', () => {
  const r = window.__testRoom
  r.spawn('fridge', [-1.5, 0, -2])
  r.spawn('sofa', [0.5, 0, -2])
  r.spawn('sedan', [4, 0, -4])
})
await shot('weapon-in-hand', () => {
  const r = window.__testRoom
  r.spawn('wardrobe', [0, 0, -3])
  r.setTool('pistol_9mm')
  for (let i = 0; i < 40; i++) r.update(0.02)
})
await shot('burning-sofa', () => {
  const r = window.__testRoom
  r.spawn('sofa', [0, 0, -4])
  r.setTool('lighter')
  r.update(0.4)
  r.look([0, 0.5, -3.2], [0, 0.4, -4])
  r.use(5)
  for (let i = 0; i < 12; i++) r.update(0.25)
  r.look([0.4, 1.2, -2.2], [0, 0.3, -4])
})

// the player's body: hidden in first person (the default), shown after V, with the startup hint in the log and the V hint on the HUD
await page.goto(`${url}?ui=1`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 60000 })
const before = await page.evaluate(() => ({ mode: window.__testRoom.cameraMode, visible: window.__testRoom.avatar?.root.visible, hint: window.__testRoom.log.entries().some((e) => /\bV\b/.test(e.text)) }))
await page.keyboard.press('KeyV')
await page.evaluate(() => {
  const r = window.__testRoom
  r.spawn('fridge', [-1.5, 0, -2])
  r.look([0, 1.7, 3.5], [0, 1.2, -8])
  for (let i = 0; i < 40; i++) r.update(0.02)
})
await page.waitForTimeout(400)
await page.screenshot({ path: join(shotsDir, 'third-person.png') })
const after = await page.evaluate(() => ({ mode: window.__testRoom.cameraMode, visible: window.__testRoom.avatar?.root.visible, help: document.querySelector('.tr-help')?.textContent ?? '' }))
const bodyOk = before.mode === 'first' && before.visible === false && before.hint && after.mode === 'third' && after.visible === true && /V:/.test(after.help)
console.log(`${bodyOk ? 'PASS' : 'FAIL'}  the player body: hidden in first person, shown after V, hint on the HUD and in the log`, JSON.stringify({ before, after: { mode: after.mode, visible: after.visible } }))

// the behaviour log of a full run
await page.goto(`${url}?scenario=all`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const ndjson = await page.evaluate(() => window.__testRoom.log.toNDJSON())
writeFileSync(join(shotsDir, 'log.ndjson'), ndjson)

await browser.close()
let bad = report.failed > 0 || !bodyOk
if (external.length) {
  console.log('external requests:', external)
  bad = true
}
if (consoleErrors.length) {
  console.log('console errors:', consoleErrors)
  bad = true
}
console.log(bad ? 'FAILED' : 'OK')
process.exit(bad ? 1 : 0)
