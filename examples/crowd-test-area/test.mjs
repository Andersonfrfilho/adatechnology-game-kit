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
const playwright = /** @type {typeof import('playwright') | undefined} */ (['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean))
if (!playwright || !existsSync(page)) {
  console.log('skipped the browser check (no playwright or no room page)')
} else {
  const shots = join(here, 'shots')
  mkdirSync(shots, { recursive: true })
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
  /**
     * @type {string[]}
     */
  const errors = []
  let failed = 0
  const check = (/** @type {string} */ name, /** @type {boolean} */ ok, /** @type {unknown} */ detail) => {
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
  for (const lang of ['pt-BR', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
    const tab = await context.newPage()
    await tab.route(/^https?:/, (route) => route.abort())
    tab.on('console', (/** @type {{ type: () => string; text: () => string; }} */ m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}`, { timeout: 180000 })
    await tab.waitForFunction(() => window.__crowdReport, null, { timeout: 90000 })
    const drawn = await tab.evaluate(() => {
      const room = window.__testRoom
      ;/** @type {RoomBench} */ (room.bench('crowd_area')).act('herd')
      for (let i = 0; i < 90; i++) room.update(1 / 30)
      return /** @type {NumericMetrics} */ (room.metrics().module)
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `crowd-${lang}.png`), timeout: 120000 }) // software GL with 300 agents is slow to settle a frame
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__crowdReport
      const scenarios = room.scenarios.filter((/** @type {{ id: string; }} */ s) => s.id.startsWith('crowd_'))
      const result = await room.runScenarios(scenarios)
      const bench = /** @type {RoomBench} */ (room.bench('crowd_area'))
      bench.act('hit')
      for (let i = 0; i < 5; i++) room.update(1 / 30)
      const hit = /** @type {NumericMetrics} */ (room.metrics().module)
      bench.set('count', 1000)
      for (let i = 0; i < 10; i++) room.update(1 / 30)
      const big = /** @type {NumericMetrics} */ (room.metrics().module)
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), hit, big }
    })
    // the horde's contact and pressure through the room's worker coordinator (CLAUDE.md §14): frames paced as the game's, so the workers answer between them
    const workers = await tab.evaluate(async () => {
      const room = window.__testRoom
      const coordinator = /** @type {import('@adatechnology/game-workers').WorkerCoordinator | undefined} */ (/** @type {{ __kitWorkers?: unknown }} */ (window).__kitWorkers)
      if (!coordinator) return null
      // the workers are up and know the room's kinds (a worker that failed to load would never answer)
      const known = await Promise.race([coordinator.warm([]).then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 30000))])
      // software GL draws a frame in seconds here: 20 steps are enough to see where each one was computed
      for (let i = 0; i < 20; i++) {
        room.update(1 / 60)
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      const stats = coordinator.stats()
      const crowd = stats.kinds.find((k) => k.id === 'crowd.physics')
      const note = document.createElement('pre')
      note.id = 'kit-workers-stats'
      note.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;margin:0;padding:10px 12px;background:rgba(0,0,0,.78);color:#e8f5e9;font:13px/1.45 monospace;border-radius:6px'
      note.textContent = crowd
        ? `game-workers: ${stats.workers} workers (sim ${stats.lanes.sim}, build ${stats.lanes.build}, background ${stats.lanes.background})\ncrowd.physics: ${crowd.submitted} steps, ${crowd.onTime} from the worker on time, ${crowd.fallback} on the main thread\nworker ${(crowd.workerMs / Math.max(1, crowd.answered)).toFixed(2)} ms/step (${crowd.answered} answers), main fallback ${(crowd.mainMs / Math.max(1, crowd.fallback)).toFixed(2)} ms/step`
        : `game-workers: ${stats.workers} workers, no crowd.physics job`
      document.body.appendChild(note)
      return { known, workers: stats.workers, crowd: crowd ?? null }
    })
    await tab.waitForTimeout(200)
    await tab.screenshot({ path: join(shots, `crowd-workers-${lang}.png`), timeout: 120000 })
    // on time needs the event loop free between frames: with software GL a frame takes a second here and every step falls back to the main thread (same result);
    // the share on time is measured on the machine with the GPU (CLAUDE.md §14), this check only proves the room's workers are up and answer
    check(`[${lang}] the room's workers are up and the horde's physics goes through them`, workers !== null && workers.known === true && workers.workers > 0 && workers.crowd !== null && workers.crowd.submitted > 0 && workers.crowd.workerMs > 0, workers)
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
