// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/weather-area.js')
const page = join(here, 'dist/sala-clima.html')
if (!existsSync(bundle)) throw new Error('dist/weather-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('weather_area')) throw new Error('the bundle does not carry the weather_area module')
for (const id of ['auto_schedule', 'time_of_day', 'typhoon', 'extreme_heat']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('WeatherArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-clima.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the four scenarios pass and the bench drives the weather.
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
    await tab.waitForFunction(() => window.__weatherReport, null, { timeout: 90000 })
    await tab.evaluate(() => {
      for (let i = 0; i < 60; i++) window.__testRoom.update(0.02)
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `weather-${lang}.png`) })
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__weatherReport
      const scenarios = room.scenarios.filter((s) => ['storm', 'blend', 'determinism', 'dry_ground'].some((id) => s.id.endsWith(id)))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('weather_area')
      const before = room.metrics().module
      bench.set('state', 'storm')
      for (let i = 0; i < 400; i++) room.update(0.1)
      const after = room.metrics().module
      const wind = room.vfx.wind()
      const loops = room.audio ? room.audio.stats().loops : -1
      return { wind, loops, thunder: room.audio ? room.audio.registry.sound('thunder') !== undefined : false, ok: report.ok, problems: report.problems, scenarios: scenarios.length, passed: result.passed, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), before, after }
    })
    check(`[${lang}] contract report is clean, 4 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 4 && state.failed === 0, state)
    check(`[${lang}] the storm is seen in the metrics: rain, less visibility, strikes`, state.after.rain > 10 && state.after.visibility < state.before.visibility && state.after.strikes > 0, { before: state.before, after: state.after })
    check(`[${lang}] the bridges reach the room: the storm's wind goes to the effects world, the rain and wind loops open on its engine`, Math.abs(state.wind[0] - 4.5) < 1e-9 && state.wind[2] === 0 && state.loops >= 1 && state.thunder, { wind: state.wind, loops: state.loops, thunder: state.thunder })
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
