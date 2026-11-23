// @ts-check
// The room's determinism proof (spec 018, D2 plan step 1): the same blast in N fresh pages must leave the destruction world in the same state at EVERY tick.
// Each run loads the floorplan page, builds the same house, fires one explosive (M67 by default) and steps `ROOM_DET_FRAMES` frames of 1/60 s in the deadline
// mode (the game's), hashing `world.serialize()` and the events after each one. The report lists the first tick where any two runs differ and which objects differ.
//   node tools/gpu/room-determinism.mjs   (takes the machine-wide measure lock itself, like perf.mjs)
//   ROOM_DET_RUNS=5  ROOM_DET_FRAMES=90  ROOM_DET_EXPLOSIVE=m67  ROOM_DET_QUERY='&groundWorker=0'  ROOM_DET_PAGE=<test-room.html>  ROOM_DET_OUT=<json>
//   ROOM_DET_PACES=0,60,100 (ms per frame, by run)  ROOM_DET_PAGE_LOOP=1 (the old path: the page's own loop runs during the prepare)
// Exit 1 when two runs differ, when fewer than 2 runs were asked, or when a run proves nothing (no blast effect, wrong settle time, loop not caught, page error).
// Browser and GPU: never in CI (CLAUDE.md §9).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { flockExists, lockDecision, rerunUnderLock, waitForQuietMachine } from './measure-lock.mjs'
import { VARIANTS, DEFAULT_VARIANT, inPage } from './room-explosion.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TICK_SECONDS = 1 / 60

/** Runs inside the page: starts the recorder (hash helpers, event counters, one row per `snap`) on `window.__determinism`. */
export async function installRecorder() {
  const hashText = (/** @type {string} */ text, /** @type {number} */ seed = 2166136261) => {
    let hash = seed
    for (let position = 0; position < text.length; position++) {
      hash ^= text.charCodeAt(position)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
  }
  const room = /** @type {any} */ (window).__testRoom
  const events = { count: 0, hash: 2166136261, kinds: /** @type {Record<string, number>} */ ({}) }
  room.world.on('*', (/** @type {any} */ event) => {
    events.count++
    events.kinds[event.type] = (events.kinds[event.type] ?? 0) + 1
    events.hash = hashText(JSON.stringify(event), events.hash)
  })
  const rows = /** @type {any[]} */ ([])
  const snap = (/** @type {number} */ frame) => {
    const snapshot = room.world.serialize()
    const objects = /** @type {Record<string, number>} */ ({})
    for (const object of snapshot.objects) objects[object.id] = hashText(JSON.stringify(object))
    rows.push({ frame, time: snapshot.time, timeHash: hashText(JSON.stringify(snapshot.time)), rngHash: hashText(JSON.stringify(snapshot.rng)), counterHash: hashText(JSON.stringify(snapshot.counter)), stateHash: hashText(JSON.stringify(snapshot)), eventCount: events.count, eventHash: events.hash, objectCount: snapshot.objects.length, objects, kinds: { ...events.kinds } })
  }
  /** @type {any} */ (window).__determinism = { rows, snap }
}

/**
 * Runs inside the page (serialised by Playwright): one blast and the frames after it, a row after each frame; `rows[0]` is the world before the blast.
 * @param {{ explosive: string, frames: number, isRendered: boolean, paceMs: number }} job
 */
export async function determinismRun(job) {
  const win = /** @type {any} */ (window)
  const room = win.__testRoom
  const { rows, snap } = win.__determinism
  const gl = job.isRendered ? room.webgl.getContext() : undefined
  snap(-1)
  for (let index = 0; index < job.frames; index++) {
    const started = performance.now()
    if (index === 0 && !room.blastAt(job.explosive, win.__roomExplosion.spot)) throw new Error(`room.blastAt did not detonate ${job.explosive}`)
    room.update(1 / 60, { frameStartMs: started })
    if (gl) {
      const restoreCamera = room.applyCamera?.()
      try { room.webgl.render(room.scene, room.camera) } finally { restoreCamera?.() }
      gl.finish?.()
    }
    snap(index)
    await new Promise((done) => setTimeout(done, Math.max(0, job.paceMs - (performance.now() - started))))
  }
  return { rows, droppedFrames: win.__droppedFrames ?? 0 }
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
  for (let tick = 0; tick < job.settleTicks; tick++) {
    room.update(1 / 60)
    if (tick % 20 === 0) await new Promise((done) => setTimeout(done, 10))
  }
  const house = room.world.serialize().objects.find((/** @type {any} */ object) => object.id === 'house3d:1')
  if (!house) throw new Error('room-determinism: house3d:1 is not in the world after the build')
  const [x = 0, , z = 0] = house.state.position
  win.__roomExplosion = { spot: [x - 2.5, 0.6, z] }
}

const COMPARED_FIELDS = ['stateHash', 'eventHash', 'eventCount', 'timeHash', 'rngHash', 'counterHash']

/** The first row where two runs differ (any hash, or a different number of rows), and the object ids that differ in it. @param {any[]} left @param {any[]} right */
export const firstDivergence = (left, right) => {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const leftRow = left[index]
    const rightRow = right[index]
    const differingFields = COMPARED_FIELDS.filter((field) => leftRow[field] !== rightRow[field])
    if (differingFields.length === 0) continue
    const ids = new Set([...Object.keys(leftRow.objects), ...Object.keys(rightRow.objects)])
    const differing = [...ids].filter((id) => leftRow.objects[id] !== rightRow.objects[id])
    return { frame: leftRow.frame, differingFields, eventCountLeft: leftRow.eventCount, eventCountRight: rightRow.eventCount, objectCountLeft: leftRow.objectCount, objectCountRight: rightRow.objectCount, differingObjects: differing.slice(0, 20), differingTotal: differing.length }
  }
  if (left.length === right.length) return undefined
  return { frame: (left[Math.min(left.length, right.length)] ?? right[Math.min(left.length, right.length)]).frame, differingFields: ['rowCount'], rowCountLeft: left.length, rowCountRight: right.length, differingObjects: [], differingTotal: 0 }
}

