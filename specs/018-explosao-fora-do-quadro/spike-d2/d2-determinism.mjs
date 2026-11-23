// SPIKE D2 step 2 (spec 018, throwaway): same-bytes proof in the DETERMINISTIC room. Compares world.serialize() and the event stream of an unsliced blast against the sliced+frozen one
// at the SAME number of SIMULATED fixed ticks after the blast finished (frozen frames advance none): n=0 is the moment the blast is complete (before any tick), n=1.. one tick each.
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock env D2_PAGE=<page.html> D2_OUT=<json> node specs/018-explosao-fora-do-quadro/spike-d2/d2-determinism.mjs
//   D2_DET_TICKS=60  D2_DET_APPLY=256  D2_DET_K=64  D2_DET_VARIANTS=unsliced,unsliced,sliced,sliced,frozen-only
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { deterministicPrepare, firstDivergence } from '../../../tools/gpu/room-determinism.mjs'
import { VARIANTS, DEFAULT_VARIANT } from '../../../tools/gpu/room-explosion.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** In the page: one blast, then the frames; one snapshot per simulated tick since the blast finished. */
export async function detRun(job) {
  const win = window
  const room = win.__testRoom
  const spot = win.__roomExplosion.spot
  const d2 = win.__d2
  const dt = 1 / 60
  const wait = (ms) => new Promise((done) => setTimeout(done, ms))
  const gl = room.webgl.getContext()
  const hashOf = (text) => {
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
  }
  let eventCount = 0
  let eventHash = 2166136261
  room.world.on('*', (event) => {
    eventCount++
    const text = JSON.stringify(event)
    for (let i = 0; i < text.length; i++) {
      eventHash ^= text.charCodeAt(i)
      eventHash = Math.imul(eventHash, 16777619) >>> 0
    }
  })
  const rows = []
  const snap = (index) => {
    const snapshot = room.world.serialize()
    const objects = {}
    for (const object of snapshot.objects) objects[object.id] = hashOf(JSON.stringify(object))
    rows.push({ frame: index, stateHash: hashOf(JSON.stringify(snapshot)), eventCount, eventHash, objectCount: snapshot.objects.length, objects })
  }
  const render = () => {
    const restoreCamera = room.applyCamera?.()
    try { room.webgl.render(room.scene, room.camera) } finally { restoreCamera?.() }
    gl.finish?.()
  }
  const step = async (roomOptions) => {
    const started = performance.now()
    room.update(dt, { frameStartMs: started, ...roomOptions })
    render()
    await wait(Math.max(0, 1000 / 60 - (performance.now() - started)))
  }
  const isSliced = job.kind !== 'unsliced'
  // control: the whole blast and all the events in ONE frozen frame, before the first tick (the apply phase of the sliced run, with no slicing at all)
  if (job.kind === 'whole-before') { job.k = 1e9; job.apply = 1e9; job.kind = 'sliced' }
  const frozenFrames = []
  if (isSliced) {
    d2.raysPerSlice = job.k
    d2.isTiming = false
    d2.done = false
    d2.pending = false
  }
  if (!room.blastAt(job.explosive, spot)) throw new Error('blast did not detonate')
  if (!isSliced) snap(0)
  else {
    // frozen frames: the rest of the rays and the wave, then (slice variant) the held structural events a fixed count per frame; the world takes no tick
    let applyStarted = false
    let finishedFrame = -1
    for (let frame = 0; frame < 200; frame++) {
      let finished = !d2.pending
      if (!finished) finished = d2.advance(job.k)
      if (finished && finishedFrame < 0) {
        finishedFrame = frame
        snap(0)
      }
      const backlog = room.renderer.structuralBacklog?.() ?? 0
      const isSlice = job.kind === 'sliced'
      const isFrozen = !finished || (isSlice && (!applyStarted || backlog > 0))
      if (!isFrozen) break
      const options = { freezeFixed: true }
      if (isSlice) options.structuralSlice = { count: !finished || !applyStarted ? 0 : job.apply, isComplete: finished }
      await step(options)
      if (isSlice && finished) applyStarted = true
      frozenFrames.push(frame)
    }
    if (rows.length === 0) throw new Error('the sliced blast never finished')
  }
  for (let tick = 1; tick <= job.ticks; tick++) {
    await step({})
    snap(tick)
  }
  return { rows, frozenFrames: frozenFrames.length }
}

