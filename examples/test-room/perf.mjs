// Explosion frame budget of the test room: opens dist/test-room.html?area=vfx, lets the room's own loop run (real frames, real renders) and fires every explosive of the
// arsenal, first one at a time (cold), then again (warm), then all of them at once with a burst of grenades (storm), and checks the budget below in every phase.
//   node perf.mjs                      counters only (CI, software GL): shaders compiled after load, GPU buffers created per warm explosion, draw calls back to idle
//   PERF_MODE=gpu node perf.mjs        also frame times and long tasks (a machine with a real GPU; on a PRIME laptop run it with the NVIDIA offload env, see README)
//   PERF_CHROME=/usr/bin/google-chrome-stable   a Chrome to drive instead of Playwright's Chromium
//   PERF_PROFILE=cold_molotov          also saves dist/perf-<phase>.cpuprofile of that phase (open it in Chrome DevTools)
// Writes dist/perf.json with every phase. Exit code 1 when any budget fails.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const EXPLOSIVES = ['frag_grenade', 'molotov', 'pipe_bomb', 'm79', 'rpg_7', 'at4', 'dynamite', 'c4', 'claymore']
const GPU_MODE = process.env.PERF_MODE === 'gpu'
// A hitch is a frame that misses two 60 Hz refreshes; a long task blocks input for more than 50 ms.
const BUDGET = {
  hitchMs: 33.4,
  p99Ms: 20,
  maxLongTaskMs: 50,
  programsAfterLoad: 0,
  buffersPerWarmExplosion: Number(process.env.PERF_BUFFERS_PER_EXPLOSION ?? 40),
  drawGrowthAfterStorm: 1.1,
}
const DRAW_MS = 1500
const SETTLE_TIMEOUT_MS = GPU_MODE ? 20000 : 120000

function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* try the next one */
    }
  }
  throw new Error('playwright not found (set NODE_PATH or install it)')
}

