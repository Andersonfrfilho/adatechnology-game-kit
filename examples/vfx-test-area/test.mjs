// End-to-end test of dist/sala-efeitos.html (the shared test room with the effects area loaded) with Playwright (Chromium, software GL), file:// with the
// network blocked: the bench declaration, the sheet, the scenarios and a screenshot of a blast. Without the room page it only checks the bundle.
// Run: node build.mjs && node test.mjs   (Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH, e.g. /opt/pw-browsers)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/vfx-area.js')
const dist = join(here, 'dist/sala-efeitos.html')
if (!existsSync(bundle)) throw new Error('dist/vfx-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
for (const id of ['auto_repeat', 'lod_band', 'budget_particles', 'show_']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry the bench entry "${id}"`)
}
if (!existsSync(dist)) {
  console.log('ok: bundle (no room page: build examples/test-room first)')
  process.exit(0)
}
if (!readFileSync(dist, 'utf8').includes('VfxArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-efeitos.html does not boot the area')

const require = createRequire(import.meta.url)
const { chromium } = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {}
if (!chromium) {
  console.log('ok: bundle and room page (playwright not found: browser checks skipped)')
  process.exit(0)
}
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const results = []
const check = (name, ok, detail) => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const external = []
const errors = []
async function open(query = '') {
  const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (/^(file|data|blob|about):/.test(url)) return route.continue()
    external.push(url)
    return route.abort()
  })
  const page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(pathToFileURL(dist).href + query, { timeout: 180000 })
  await page.waitForFunction(() => window.__vfxReport, null, { timeout: 90000 })
  return page
}

for (const lang of ['pt-BR', 'en']) {
  const page = await open(`?lang=${lang}`)
  const bench = await page.evaluate(() => {
    const r = window.__vfxReport
    const b = window.__testRoom.bench('vfx')
    return { ok: r.ok, problems: r.problems, controls: b ? b.controls().map((c) => c.id) : [], layers: b ? b.layers().length : 0 }
  })
  check(`[${lang}] module loaded, bench declared (7 controls, 6 layers)`, bench.ok && bench.problems.length === 0 && bench.controls.length === 7 && bench.layers === 6, bench)

  const report = await page.evaluate(async () => {
    const room = window.__testRoom
    const rep = await room.runScenarios(room.scenarios.filter((s) => s.id.startsWith('vfx_')))
    return { passed: rep.passed, failed: rep.failed, bad: rep.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`) }
  })
  check(`[${lang}] every effects scenario is green`, report.failed === 0 && report.passed >= 3, report)

  if (lang === 'pt-BR') {
    await page.evaluate(() => {
      const room = window.__testRoom
      room.clear()
      room.bench('vfx').set('distance', 12)
      room.bench('vfx').set('effect', 'm67')
      for (let i = 0; i < 25; i++) room.update(0.02)
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(shots, '01-grenade.png') })
    await page.evaluate(() => {
      const room = window.__testRoom
      room.clear()
      room.look([2.5, 1.6, 4], [0, 1, 0])
      room.bench('vfx').set('effect', 'blood_hit')
      for (let i = 0; i < 12; i++) room.update(0.02)
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(shots, '02-blood.png') })
  }
  await page.close()
}
check('no request left the page', external.length === 0, external.slice(0, 3))
check('no console error', errors.length === 0, errors.slice(0, 3))
await browser.close()
if (results.includes(false)) process.exit(1)
