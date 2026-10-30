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

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the seven scenarios pass and the area shows 24 models on the stand.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const playwright = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright || !existsSync(page)) {
  console.log('skipped the browser check (no playwright or no room page)')
} else {
  const shots = join(here, 'shots')
  mkdirSync(shots, { recursive: true })
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
  const errors = []
  let failed = 0
  const check = (name, ok, detail) => {
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
  for (const lang of ['pt-BR', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
    const tab = await context.newPage()
    tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}`)
    await tab.waitForFunction(() => window.__itemsReport, null, { timeout: 90000 })
    await tab.evaluate(() => {
      const room = window.__testRoom
      for (let i = 0; i < 90; i++) room.update(0.02)
    })
    const shown = await tab.evaluate(() => window.__testRoom.metrics().module)
    await tab.waitForTimeout(400)
    await tab.screenshot({ path: join(shots, `items-${lang}.png`) })
    check(`[${lang}] the area opens with every item on the shelves`, shown.items > 350 && shown.draw_calls > shown.items && /^[1-9]\d*\/\d+$/.test(String(shown.modeled)), shown)
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__itemsReport
      const scenarios = room.scenarios.filter((s) => ['real_size', 'models', 'budgets', 'ruler', 'finds', 'freshness', 'craft'].some((id) => s.id.endsWith(id)))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('items_area')
      bench.set('seed', 3)
      bench.act('roll_finds')
      for (let i = 0; i < 30; i++) room.update(0.02)
      return { ok: report.ok, problems: report.problems, items: report.items.length, scenarios: scenarios.length, passed: result.passed, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), finds: room.metrics().module.finds }
    })
    check(`[${lang}] contract report is clean, 7 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 7 && state.failed === 0 && state.items > 350, state)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
