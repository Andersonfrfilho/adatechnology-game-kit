// End-to-end test of dist/test-room.html with Playwright (Chromium, software GL): opens it via file:// with the network blocked,
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
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

const url = pathToFileURL(dist).href
await page.goto(`${url}?scenario=all`)
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const report = await page.evaluate(() => window.__testRoomReport)

console.log(`\nscenarios: ${report.passed} passed, ${report.failed} failed`)
for (const r of report.results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
  for (const c of r.checks) if (!c.ok) console.log(`   ✗ ${c.label}`)
}

// screenshots: a fresh room per scene, driven through window.__testRoom
async function shot(name, setup) {
  await page.goto(`${url}?ui=1`)
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 60000 })
  await page.evaluate(setup)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotsDir, `${name}.png`) })
}
await shot('overview', () => {
  const r = window.__testRoom
  r.spawn('chair', [-1.5, 0, -2])
  r.spawn('wooden_crate', [0, 0, -2])
  r.spawn('coffee_cup', [3.5, 0.8, -1.5])
})
await shot('glass-shot', async () => {
  const r = window.__testRoom
  r.spawn('glass_pane', [0, 0, -3])
  r.equip?.('pistol')
  await r.runScenarios(r.scenarios.filter((s) => s.id === 'glass_shatters'))
})
await shot('burning-crate', () => {
  const r = window.__testRoom
  const o = r.spawn('wooden_crate', [0, 0, -4])
  r.setTool('lighter')
  r.update(0.4)
  r.look([0, 0.3, -3.65], [0, 0.25, -3.76])
  r.use(5)
  for (let i = 0; i < 12; i++) r.update(0.25)
  r.look([0.4, 1.2, -2.2], [0, 0.3, -4])
  return o
})
await shot('coffee-spill', async () => {
  const r = window.__testRoom
  await r.runScenarios(r.scenarios.filter((s) => s.id === 'tilt_cup_spills'))
})

await shot('rental-car-module', async () => {
  // the module scenario loads the rental car; the door then opens through its own `open` clip and the animations panel lists it
  const r = window.__testRoom
  await r.runScenarios(r.scenarios.filter((s) => s.id === 'load_rental_car_module'))
  r.clear()
  const car = r.spawn('rental_car', [0, 0, -5], 0.6)
  r.look([-3.4, 1.5, -1.6], [-0.4, 0.7, -4.6])
  r.playAnimation('open', car.objectId)
  for (let i = 0; i < 90; i++) r.update(1 / 60)
  r.setTool('pistol_9mm')
  r.update(0.4)
  r.look([-3.4, 1.5, -1.6], [-0.4, 0.7, -4.6])
})

// the behaviour log of a full run
await page.goto(`${url}?scenario=all`)
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const ndjson = await page.evaluate(() => window.__testRoom.log.toNDJSON())
writeFileSync(join(shotsDir, 'log.ndjson'), ndjson)

await browser.close()
let bad = report.failed > 0
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
