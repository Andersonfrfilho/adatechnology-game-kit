// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/stories-area.js')
const page = join(here, 'dist/sala-historias.html')
if (!existsSync(bundle)) throw new Error('dist/stories-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('stories_area')) throw new Error('the bundle does not carry the stories_area module')
for (const id of ['stories_determinism', 'stories_normal_world', 'stories_point_buy', 'fix_well', 'loadContent']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('StoriesArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-historias.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the six scenarios pass, the bench runs the days
// and loads the zombiada slice as a game's content.
const require = createRequire(import.meta.url)
const playwright = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright || !existsSync(page)) {
  console.log('skipped the browser check (no playwright or no room page)')
} else {
  const slice = join(here, '../../specs/001-migracao-entregas-dos-times/game-slice/stories')
  const read = (file) => JSON.parse(readFileSync(join(slice, file), 'utf8'))
  const content = existsSync(slice) ? { people: read('cast.json'), stories: [...read('stories.json'), read('roles.json')], life: read('life.json'), actions: read('actions.json').map((a) => ({ id: a.id, name: a.name })), playerBase: 'jogador', days: 90 } : null
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
    await tab.route(/^https?:/, (route) => route.abort())
    tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}`, { timeout: 180000 })
    await tab.waitForFunction(() => window.__storiesReport, null, { timeout: 90000 })
    const state = await tab.evaluate(async (content) => {
      const room = window.__testRoom
      const report = window.__storiesReport
      const scenarios = room.scenarios.filter((s) => s.id.startsWith('stories_'))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('stories_area')
      bench.set('day', 25)
      for (let i = 0; i < 5; i++) room.update(1 / 30)
      const day = room.metrics().module
      let slice = null
      if (content) {
        window.StoriesArea.loadContent(content)
        bench.set('day', 90)
        for (let i = 0; i < 5; i++) room.update(1 / 30)
        slice = room.metrics().module
      }
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), day, slice }
    }, content)
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `stories-${lang}.png`) })
    check(`[${lang}] contract report is clean, 6 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 6 && state.failed === 0, state)
    check(`[${lang}] the day slider runs the world to day 25`, state.day.current_day === 25 && state.day.lines > 0, state.day)
    if (content) check(`[${lang}] the zombiada slice loads and runs its 90 days`, state.slice.current_day === 90 && state.slice.lines > 40, state.slice)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
