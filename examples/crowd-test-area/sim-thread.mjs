// The horde in the simulation thread (spec 009, T22), in the real room: the page served cross-origin isolated (COOP/COEP, as Electron always
// is), the same horde with the step on this thread and with `?sim=thread`, the main-thread cost of the crowd's fixed step in each, the
// thread's own step time, and a print of each. `node examples/crowd-test-area/sim-thread.mjs [count]` after `node build.mjs`.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const page = join(here, 'dist/sala-multidao.html')
if (!existsSync(page)) throw new Error('dist/sala-multidao.html missing: run node build.mjs')
const require = createRequire(import.meta.url)
const playwright = /** @type {typeof import('playwright')} */ (['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean))
if (!playwright) throw new Error('no playwright')
const count = Number(process.argv[2] ?? 1500)
const FRAMES = Number(process.env.FRAMES ?? 40)
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const html = readFileSync(page)
// localhost is a trustworthy origin: Chromium honours COOP/COEP on it (not on another http host), and the route answers without a server
const ORIGIN = 'http://localhost:4987'
const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
let failed = 0
const check = (/** @type {string} */ name, /** @type {boolean} */ ok, /** @type {unknown} */ detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(detail)}`)
}
const errors = /** @type {string[]} */ ([])

/** @param {'main' | 'thread'} mode */
const run = async (mode) => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
  const tab = await context.newPage()
  await tab.route(/^https?:/, (route) =>
    route.request().url().startsWith(ORIGIN)
      ? route.fulfill({ status: 200, body: html, headers: { 'content-type': 'text/html; charset=utf-8', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } })
      : route.abort(),
  )
  tab.on('console', (m) => m.type() === 'error' && errors.push(`${mode}: ${m.text()}`))
  tab.on('pageerror', (e) => errors.push(`${mode}: pageerror: ${e.message}`))
  await tab.goto(`${ORIGIN}/sala-multidao.html?lang=pt-BR${mode === 'thread' ? '&sim=thread' : ''}`, { timeout: 180000 })
  await tab.waitForFunction(() => window.__crowdReport, null, { timeout: 120000 })
  const result = await tab.evaluate(
    async ({ count, frames, mode }) => {
      const room = window.__testRoom
      const bench = room.bench('crowd_area')
      if (!bench) throw new Error('no crowd_area bench')
      bench.set('count', count)
      // the first frames make the drawing and start the thread; then the measured ones, paced as the game's
      for (let i = 0; i < 3; i++) room.update(1 / 60)
      const g = /** @type {{ __hordeThread?: import('@adatechnology/game-workers').SimThread, __hordeThreadError?: string, __hordeThreadStart?: number, crossOriginIsolated?: boolean }} */ (/** @type {unknown} */ (window))
      if (g.__hordeThread) await Promise.race([g.__hordeThread.ready, new Promise((r) => setTimeout(r, 30000))])
      bench.set('count', count) // the measured window starts after the start-up frames
      const started = performance.now()
      for (let i = 0; i < frames; i++) {
        room.update(1 / 60)
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      const seconds = (performance.now() - started) / 1000
      const metrics = /** @type {Record<string, number>} */ (room.metrics().module)
      const stats = g.__hordeThread?.stats() ?? null
      const latest = g.__hordeThread?.latest() ?? null
      const snapshotAgents = latest ? new Int32Array(latest.buffer, latest.byteOffset, 1)[0] : null
      const note = document.createElement('pre')
      note.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;margin:0;padding:10px 12px;background:rgba(0,0,0,.78);color:#e8f5e9;font:13px/1.45 monospace;border-radius:6px'
      note.textContent =
        `${mode === 'thread' ? 'horda na thread de simulação (?sim=thread)' : 'horda nesta thread (modelo atual)'}: ${metrics.agents} agentes, cross-origin isolated ${g.crossOriginIsolated}\n` +
        `passo da multidão nesta thread: média ${(metrics.crowd_ms_mean ?? NaN).toFixed(2)} ms, p99 ${(metrics.crowd_ms_p99 ?? NaN).toFixed(2)} ms\n` +
        (stats ? `thread de simulação: ${stats.steps} passos em ${seconds.toFixed(1)} s, média ${stats.meanStepMs.toFixed(2)} ms/passo, máx ${stats.maxStepMs.toFixed(2)} ms, ${stats.dropped} atrasos descartados` : g.__hordeThreadError ? `thread: ${g.__hordeThreadError}` : '')
      document.body.appendChild(note)
      return { agents: metrics.agents, started: g.__hordeThreadStart ?? null, snapshotAgents, mean: metrics.crowd_ms_mean, p99: metrics.crowd_ms_p99, isolated: g.crossOriginIsolated, stats, seconds, error: g.__hordeThreadError ?? null }
    },
    { count, frames: FRAMES, mode },
  )
  await tab.waitForTimeout(200)
  await tab.screenshot({ path: join(shots, `crowd-sim-${mode}.png`), timeout: 120000 })
  await context.close()
  return result
}

const main = await run('main')
const thread = await run('thread')
console.log(JSON.stringify({ count, frames: FRAMES, main, thread }))
check('the page is cross-origin isolated', thread.isolated === true, thread.isolated)
check('the horde runs in the simulation thread and steps on its own clock', thread.stats !== null && thread.stats.steps > FRAMES && thread.error === null, { stats: thread.stats, error: thread.error })
// the thread steps in real time while software GL draws a frame in seconds here: by the end it has simulated a minute of the horde on a
// player who never dies, and some agents were crushed; the page draws whatever the newest snapshot holds
check(`the thread starts from the page's ${count} agents and the page draws the snapshot's`, thread.started === count && main.agents === count && thread.agents <= count && thread.snapshotAgents !== null && Math.abs(thread.agents - thread.snapshotAgents) <= count * 0.05, { main: main.agents, started: thread.started, drawn: thread.agents, snapshot: thread.snapshotAgents })
check("the crowd's step costs this thread less with the simulation thread", thread.mean < main.mean, { main: main.mean, thread: thread.mean })
check('no console errors', errors.length === 0, errors.slice(0, 3))
await browser.close()
if (failed) process.exit(1)
