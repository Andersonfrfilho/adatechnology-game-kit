// @ts-check
// The room's determinism proof (spec 018, D2 plan step 1): the same blast in N fresh pages must leave the destruction world in the same state at EVERY tick.
// Each run loads the floorplan page, builds the same house, fires one explosive (M67 by default) and steps `ROOM_DET_FRAMES` frames of 1/60 s in the deadline
// mode (the game's), hashing `world.serialize()` and the events after each one. The report lists the first tick where any two runs differ and which objects differ.
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/gpu/room-determinism.mjs
//   ROOM_DET_RUNS=5  ROOM_DET_FRAMES=90  ROOM_DET_EXPLOSIVE=m67  ROOM_DET_QUERY='&groundWorker=0'  ROOM_DET_PAGE=<test-room.html>  ROOM_DET_OUT=<json>
// Exit 1 when two runs differ. Browser and GPU: never in CI (CLAUDE.md §9).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { VARIANTS, DEFAULT_VARIANT, inPage } from './room-explosion.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Runs inside the page (serialised by Playwright): one blast and the frames after it, hashing the world after each frame.
 * @param {{ explosive: string, frames: number, isRendered: boolean, paceMs: number }} job
 */
export async function determinismRun(job) {
  const win = /** @type {any} */ (window)
  const room = win.__testRoom
  const spot = win.__roomExplosion.spot
  const hashOf = (/** @type {string} */ text) => {
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
  }
  let eventCount = 0
  let eventHash = 2166136261
  const eventKinds = /** @type {Record<string, number>} */ ({})
  room.world.on('*', (/** @type {any} */ event) => {
    eventCount++
    eventKinds[event.type] = (eventKinds[event.type] ?? 0) + 1
    const text = JSON.stringify(event)
    for (let i = 0; i < text.length; i++) {
      eventHash ^= text.charCodeAt(i)
      eventHash = Math.imul(eventHash, 16777619) >>> 0
    }
  })
  const dt = 1 / 60
  const wait = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms))
  const gl = job.isRendered ? room.webgl.getContext() : undefined
  const rows = /** @type {any[]} */ ([])
  const snap = (/** @type {number} */ index) => {
    const snapshot = room.world.serialize()
    const objects = /** @type {Record<string, number>} */ ({})
    for (const object of snapshot.objects) objects[object.id] = hashOf(JSON.stringify(object))
    rows.push({ frame: index, stateHash: hashOf(JSON.stringify(snapshot)), eventCount, eventHash, objectCount: snapshot.objects.length, objects, kinds: { ...eventKinds } })
  }
  snap(-1)
  const preSnapshot = room.world.serialize()
  const pre = { time: preSnapshot.time, rng: preSnapshot.rng, counter: preSnapshot.counter, house: preSnapshot.objects.find((/** @type {any} */ object) => object.id === 'house3d:1'), obj2: preSnapshot.objects.find((/** @type {any} */ object) => object.id === 'obj_2') }
  for (let index = 0; index < job.frames; index++) {
    const started = performance.now()
    if (index === 0 && !room.blastAt(job.explosive, spot)) throw new Error(`room.blastAt did not detonate ${job.explosive}`)
    room.update(dt, { frameStartMs: started })
    if (gl) {
      const restoreCamera = room.applyCamera?.()
      try { room.webgl.render(room.scene, room.camera) } finally { restoreCamera?.() }
      gl.finish?.()
    }
    snap(index)
    await wait(Math.max(0, job.paceMs - (performance.now() - started)))
  }
  return { rows, pre }
}

/**
 * The prepare step of `inPage`, with the page's own loop never started (the caller stubs requestAnimationFrame before load): the house is built and stepped a
 * FIXED number of ticks, so how many frames the page happened to render in 8 s of wall clock no longer decides the world's `time`, rng or settled bodies.
 * @param {{ settleTicks: number }} job
 */
export async function deterministicPrepare(job) {
  const win = /** @type {any} */ (window)
  const room = win.__testRoom
  room.openArea('floorplan_area')
  const bench = room.bench('floorplan_area')
  bench.set('package', 'residential')
  bench.set('template', 'single_storey_a')
  bench.set('seed', 1)
  bench.act('build')
  const wait = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms))
  for (let tick = 0; tick < job.settleTicks; tick++) {
    room.update(1 / 60)
    if (tick % 20 === 0) await wait(10)
  }
  const house = room.world.serialize().objects.find((/** @type {any} */ object) => object.id === 'house3d:1')
  if (!house) throw new Error('room-determinism: house3d:1 is not in the world after the build')
  const [x = 0, , z = 0] = house.state.position
  win.__roomExplosion = { spot: [x - 2.5, 0.6, z] }
}