const dist = join(here, 'dist/test-room.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
const outDir = join(here, 'dist')
mkdirSync(outDir, { recursive: true })

const SOFTWARE_GL = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']
const REAL_GL = ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-sandbox']
const { chromium } = loadPlaywright()
const browser = await chromium.launch({
  args: GPU_MODE ? REAL_GL : SOFTWARE_GL,
  ...(process.env.PERF_CHROME ? { executablePath: process.env.PERF_CHROME } : {}),
})
const page = await browser.newPage({ viewport: GPU_MODE ? { width: 1600, height: 900 } : { width: 960, height: 540 } })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
await page.addInitScript(countWebGlCalls)
await page.goto(`${pathToFileURL(dist).href}?area=vfx`)
await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
await page.evaluate(installFrameRecorder)
await pause(2000)

const gpu = await page.evaluate(() => {
  const gl = document.querySelector('canvas')?.getContext('webgl2')
  const info = gl?.getExtension('WEBGL_debug_renderer_info')
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
console.log(`PERF  mode=${GPU_MODE ? 'gpu' : 'counters'}  gpu=${gpu}`)

const phases = []
const idle = await phase('idle', () => pause(3000))
for (const id of EXPLOSIVES) await phase(`cold_${id}`, () => fireAndSettle([id]))
const warm = await phase('warm_all', () => fireAndSettle(EXPLOSIVES, 1200))
const storm = await phase('storm', () => fireAndSettle([...EXPLOSIVES, ...EXPLOSIVES, ...EXPLOSIVES, ...Array(20).fill('frag_grenade')], 120))
const after = await phase('after_storm', () => pause(3000))

const failures = []
const fail = (text) => failures.push(text)
for (const p of phases) {
  if (p.programs > BUDGET.programsAfterLoad) fail(`${p.name}: ${p.programs} shader programs compiled during play (budget ${BUDGET.programsAfterLoad})`)
  if (!GPU_MODE) continue
  if (p.hitches > 0) fail(`${p.name}: ${p.hitches} frames over ${BUDGET.hitchMs} ms (worst ${p.max} ms)`)
  if (p.p99 > BUDGET.p99Ms) fail(`${p.name}: p99 ${p.p99} ms (budget ${BUDGET.p99Ms} ms)`)
  if (p.worstLongTask > BUDGET.maxLongTaskMs) fail(`${p.name}: long task of ${p.worstLongTask} ms`)
}
const warmBuffers = warm.buffers / EXPLOSIVES.length
if (warmBuffers > BUDGET.buffersPerWarmExplosion) fail(`warm_all: ${warmBuffers.toFixed(0)} GPU buffers created per explosion (budget ${BUDGET.buffersPerWarmExplosion})`)
if (after.drawsPerFrame > idle.drawsPerFrame * BUDGET.drawGrowthAfterStorm) fail(`after_storm: ${after.drawsPerFrame} draws per frame, idle was ${idle.drawsPerFrame}: the explosions left drawn things behind`)
if (pageErrors.length > 0) fail(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`)

writeFileSync(join(outDir, 'perf.json'), JSON.stringify({ mode: GPU_MODE ? 'gpu' : 'counters', gpu, budget: BUDGET, phases, storm: storm.name, failures }, null, 1))
for (const text of failures) console.log(`FAIL  ${text}`)
console.log(failures.length === 0 ? 'PERF  every budget holds' : `PERF  ${failures.length} budget(s) broken`)
await browser.close()
process.exit(failures.length === 0 ? 0 : 1)

function pause(ms) {
  return page.evaluate((delay) => new Promise((resolve) => setTimeout(resolve, delay)), ms)
}

async function fireAndSettle(ids, gapMs = 0) {
  for (const id of ids) {
    // a player draws the weapon in real time; waitUntilReady would simulate the draw inside one task and stall the page like no player does
    await page.evaluate((weapon) => window.__testRoom.equip(weapon), id)
    await pause(DRAW_MS)
    const fired = await page.evaluate((weapon) => {
      const room = window.__testRoom
      room.look([0, 1.6, 4], [0, 0.5, -4])
      room.use()
      return room.tool?.id ?? weapon
    }, id)
    if (fired !== id) pageErrors.push(`could not fire ${id} (holding ${fired})`)
    if (gapMs > 0) await pause(gapMs)
  }
  // charges set down wait for their trigger: Y sets off the remote ones, and the player walks through the trip wire of the claymore
  await page.keyboard.press('KeyY')
  if (ids.includes('claymore')) await page.evaluate(() => window.__testRoom.walk([0, 0, -6], 1.5))
  // thrown and fused explosives go off seconds after the use: wait for the blast before waiting for it to end
  await page.waitForFunction(effectsAreOn, null, { timeout: SETTLE_TIMEOUT_MS, polling: 50 }).catch(() => pageErrors.push(`no blast after ${ids.join(', ')}`))
  await page.waitForFunction(effectsAreOver, null, { timeout: SETTLE_TIMEOUT_MS, polling: 250 }).catch(() => undefined)
  await pause(500)
}

async function phase(name, run) {
  const before = await page.evaluate(() => window.__perf.mark())
  const profiler = process.env.PERF_PROFILE === name ? await page.context().newCDPSession(page) : undefined
  if (profiler) await profiler.send('Profiler.enable').then(() => profiler.send('Profiler.setSamplingInterval', { interval: 100 })).then(() => profiler.send('Profiler.start'))
  await run()
  if (profiler) writeFileSync(join(outDir, `perf-${name}.cpuprofile`), JSON.stringify((await profiler.send('Profiler.stop')).profile))
  const result = await page.evaluate(([label, start]) => window.__perf.read(label, start), [name, before])
  phases.push(result)
  console.log(`PHASE ${JSON.stringify(result)}`)
  return result
}

// --- in the page ---

function countWebGlCalls() {
  const counts = { programs: 0, buffers: 0, draws: 0 }
  window.__glCounts = counts
  for (const Context of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const proto = Context.prototype
    const wrap = (name, key) => {
      const original = proto[name]
      if (!original) return
      proto[name] = function (...args) {
        counts[key]++
        return original.apply(this, args)
      }
    }
    wrap('linkProgram', 'programs')
    wrap('createBuffer', 'buffers')
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) wrap(name, 'draws')
  }
}

function installFrameRecorder() {
  const frames = []
  const longTasks = []
  let last = performance.now()
  const tick = (now) => {
    frames.push(now - last)
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  const slowFrames = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration)
  }).observe({ type: 'longtask' })
  // what ran in each frame over budget, so a failure names its culprit
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration <= 33.4) continue
      const scripts = (entry.scripts ?? []).map((script) => `${script.sourceFunctionName || script.invoker}@${script.sourceCharPosition} ${Math.round(script.duration)}ms`)
      slowFrames.push({ at: frames.length, ms: Math.round(entry.duration), render: Math.round(entry.renderStart ? entry.startTime + entry.duration - entry.renderStart : 0), scripts })
    }
  }).observe({ type: 'long-animation-frame' })
  window.__perf = {
    mark: () => ({ ...window.__glCounts, frame: frames.length, longTask: longTasks.length, slowFrame: slowFrames.length }),
    read(name, start) {
      const counts = window.__glCounts
      const slice = frames.slice(start.frame + 2).sort((a, b) => a - b)
      const at = (q) => slice[Math.min(slice.length - 1, Math.floor(slice.length * q))] ?? 0
      const round = (value) => Math.round(value * 10) / 10
      const frameCount = Math.max(1, frames.length - start.frame)
      return {
        name,
        frames: slice.length,
        p50: round(at(0.5)),
        p95: round(at(0.95)),
        p99: round(at(0.99)),
        max: round(slice.at(-1) ?? 0),
        hitches: slice.filter((ms) => ms > 33.4).length,
        worstLongTask: Math.round(Math.max(0, ...longTasks.slice(start.longTask))),
        programs: counts.programs - start.programs,
        buffers: counts.buffers - start.buffers,
        drawsPerFrame: Math.round((counts.draws - start.draws) / frameCount),
        slowFrames: slowFrames.slice(start.slowFrame).slice(0, 5),
      }
    },
  }
}

function effectsAreOn() {
  return (window.__testRoom.metrics().room.particles ?? 0) > 0
}

function effectsAreOver() {
  const metrics = window.__testRoom.metrics().room
  return (metrics.particles ?? 0) === 0 && (metrics.fragments ?? 0) === 0
}