// time advances every tick, so the no-op check compares the objects only
const hasObjectChanged = (/** @type {any} */ first, /** @type {any} */ last) => {
  const ids = new Set([...Object.keys(first.objects), ...Object.keys(last.objects)])
  return [...ids].some((id) => first.objects[id] !== last.objects[id])
}

/** What makes one run worthless as proof: the blast did nothing, the settle time is off, the page loop was not caught, or the page threw. @param {any} result @param {{ isStubbed: boolean, expectedPreTime: number }} options */
const runProblems = (result, { isStubbed, expectedPreTime }) => {
  const problems = result.errors.map((/** @type {string} */ message) => `run ${result.run}: page error: ${message}`)
  const first = result.rows[0]
  const last = result.rows[result.rows.length - 1]
  if (!first || !last || result.rows.length < 2) return [...problems, `run ${result.run}: no rows recorded`]
  if (!hasObjectChanged(first, last)) problems.push(`run ${result.run}: no object changed between before and after the blast (no-op)`)
  if (last.eventCount === 0) problems.push(`run ${result.run}: no event fired during the blast`)
  if (!isStubbed) return problems
  if (Math.abs(first.time - expectedPreTime) > TICK_SECONDS * 1.01) problems.push(`run ${result.run}: pre-blast time ${first.time} is not the expected ${expectedPreTime} (+-1 tick)`)
  if (!(result.droppedFrames >= 1)) problems.push(`run ${result.run}: the stub dropped no requestAnimationFrame callback (the game loop was not caught)`)
  return problems
}

/**
 * The verdict of a set of runs: deterministic only when at least 2 runs ran, none is worthless as proof and every run equals run 0 at every tick.
 * @param {{ results: any[], isStubbed: boolean, expectedPreTime: number }} options
 */
