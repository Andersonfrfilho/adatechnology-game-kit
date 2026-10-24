// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/player-area.js')
const page = join(here, 'dist/sala-jogador.html')
if (!existsSync(bundle)) throw new Error('dist/player-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('player_area')) throw new Error('the bundle does not carry the player_area module')
for (const id of ['grab_break_free', 'normal_world', 'infection_kills', 'Curativo feito']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('PlayerArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-jogador.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the six scenarios pass and the bench drives the player.
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
    await tab.waitForFunction(() => window.__playerReport, null, { timeout: 90000 })
    await tab.evaluate(() => {
      for (let i = 0; i < 30; i++) window.__testRoom.update(0.02)
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `player-${lang}.png`) })
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__playerReport
      const scenarios = room.scenarios.filter((s) => s.id.startsWith('player_'))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('player_area')
      bench.act('hurt')
      bench.act('bite')
      for (let i = 0; i < 30; i++) room.update(1 / 30)
      const hurt = room.metrics().module
      bench.act('grab')
      for (let i = 0; i < 6; i++) {
        bench.act('push')
        room.update(1 / 30)
        room.update(1 / 30)
      }
      const free = room.metrics().module
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), hurt, free }
    })
    check(`[${lang}] contract report is clean, 6 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 6 && state.failed === 0, state)
    check(`[${lang}] the bench hurts and bites: health drops, the wound bleeds`, state.hurt.health < 70 && state.hurt.wounds === 2, state.hurt)
    check(`[${lang}] six pushes break the grab`, state.free.grab_timer === 0, state.free)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