const main = async () => {
  const pageFile = resolve(process.env.D2_PAGE ?? join(root, 'examples/test-room/dist/test-room.html'))
  const out = process.env.D2_OUT
  const ticks = Number(process.env.D2_DET_TICKS ?? 60)
  const apply = Number(process.env.D2_DET_APPLY ?? 256)
  const k = Number(process.env.D2_DET_K ?? 64)
  const explosive = process.env.D2_EXPLOSIVE ?? 'm67'
  const kinds = (process.env.D2_DET_VARIANTS ?? 'unsliced,unsliced,sliced,sliced,frozen-only').split(',')
  const settleTicks = Number(process.env.D2_DET_SETTLE_TICKS ?? 600)
  const maxLoad = Number(process.env.D2_QUIET_LOAD ?? 1.5)
  const require = createRequire(import.meta.url)
  const store = join(root, 'node_modules/.pnpm')
  const entry = readdirSync(store).find((name) => name.startsWith('playwright-core@'))
  const playwright = require(entry ? join(store, entry, 'node_modules/playwright-core') : 'playwright-core')
  const hasNvidia = spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0
  Object.assign(process.env, hasNvidia ? { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } : {})
  const chrome = existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined
  const browser = await playwright.chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'], ...(chrome ? { executablePath: chrome } : {}) })
  const results = []
  for (const [index, kind] of kinds.entries()) {
    const started = Date.now()
    while (loadavg()[0] >= maxLoad && Date.now() - started < 15 * 60 * 1000) await new Promise((done) => setTimeout(done, 5000))
    const load = loadavg()[0]
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.addInitScript(() => {
        const original = window.requestAnimationFrame.bind(window)
        window.requestAnimationFrame = (callback) => (callback.length >= 1 ? 0 : original(callback))
        window.__d2 = { eventsByPhase: {}, rayMs: [], rayEvents: [], setupMs: 0, fragMs: 0, waveMs: 0, raysCast: 0, done: false, pending: false }
      })
      await page.goto(`${pathToFileURL(pageFile).href}?area=floorplan${VARIANTS[DEFAULT_VARIANT]}`, { timeout: 180000 })
      await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
      await page.evaluate(deterministicPrepare, { settleTicks })
      const data = await page.evaluate(detRun, { kind, k, apply, ticks, explosive })
      results.push({ index, kind, load, errors, ...data })
      const last = data.rows.at(-1)
      console.log(`d2-det: run ${index} ${kind} load ${load.toFixed(2)} frozen ${data.frozenFrames} n0 ${data.rows[0].stateHash}/${data.rows[0].eventCount} end ${last.stateHash} events ${last.eventCount}`)
    } finally {
      await page.close()
    }
  }
  await browser.close()
  const pairs = []
  for (let a = 0; a < results.length; a++) for (let b = a + 1; b < results.length; b++) pairs.push([a, b])
  const verdicts = pairs.map(([a, b]) => ({ a: `${a}:${results[a].kind}`, b: `${b}:${results[b].kind}`, divergence: firstDivergence(results[a].rows, results[b].rows) ?? null }))
  for (const verdict of verdicts) console.log(`d2-det: ${verdict.a} vs ${verdict.b}: ${verdict.divergence ? `first difference at n=${verdict.divergence.frame} ${JSON.stringify(verdict.divergence)}` : `identical at every n (0..${ticks})`}`)
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), pageFile, explosive, ticks, apply, k, verdicts, table: results.map((r) => ({ kind: r.kind, load: r.load, frozenFrames: r.frozenFrames, hashes: r.rows.map((row) => [row.stateHash, row.eventCount, row.eventHash]) })), full: results }, null, 1))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
