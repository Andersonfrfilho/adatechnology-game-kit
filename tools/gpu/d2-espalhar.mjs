// SPIKE D2 (spec 018, throwaway): measures "spread the M67 explosion over frames" in the room. Not a gate; nothing here goes to main.
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock env D2_SERIES=<name> D2_PAGE=<page.html> D2_OUT=<json> node tools/gpu/d2-espalhar.mjs
// Series (D2_SERIES), each a list of variants run in alternating pairs over D2_ROUNDS rounds, one fresh page per variant per round:
//   m1        the ruler's own code path (`inPage`, FRAME_PARTS) on the page D2_PAGE: f0 and the 7 frames after, split by module
//   m2        the probe page, unsliced, timing on: rays, wave, events by phase, the renderer's apply by phase
//   m3        frames right after an unsliced blast, normal (`sim`) against skipped simulation (`skip`, `simulate:false`)
//   m4        slicing K in D2_KS: `pause` (simulate:false while unfinished), `freeze` (fixed ticks skipped, late phase runs), `nopause`
//   hash      the same slicings and the unsliced run, ending after 60 simulated ticks, with the hashes of world.serialize() and of the events
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus, loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assertGpuIsHardware, readGpuIdentity } from './gpu-info.mjs'
import { FRAME_EXTRAS, FRAME_LABELS, LABELLED_QUEUES, STAGE_LABELS, SYSTEM_LABELS, VARIANTS, DEFAULT_VARIANT, inPage } from './room-explosion.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const store = join(root, 'node_modules/.pnpm')
const playwrightPath = (() => {
  const entry = readdirSync(store).find((name) => name.startsWith('playwright-core@'))
  return entry ? join(store, entry, 'node_modules/playwright-core') : 'playwright-core'
})()
const playwright = require(playwrightPath)
const hasNvidia = spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0
Object.assign(process.env, hasNvidia ? { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } : {})
const chrome = existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined

const series = process.env.D2_SERIES ?? 'm2'
const pageFile = resolve(process.env.D2_PAGE ?? join(root, 'examples/test-room/dist/test-room.html'))
const out = process.env.D2_OUT
const rounds = Number(process.env.D2_ROUNDS ?? 3)
const explosive = process.env.D2_EXPLOSIVE ?? 'm67'
const frames = Number(process.env.D2_FRAMES ?? 30)
const ks = (process.env.D2_KS ?? '32,64,128').split(',').map(Number)
const QUIET = Number(process.env.D2_QUIET_LOAD ?? 1.5)
const MAX_WAIT_MS = Number(process.env.D2_MAX_WAIT_MS ?? 15 * 60 * 1000)