export const judgeRuns = ({ results, isStubbed, expectedPreTime }) => {
  const problems = results.flatMap((result) => runProblems(result, { isStubbed, expectedPreTime }))
  if (results.length < 2) problems.push(`only ${results.length} run(s): a comparison needs at least 2`)
  const verdicts = results.slice(1).map((result) => ({ run: result.run, divergence: firstDivergence(results[0].rows, result.rows) }))
  return { isDeterministic: problems.length === 0 && verdicts.every((verdict) => verdict.divergence === undefined), problems, verdicts }
}

/** @param {string | undefined} raw @returns {number} */
export const parseRuns = (raw) => {
  const runs = Number(raw ?? 5)
  if (!Number.isInteger(runs) || runs < 2) throw new Error(`room-determinism: ROOM_DET_RUNS must be an integer of at least 2 (got ${raw})`)
  return runs
}

/** @param {any} playwright @param {boolean} isStubbed */
const launchBrowser = async (playwright, isStubbed) => {
  const hasNvidia = spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0
  Object.assign(process.env, hasNvidia ? { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } : {})
  const chrome = existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined
  return { isStubbed, browser: await playwright.chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'], ...(chrome ? { executablePath: chrome } : {}) }) }
}

// the game loop's callback takes the frame time (length 1) and is dropped (and counted); the loading screen's takes nothing and still runs
const stubRequestAnimationFrame = () => {
  const win = /** @type {any} */ (window)
  const original = window.requestAnimationFrame.bind(window)
  win.__droppedFrames = 0
  window.requestAnimationFrame = (callback) => {
    if (callback.length < 1) return original(callback)
    win.__droppedFrames++
    return 0
  }
}

/** One fresh page: prepare, blast, record. @param {any} browser @param {{ settings: any, paceMs: number, run: number }} options */
const recordRun = async (browser, { settings, paceMs, run }) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const errors = /** @type {string[]} */ ([])
  page.on('pageerror', (/** @type {Error} */ error) => errors.push(error.message))
  try {
    if (settings.isStubbed) await page.addInitScript(stubRequestAnimationFrame)
    await page.goto(`${pathToFileURL(settings.pageFile).href}?area=floorplan${settings.query}`, { timeout: 180000 })
    await page.waitForFunction(() => /** @type {any} */ (window).__testRoom, null, { timeout: 600000 })
    if (settings.isStubbed) await page.evaluate(deterministicPrepare, { settleTicks: settings.settleTicks })
    else await page.evaluate(inPage, { stage: 'prepare', weather: 'none' })
    await page.evaluate(installRecorder)
    const data = await page.evaluate(determinismRun, { explosive: settings.explosive, frames: settings.frames, isRendered: settings.isRendered, paceMs })
    return { run, paceMs, errors, ...data }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    return { run, paceMs, errors, rows: [], droppedFrames: 0 }
  } finally {
    await page.close()
  }
}

/** @param {string} name @param {string | undefined} raw @param {number} fallback @returns {number} */
export const readNonNegativeNumber = (name, raw, fallback) => {
  const value = Number(raw ?? fallback)
  if (!Number.isFinite(value) || value < 0) throw new Error(`room-determinism: ${name} must be a non-negative number (got ${raw})`)
  return value
}

const readSettings = () => {
  const settleTicks = readNonNegativeNumber('ROOM_DET_SETTLE_TICKS', process.env.ROOM_DET_SETTLE_TICKS, 600)
  return {
    runs: parseRuns(process.env.ROOM_DET_RUNS),
    frames: readNonNegativeNumber('ROOM_DET_FRAMES', process.env.ROOM_DET_FRAMES, 90),
    explosive: process.env.ROOM_DET_EXPLOSIVE ?? 'm67',
    query: process.env.ROOM_DET_QUERY ?? VARIANTS[DEFAULT_VARIANT],
    isRendered: process.env.ROOM_DET_RENDER !== '0',
    pageFile: resolve(process.env.ROOM_DET_PAGE ?? join(root, 'examples/test-room/dist/test-room.html')),
    out: process.env.ROOM_DET_OUT,
    // the frame pace of each run (ms; 0 = back to back): different paces move every wall-clock deadline of the frame budget, and the state must not notice
    paces: (process.env.ROOM_DET_PACES ?? '').split(',').filter(Boolean).map((pace) => readNonNegativeNumber('ROOM_DET_PACES', pace, 0)),
    isStubbed: process.env.ROOM_DET_PAGE_LOOP !== '1',
    settleTicks,
    maxLoad: readNonNegativeNumber('ROOM_DET_MAX_LOAD', process.env.ROOM_DET_MAX_LOAD, 1.5),
  }
}