/** The first row where two runs differ, and the object ids that differ in it. @param {any[]} left @param {any[]} right */
export const firstDivergence = (left, right) => {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const a = left[index]
    const b = right[index]
    if (a.stateHash === b.stateHash && a.eventHash === b.eventHash && a.eventCount === b.eventCount) continue
    const ids = new Set([...Object.keys(a.objects), ...Object.keys(b.objects)])
    const differing = [...ids].filter((id) => a.objects[id] !== b.objects[id])
    return { frame: a.frame, eventCountA: a.eventCount, eventCountB: b.eventCount, eventHashEqual: a.eventHash === b.eventHash, objectCountA: a.objectCount, objectCountB: b.objectCount, differingObjects: differing.slice(0, 20), differingTotal: differing.length }
  }
  return undefined
}

const main = async () => {
  const runs = Number(process.env.ROOM_DET_RUNS ?? 5)
  const frames = Number(process.env.ROOM_DET_FRAMES ?? 90)
  const explosive = process.env.ROOM_DET_EXPLOSIVE ?? 'm67'
  const query = process.env.ROOM_DET_QUERY ?? VARIANTS[DEFAULT_VARIANT]
  const isRendered = process.env.ROOM_DET_RENDER !== '0'
  const pageFile = resolve(process.env.ROOM_DET_PAGE ?? join(root, 'examples/test-room/dist/test-room.html'))
  const out = process.env.ROOM_DET_OUT
  // the frame pace of each run (ms; 0 = back to back): different paces move every wall-clock deadline of the frame budget, and the state must not notice
  const paces = (process.env.ROOM_DET_PACES ?? '').split(',').filter(Boolean).map(Number)
  const isStubbed = process.env.ROOM_DET_PAGE_LOOP !== '1'
  const settleTicks = Number(process.env.ROOM_DET_SETTLE_TICKS ?? 600)
  const maxLoad = Number(process.env.ROOM_DET_MAX_LOAD ?? 1.5)
  const require = createRequire(import.meta.url)
  const store = join(root, 'node_modules/.pnpm')
  const entry = readdirSync(store).find((name) => name.startsWith('playwright-core@'))
  const playwright = require(entry ? join(store, entry, 'node_modules/playwright-core') : 'playwright-core')
  const hasNvidia = spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0
  Object.assign(process.env, hasNvidia ? { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } : {})
  const chrome = existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined
  const browser = await playwright.chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'], ...(chrome ? { executablePath: chrome } : {}) })
  const results = []
  for (let run = 0; run < runs; run++) {
    const started = Date.now()
    while (loadavg()[0] >= maxLoad && Date.now() - started < 15 * 60 * 1000) await new Promise((done) => setTimeout(done, 5000))
    const load = loadavg()[0]
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    const errors = /** @type {string[]} */ ([])
    page.on('pageerror', (/** @type {Error} */ error) => errors.push(error.message))
    try {
      // the game loop's callback takes the frame time (length 1) and is dropped; the loading screen's takes nothing and still runs
      if (isStubbed) await page.addInitScript(() => { const original = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (callback) => (callback.length >= 1 ? 0 : original(callback)) })
      await page.goto(`${pathToFileURL(pageFile).href}?area=floorplan${query}`, { timeout: 180000 })
      await page.waitForFunction(() => /** @type {any} */ (window).__testRoom, null, { timeout: 600000 })
      if (isStubbed) await page.evaluate(deterministicPrepare, { settleTicks })
      else await page.evaluate(inPage, { stage: 'prepare', weather: 'none' })
      const data = await page.evaluate(determinismRun, { explosive, frames, isRendered, paceMs: paces[run % paces.length] ?? 1000 / 60 })
      results.push({ run, load, errors, paceMs: paces[run % paces.length] ?? 1000 / 60, ...data })
      const last = data.rows[data.rows.length - 1]
      console.log(`room-determinism: run ${run} load ${load.toFixed(2)} pre ${data.rows[0].stateHash} end ${last.stateHash} events ${last.eventCount}`)
    } finally {
      await page.close()
    }
  }
  await browser.close()
  const reference = results[0]
  const verdicts = results.slice(1).map((result) => ({ run: result.run, divergence: firstDivergence(reference.rows, result.rows) }))
  const isDeterministic = verdicts.every((verdict) => verdict.divergence === undefined)
  const table = results.map((result) => ({ run: result.run, perTickHashes: result.rows.map((/** @type {any} */ row) => row.stateHash) }))
  for (const verdict of verdicts) console.log(`room-determinism: run ${verdict.run} vs 0: ${verdict.divergence ? `first divergent tick ${verdict.divergence.frame} (${JSON.stringify(verdict.divergence)})` : 'identical at every tick'}`)
  console.log(`room-determinism: ${isDeterministic ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'} (${runs} runs, ${frames} ticks, ${explosive}, ${query})`)
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), query, explosive, frames, runs, isDeterministic, verdicts, table, full: results }, null, 1))
  }
  if (!isDeterministic) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