const temperatures = () => {
  const cpu = []
  try {
    for (const zone of readdirSync('/sys/class/thermal')) {
      if (!zone.startsWith('thermal_zone')) continue
      const value = Number(readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8')) / 1000
      if (Number.isFinite(value)) cpu.push(value)
    }
  } catch { /* no sensors */ }
  const gpu = spawnSync('nvidia-smi', ['--query-gpu=temperature.gpu,clocks.sm', '--format=csv,noheader,nounits'], { encoding: 'utf8' }).stdout?.trim()
  return { cpuMaxC: cpu.length ? Math.max(...cpu) : null, gpu }
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const waitForQuiet = async () => {
  const started = Date.now()
  while (loadavg()[0] >= QUIET && Date.now() - started < MAX_WAIT_MS) await sleep(5000)
  return { waitedMs: Date.now() - started, load1: Math.round(loadavg()[0] * 100) / 100, isQuiet: loadavg()[0] < QUIET }
}

/** Runs inside the page: one blast and the frames after it. Self-contained (serialised by Playwright). */
export async function d2Run(job) {
  const room = window.__testRoom
  const spot = window.__roomExplosion.spot
  const d2 = window.__d2
  const dt = 1 / 60
  const wait = (ms) => new Promise((done) => setTimeout(done, ms))
  const gl = room.webgl.getContext()
  const world = room.world
  const renderer = room.renderer
  if (d2) {
    d2.raysPerSlice = job.k ?? undefined
    d2.isTiming = Boolean(job.isTiming)
    d2.eventsByPhase = {}
    d2.rayMs = []
    d2.rayEvents = []
    d2.setupMs = 0
    d2.fragMs = 0
    d2.waveMs = 0
    d2.raysCast = 0
    d2.done = false
    d2.pending = false
    d2.phase = 'other'
  }
  // hashes of the destruction world: its serialised state and the events it emitted, in order
  let eventHash = 2166136261
  let eventCount = 0
  const fold = (text) => {
    for (let i = 0; i < text.length; i++) {
      eventHash ^= text.charCodeAt(i)
      eventHash = Math.imul(eventHash, 16777619) >>> 0
    }
  }
  if (job.isHashing) world.on('*', (event) => { eventCount++; fold(JSON.stringify(event)) })
  // the renderer's apply, by the kind of blow that made the event (fragments carry `blow: 'ballistic'`)
  const applied = { frag: { n: 0, ms: 0 }, other: { n: 0, ms: 0 }, structMs: 0, structCalls: 0, rebuildMs: 0, byType: {} }
  if (job.isApplyTimed) {
    const original = renderer.apply
    renderer.apply = function (event) {
      const started = performance.now()
      try { return original.call(this, event) } finally {
        const spent = performance.now() - started
        const key = event.blow === 'ballistic' ? 'frag' : 'other'
        applied[key].n++
        applied[key].ms += spent
        const typed = (applied.byType[`${key}:${event.type}`] ??= { n: 0, ms: 0 })
        typed.n++
        typed.ms += spent
      }
    }
    const structural = renderer.applyStructuralEvents
    renderer.applyStructuralEvents = function () {
      const started = performance.now()
      try { return structural.call(this) } finally {
        applied.structMs += performance.now() - started
        applied.structCalls++
      }
    }
    const rebuild = renderer.visuals?.rebuildHost
    if (rebuild) renderer.visuals.rebuildHost = function (...args) {
      const started = performance.now()
      try { return rebuild.apply(this, args) } finally { applied.rebuildMs += performance.now() - started }
    }
  }
  const rows = []
  const snapshotApplied = () => JSON.parse(JSON.stringify(applied))
  let simulatedTicks = 0
  let doneFrame = null
  const frame = async (options = {}) => {
    const appliedBefore = job.isApplyTimed ? snapshotApplied() : undefined
    const started = performance.now()
    if (options.fire) options.fire()
    const afterFire = performance.now()
    let advanceMs = 0
    let finished = true
    if (options.fire) finished = !(d2?.pending)
    else if (options.advance && d2?.pending) {
      const advanceStart = performance.now()
      finished = d2.advance(options.advance)
      advanceMs = performance.now() - advanceStart
    }
    if (finished && doneFrame === null && d2 && d2.raysPerSlice) doneFrame = rows.length
    const isFrozen = options.freeze === 'simulate' || (options.freezeWhenPending && !finished)
    const mode = options.freeze === 'simulate' ? 'simulate' : options.freezeWhenPending && !finished ? options.freezeWhenPending : 'normal'
    const roomOptions = { frameStartMs: started }
    if (mode === 'simulate') roomOptions.simulate = false
    else if (mode === 'freezeFixed') roomOptions.freezeFixed = true
    const updateStart = performance.now()
    room.update(dt, roomOptions)
    const now = performance.now()
    if (mode === 'normal') simulatedTicks++
    const updateMs = now - started
    const renderStart = performance.now()
    const restoreCamera = room.applyCamera?.()
    try { room.webgl.render(room.scene, room.camera) } finally { restoreCamera?.() }
    const renderCpu = performance.now() - renderStart
    gl.finish?.()
    const gpuWait = performance.now() - renderStart - renderCpu
    const row = { frame: rows.length, mode, updateMs, renderCpu, gpuWait, totalMs: updateMs + renderCpu, fireMs: afterFire - started, advanceMs, roomUpdateMs: now - updateStart, fragments: room.renderer.fragments?.count ?? 0, pieces: room.renderer.pieceSys.list?.length ?? 0 }
    if (appliedBefore) {
      row.appliedFragN = applied.frag.n - appliedBefore.frag.n
      row.appliedFragMs = applied.frag.ms - appliedBefore.frag.ms
      row.appliedOtherN = applied.other.n - appliedBefore.other.n
      row.appliedOtherMs = applied.other.ms - appliedBefore.other.ms
      row.structMs = applied.structMs - appliedBefore.structMs
      row.rebuildMs = applied.rebuildMs - appliedBefore.rebuildMs
    }
    rows.push(row)
    await wait(Math.max(0, 1000 / 60 - (performance.now() - started)))
    return row
  }
  const blast = () => {
    if (!room.blastAt(job.explosive, spot)) throw new Error(`room.blastAt did not detonate ${job.explosive}`)
  }
  const opts = (index) => {
    if (job.plan === 'skip') return index === 0 ? {} : { freeze: 'simulate' }
    if (job.plan === 'sliced') return job.freezeKind ? { advance: job.k, freezeWhenPending: job.freezeKind } : { advance: job.k }
    return {}
  }
  await frame({ ...opts(0), fire: blast })
  const limit = job.isHashing ? 400 : job.frames
  for (let index = 1; index < limit; index++) {
    if (!job.isHashing && index >= job.frames && !(d2?.pending)) break
    if (job.isHashing && simulatedTicks >= 60 && !(d2?.pending)) break
    await frame(opts(index))
  }
  const result = { rows, doneFrame, simulatedTicks, eventCount, eventHash }
  if (d2) result.probe = { eventsByPhase: d2.eventsByPhase, rayMs: d2.rayMs, rayEvents: d2.rayEvents, setupMs: d2.setupMs, fragMs: d2.fragMs, waveMs: d2.waveMs, raysCast: d2.raysCast }
  if (job.isApplyTimed) result.applied = applied
  if (job.isHashing) {
    const text = JSON.stringify(world.serialize())
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    result.stateHash = hash
    result.stateBytes = text.length
  }
  return result
}

const variantsOf = () => {
  if (series === 'm1') return [{ name: 'main-ruler', job: { ruler: true } }]
  if (series === 'm2') return [{ name: 'unsliced-probe', job: { plan: 'plain', isTiming: true, isApplyTimed: true } }]
  if (series === 'm3') return [{ name: 'sim', job: { plan: 'plain', isApplyTimed: true } }, { name: 'skip', job: { plan: 'skip', isApplyTimed: true } }]
  const sliced = (isHashing) => [
    ...ks.flatMap((k) => [
      { name: `pause-simulate-k${k}`, job: { plan: 'sliced', k, freezeKind: 'simulate', isTiming: true, isHashing } },
      { name: `freeze-fixed-k${k}`, job: { plan: 'sliced', k, freezeKind: 'freezeFixed', isTiming: true, isHashing } },
      { name: `nopause-k${k}`, job: { plan: 'sliced', k, isTiming: true, isHashing } },
    ]),
  ]
  if (series === 'm4') return [{ name: 'unsliced', job: { plan: 'plain', isTiming: true } }, ...sliced(false)]
  if (series === 'hash') return [{ name: 'unsliced-a', job: { plan: 'plain', isHashing: true } }, { name: 'unsliced-b', job: { plan: 'plain', isHashing: true } }, ...sliced(true)]
  throw new Error(`unknown D2_SERIES ${series}`)
}

const browser = await playwright.chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'], ...(chrome ? { executablePath: chrome } : {}) })
const probePage = await browser.newPage()
const identity = await readGpuIdentity(probePage)
await probePage.close()
assertGpuIsHardware(identity)
const machine = { cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length, chrome: browser.version(), gpu: identity }
console.log(`d2: series ${series}, page ${pageFile}, GPU ${identity.renderer}`)

const pageUrl = pathToFileURL(pageFile).href
const variants = variantsOf()
const results = []
const runOne = async (variant, round) => {
  const quiet = await waitForQuiet()
  const before = temperatures()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.addInitScript(() => {
      window.__d2 = { eventsByPhase: {}, rayMs: [], rayEvents: [], setupMs: 0, fragMs: 0, waveMs: 0, raysCast: 0, done: false, pending: false }
    })
    await page.goto(`${pageUrl}?area=floorplan${VARIANTS[DEFAULT_VARIANT]}`, { timeout: 180000 })
    await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
    await page.evaluate(inPage, { stage: 'prepare', weather: 'none' })
    const load = loadavg()[0]
    let data
    if (variant.job.ruler) {
      const timings = await page.evaluate(inPage, { stage: 'run', kind: 'blast', frames, frameSeconds: 1 / 60, budgetMode: 'deadline', explosive, isRendered: true, systemLabels: { ...SYSTEM_LABELS }, labelledQueues: LABELLED_QUEUES, stageLabels: [...STAGE_LABELS], frameLabels: [...FRAME_LABELS], paceMs: 1000 / 60 })
      const moduleIds = await page.evaluate(() => window.__roomExplosionModules ?? [], undefined)
      data = { timings, moduleIds }
    } else {
      data = await page.evaluate(d2Run, { ...variant.job, explosive, frames })
    }
    const after = temperatures()
    return { series, variant: variant.name, round, quiet, load, errors, temperatureBefore: before, temperatureAfter: after, ...data }
  } finally {
    await page.close()
  }
}
for (let round = 1; round <= rounds; round++) {
  // alternate the order of the variants every round (pairs in the same session)
  const order = round % 2 === 1 ? variants : [...variants].reverse()
  for (const variant of order) {
    try {
      const result = await runOne(variant, round)
      results.push(result)
      const first = result.rows?.[0]
      console.log(`d2: round ${round} ${variant.name} load ${result.load.toFixed(2)} cpu ${result.temperatureAfter.cpuMaxC}C${first ? ` f0 ${first.totalMs.toFixed(1)} ms` : ''}${result.doneFrame !== undefined && result.doneFrame !== null ? ` done@${result.doneFrame}` : ''}`)
    } catch (error) {
      results.push({ series, variant: variant.name, round, error: error instanceof Error ? error.message : String(error) })
      console.log(`d2: round ${round} ${variant.name} ERROR ${error instanceof Error ? error.message : error}`)
    }
  }
}
await browser.close()
const stamp = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() } catch { return null } })()
if (out) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), series, pageFile, head: stamp, machine, explosive, frames, ks, rounds, results }, null, 1))
  console.log(`d2: written ${out}`)
}