const report = (/** @type {any} */ settings, /** @type {any[]} */ results, /** @type {ReturnType<typeof judgeRuns>} */ verdict, /** @type {boolean} */ gaveUpWaiting) => {
  for (const item of verdict.verdicts) console.log(`room-determinism: run ${item.run} vs 0: ${item.divergence ? `first divergent tick ${item.divergence.frame} (${JSON.stringify(item.divergence)})` : 'identical at every tick'}`)
  for (const problem of verdict.problems) console.log(`room-determinism: PROBLEM ${problem}`)
  if (gaveUpWaiting) console.log('room-determinism: WARNING the wait for a quiet machine gave up: the runs happened under load')
  console.log(`room-determinism: ${verdict.isDeterministic ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'} (${results.length} runs, ${settings.frames} ticks, ${settings.explosive}, ${settings.query})`)
  if (!settings.out) return
  mkdirSync(dirname(settings.out), { recursive: true })
  const table = results.map((result) => ({ run: result.run, perTickHashes: result.rows.map((/** @type {any} */ row) => row.stateHash) }))
  const pageErrors = results.flatMap((result) => result.errors.map((/** @type {string} */ message) => ({ run: result.run, message })))
  writeFileSync(settings.out, JSON.stringify({ date: new Date().toISOString(), query: settings.query, explosive: settings.explosive, frames: settings.frames, runs: results.length, isStubbed: settings.isStubbed, gaveUpWaiting, loads: results.map((result) => result.load), isDeterministic: verdict.isDeterministic, problems: verdict.problems, pageErrors, verdicts: verdict.verdicts, table, full: results }, null, 1))
}

const main = async () => {
  if (lockDecision({ env: process.env, hasFlock: flockExists() }) === 'reexec') process.exit(rerunUnderLock(fileURLToPath(import.meta.url), process.argv.slice(2)))
  const settings = readSettings()
  const require = createRequire(import.meta.url)
  const store = join(root, 'node_modules/.pnpm')
  const entry = readdirSync(store).find((name) => name.startsWith('playwright-core@'))
  const { browser } = await launchBrowser(require(entry ? join(store, entry, 'node_modules/playwright-core') : 'playwright-core'), settings.isStubbed)
  const results = []
  let gaveUpWaiting = false
  try {
    for (let run = 0; run < settings.runs; run++) {
      const quiet = await waitForQuietMachine({ label: 'room-determinism', quietLoad: settings.maxLoad })
      gaveUpWaiting ||= quiet.busy
      const paceMs = settings.paces[run % settings.paces.length] ?? 1000 / 60
      const result = { ...(await recordRun(browser, { settings, paceMs, run })), load: quiet.loadAtStart }
      results.push(result)
      const last = result.rows[result.rows.length - 1]
      console.log(`room-determinism: run ${run} load ${quiet.loadAtStart.toFixed(2)} pace ${paceMs.toFixed(1)} errors ${result.errors.length} dropped ${result.droppedFrames} pre ${result.rows[0]?.stateHash} end ${last?.stateHash} events ${last?.eventCount}`)
    }
  } finally {
    await browser.close()
  }
  const verdict = judgeRuns({ results, isStubbed: settings.isStubbed, expectedPreTime: settings.settleTicks * TICK_SECONDS })
  report(settings, results, verdict, gaveUpWaiting)
  if (!verdict.isDeterministic) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
