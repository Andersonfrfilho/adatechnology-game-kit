// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/crowd-area.js')
const page = join(here, 'dist/sala-multidao.html')
if (!existsSync(bundle)) throw new Error('dist/crowd-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('crowd_area')) throw new Error('the bundle does not carry the crowd_area module')
for (const id of ['crowd_relevance', 'crowd_attack_pose', 'crowd_infection', 'blood_hit', 'runner_groan', 'Crowd area']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('CrowdArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-multidao.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the nine scenarios pass and the bench drives the crowd.
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
    await tab.route(/^https?:/, (route) => route.abort())
    tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}`)
    await tab.waitForFunction(() => window.__crowdReport, null, { timeout: 90000 })
    const drawn = await tab.evaluate(() => {
      const room = window.__testRoom
      room.bench('crowd_area').act('herd')
      for (let i = 0; i < 90; i++) room.update(1 / 30)
      return room.metrics().module
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `crowd-${lang}.png`) })
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__crowdReport
      const scenarios = room.scenarios.filter((s) => s.id.startsWith('crowd_'))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('crowd_area')
      bench.act('hit')
      for (let i = 0; i < 5; i++) room.update(1 / 30)
      const hit = room.metrics().module
      bench.set('count', 1000)
      for (let i = 0; i < 10; i++) room.update(1 / 30)
      const big = room.metrics().module
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), hit, big }
    })
    check(`[${lang}] contract report is clean, 9 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 9 && state.failed === 0, state)
    check(`[${lang}] 300 agents drawn at the three levels, at most one draw call per variant and level`, drawn.agents === 300 && drawn.drawn > 0 && drawn.lod_near > 0 && drawn.lod_far > 0 && drawn.draw_calls > 0 && drawn.draw_calls <= 66 && drawn.bake_ms > 0, drawn)
    check(`[${lang}] a headshot leaves a body on the ground`, state.hit.kills >= 1 && state.hit.bodies >= 1, state.hit)
    check(`[${lang}] the bench grows the crowd to 1000`, state.big.agents === 1000, state.big)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
