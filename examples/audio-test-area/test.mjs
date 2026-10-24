// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/audio-area.js')
const page = join(here, 'dist/sala-som.html')
if (!existsSync(bundle)) throw new Error('dist/audio-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('audio_area')) throw new Error('the bundle does not carry the audio_area module')
for (const id of ['voice_storm', 'bench_ping', 'audio_probe', 'loop_pitch']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (!text.includes('rotor_blades')) throw new Error('the bundle does not carry the library loops')
if (existsSync(page) && !readFileSync(page, 'utf8').includes('AudioArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-som.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the four scenarios pass and the bench plays.
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
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
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
    await tab.waitForFunction(() => window.__audioReport, null, { timeout: 90000 })
    await tab.evaluate(() => {
      for (let i = 0; i < 60; i++) window.__testRoom.update(0.02)
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `audio-${lang}.png`) })
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__audioReport
      const scenarios = room.scenarios.filter((s) => ['panning', 'distance', 'determinism', 'limiter'].some((id) => s.id.endsWith(id)))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('audio_area')
      bench.set('sound', 'sfx_pistol')
      bench.set('distance', '40')
      bench.act('play')
      bench.set('loop', 'rotor_blades')
      bench.set('loop_level', 0.3)
      bench.act('voice_storm')
      for (let i = 0; i < 20; i++) room.update(0.02)
      const metrics = room.metrics().module
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, passed: result.passed, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), metrics }
    })
    check(`[${lang}] contract report is clean, 4 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 4 && state.failed === 0, state)
    check(`[${lang}] the bench plays: voices, a loop and the context in the metrics`, state.metrics.peak >= 1 && state.metrics.loops === 1 && typeof state.metrics.context === 'string', state.metrics)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
