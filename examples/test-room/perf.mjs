// Explosion frame budget of the test room: opens dist/test-room.html?area=vfx, lets the room's own loop run (real frames, real renders) and fires every explosive of the
// arsenal, first one at a time (cold), then again (warm), then all of them at once with a burst of grenades (storm), and checks the budget below in every phase.
//   node perf.mjs                      counters only (CI, software GL): shaders compiled after load, GPU buffers created per warm explosion, draw calls back to idle
//   PERF_MODE=gpu node perf.mjs        also frame times and long tasks (a machine with a real GPU; on a PRIME laptop run it with the NVIDIA offload env, see README)
//   PERF_CHROME=/usr/bin/google-chrome-stable   a Chrome to drive instead of Playwright's Chromium
//   PERF_SHARD=cold | warm | horde     one share: the nine first uses, warm_all + storm + after_storm, or the two horde phases (CI runs the three in parallel)
//   PERF_HORDE=2000                    agents of the horde phases (default 2000 in gpu mode, 300 in counters mode, where software GL pays per agent)
//   PERF_GPU=intel | nvidia            the machine of the plan's D12 (budget of the crowd step: 6 ms on intel, 4 ms on nvidia); default nvidia
//   PERF_PHASES=dense_horde,chain_horde   which horde phases run (default both)
//   PERF_OUT=/path/perf.json   where the report goes (default dist/perf.json)
//   PERF_PAGE=/path/to/test-room.html   drive another build of the page (to compare two builds)
//   PERF_ONLY=light_slots   only the phase that checks pointLights[slot] and spotLights[slot] against the lights of the budget
//   PERF_STACKS=1                      also lists, per phase, the attributes uploaded to the GPU during play (kind, element count, item size, array type)
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
// PERF_SHARD=cold|warm runs one half (CI runs both in parallel); unset runs everything
const SHARD = process.env.PERF_SHARD ?? 'all'
const runs = (part) => SHARD === 'all' || SHARD === part
// A hitch is a frame that misses two 60 Hz refreshes; a long task blocks input for more than 50 ms.
const BUDGET = {
  hitchMs: 33.4,
  p99Ms: 20,
  maxLongTaskMs: 50,
  // the deferred queues: no unit of work may wait longer than the 250 ms the sound queue tolerates (15 frames at 60 Hz)
  maxFramesWaiting: 15,
  programsAfterLoad: 0,
  buffersPerWarmExplosion: Number(process.env.PERF_BUFFERS_PER_EXPLOSION ?? 40),
  drawGrowthAfterStorm: 1.1,
}
const HORDE = Number(process.env.PERF_HORDE ?? (GPU_MODE ? 2000 : 300))
const HORDE_PHASES = (process.env.PERF_PHASES ?? 'dense_horde,chain_horde').split(',')
const HORDE_SEED = 21
let chainSetupBuffers = 0
const CHAIN_THROWN = (process.env.PERF_CHAIN_THROWN ?? 'frag_grenade,frag_grenade,frag_grenade,rpg_7,molotov').split(',').filter(Boolean)
// the horde phases: the budgets of `design-chain-horde.md` §14; the crowd step is provisional until the measured baseline (docs/desempenho-explosoes.md)
const HORDE_BUDGET = {
  crowdMsP99: process.env.PERF_GPU === 'intel' ? 6 : 4,
  drawsPerFrame: Number(process.env.PERF_HORDE_DRAWS ?? 95),
  drawGrowth: 1.5,
  buffersDense: 50,
  // no program: the room's warm-up covers every material the blasts draw (the ground marks included). Buffers: eight explosions' worth, plus what the street's seven destructibles
  // (six gas cylinders, a car) own once they are dented and shot (a part clones its geometry on its first dent, a hit makes a decal, a shard or a scratch): ~100 buffers each, measured
  chainPrograms: 0,
  chainDestructibles: 7,
  buffersPerDamagedObject: 100,
  denseSeconds: 30,
}
const chainBuffers = 8 * BUDGET.buffersPerWarmExplosion + HORDE_BUDGET.chainDestructibles * HORDE_BUDGET.buffersPerDamagedObject
const DRAW_MS = 300
const ROOM_AIM = { eye: [0, 1.6, 4], target: [0, 0.5, -4] }
// software GL in CI runs a frame in 0.3–0.8 s and the room caps dt, so a 4 s fuse takes minutes of real time there
const SETTLE_TIMEOUT_MS = GPU_MODE ? 20000 : 360000

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

const dist = process.env.PERF_PAGE ?? join(here, 'dist/test-room.html')
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
// software GL pays per pixel and the counters do not depend on the size, so CI draws a small window
const page = await browser.newPage({ viewport: GPU_MODE ? { width: 1600, height: 900 } : { width: 320, height: 180 }, deviceScaleFactor: 1 })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
await page.addInitScript(countWebGlCalls)
if (process.env.PERF_STACKS) await page.addInitScript(tagAttributeCreators)
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
let lightSlotReport = { point: [], spot: [], problems: ['light_slots did not run'] }
const idle = await phase('idle', () => pause(3000))
// the light slots are a load-time property of the room: the cold shard (or the whole run) checks them, the warm shard skips them
const slots = runs('cold') ? await phase('light_slots', async () => {
  lightSlotReport = await page.evaluate(readLightSlots)
}) : undefined
if (slots) console.log(`SLOTS ${JSON.stringify(lightSlotReport)}`)
if (process.env.PERF_ONLY === 'light_slots') {
  await browser.close()
  process.exit(lightSlotReport.problems.length === 0 && slots?.programs === 0 ? 0 : 1)
}
if (runs('cold')) for (const id of EXPLOSIVES) await phase(`cold_${id}`, () => fireAndSettle([id]))
// the warm shard alone first uses every explosive once, unmeasured, so warm_all measures second uses as in a full run
if (!runs('cold') && runs('warm')) await fireAndSettle(EXPLOSIVES, 300)
const warm = runs('warm') ? await phase('warm_all', () => fireAndSettle(EXPLOSIVES, 1200)) : undefined
const storm = runs('warm') ? await phase('storm', () => fireAndSettle([...EXPLOSIVES, ...EXPLOSIVES, ...EXPLOSIVES, ...Array(20).fill('frag_grenade')], 120)) : undefined
const after = runs('warm') ? await phase('after_storm', () => pause(3000)) : undefined

// the horde phases reload the page on their own bench state (seed, scene, physics, count: applied in that order whatever the URL says)
const hordeMetrics = {}
if (runs('horde')) for (const id of HORDE_PHASES) hordeMetrics[id] = await hordePhase(id)

const failures = []
const fail = (text) => failures.push(text)
for (const p of phases) {
  const programBudget = p.name === 'chain_horde' ? HORDE_BUDGET.chainPrograms : BUDGET.programsAfterLoad
  if (p.programs > programBudget) fail(`${p.name}: ${p.programs} shader programs compiled during play (budget ${programBudget}): ${p.programNames.join(' | ')}`)
  if (!GPU_MODE) continue
  if (p.hitches > 0) fail(`${p.name}: ${p.hitches} frames over ${BUDGET.hitchMs} ms (worst ${p.max} ms)`)
  if (p.p99 > BUDGET.p99Ms) fail(`${p.name}: p99 ${p.p99} ms (budget ${BUDGET.p99Ms} ms)`)
  if (p.worstLongTask > BUDGET.maxLongTaskMs) fail(`${p.name}: long task of ${p.worstLongTask} ms`)
  if (p.maxFramesWaiting >= BUDGET.maxFramesWaiting) fail(`${p.name}: a deferred queue waited ${p.maxFramesWaiting} frames (budget under ${BUDGET.maxFramesWaiting})`)
}
if (slots) for (const problem of lightSlotReport.problems) fail(`light_slots: ${problem}`)
if (slots && slots.programs > 0) fail(`light_slots: ${slots.programs} shader programs linked while the slots were lit one by one`)
const warmBuffers = warm ? warm.buffers / EXPLOSIVES.length : 0
if (warmBuffers > BUDGET.buffersPerWarmExplosion) fail(`warm_all: ${warmBuffers.toFixed(0)} GPU buffers created per explosion (budget ${BUDGET.buffersPerWarmExplosion})`)
if (after && after.drawsPerFrame > idle.drawsPerFrame * BUDGET.drawGrowthAfterStorm) fail(`after_storm: ${after.drawsPerFrame} draws per frame, idle was ${idle.drawsPerFrame}: the explosions left drawn things behind`)
for (const [id, found] of Object.entries(hordeMetrics)) checkHorde(id, found)
if (pageErrors.length > 0) fail(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`)

writeFileSync(process.env.PERF_OUT ?? join(outDir, 'perf.json'), JSON.stringify({ mode: GPU_MODE ? 'gpu' : 'counters', gpu, budget: BUDGET, phases, shard: SHARD, storm: storm?.name, lightSlots: lightSlotReport, horde: { agents: HORDE, gpuMachine: process.env.PERF_GPU ?? 'nvidia', budget: HORDE_BUDGET, metrics: hordeMetrics }, failures }, null, 1))
for (const text of failures) console.log(`FAIL  ${text}`)
console.log(failures.length === 0 ? 'PERF  every budget holds' : `PERF  ${failures.length} budget(s) broken`)
await browser.close()
process.exit(failures.length === 0 ? 0 : 1)

function pause(ms) {
  return page.evaluate((delay) => new Promise((resolve) => setTimeout(resolve, delay)), ms)
}

async function fireAndSettle(ids, gapMs = 0, aim = ROOM_AIM) {
  for (const id of ids) {
    // a player draws the weapon in real time; waitUntilReady would simulate the draw inside one task and stall the page like no player does
    await page.evaluate((weapon) => window.__testRoom.equip(weapon), id)
    await page.waitForFunction(() => window.__testRoom.tool?.phase == null, null, { timeout: SETTLE_TIMEOUT_MS, polling: 100 }).catch(() => pageErrors.push(`${id} never got ready`))
    await pause(DRAW_MS)
    const fired = await page.evaluate(([weapon, view]) => {
      const room = window.__testRoom
      room.look(view.eye, view.target)
      room.use()
      return room.tool?.id ?? weapon
    }, [id, aim])
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

/** The metrics of the module the room shows (the crowd area is the active bench), by id. */
function readHorde() {
  return page.evaluate(() => window.__testRoom.metrics().module)
}

// the horde phases: a page of their own, the bench state in the URL, the crowd baked at load (`eager`), the measurement from the first frame the room is ready
async function hordePhase(id) {
  const scene = id === 'dense_horde' ? 'dense_wall' : 'chain_line'
  await page.goto(`${pathToFileURL(dist).href}?area=crowd_area&bench.crowd_area=scene=${scene};count=${HORDE};physics=1;seed=${HORDE_SEED}`, { timeout: 0 })
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
  await page.evaluate(installFrameRecorder)
  const buffersAtStart = await page.evaluate(() => window.__glCounts.buffers)
  await phase(id, id === 'dense_horde' ? playDenseHorde : playChainHorde)
  const found = await readHorde()
  if (id === 'chain_horde') console.log(`CHAIN buffers created before the first blast: ${chainSetupBuffers - buffersAtStart}, after: ${(await page.evaluate(() => window.__glCounts.buffers)) - chainSetupBuffers}`)
  console.log(`HORDE ${id} ${JSON.stringify(found)}`)
  return { ...found, name: id }
}

async function waitForHorde(condition, seconds) {
  const timeout = GPU_MODE ? seconds * 1000 : SETTLE_TIMEOUT_MS
  await page.waitForFunction(condition, null, { timeout, polling: 250 }).catch(() => undefined)
}

async function playDenseHorde() {
  await page.waitForFunction((n) => window.__testRoom.metrics().module.agents >= n, HORDE, { timeout: SETTLE_TIMEOUT_MS, polling: 250 })
  // gpu mode plays the 30 s of the plan; software GL plays until the horde has done what the phase is for (falls by pressure, climbers) or the timeout
  if (GPU_MODE) await pause(HORDE_BUDGET.denseSeconds * 1000)
  else await waitForHorde(() => {
    const m = window.__testRoom.metrics().module
    return (m.falls_pressure ?? 0) > 0 && (m.climbers ?? 0) > 0
  }, HORDE_BUDGET.denseSeconds)
}

// the horde comes down the street; grenades, a rocket, a molotov and rifle fire go into it from the end of the street
async function playChainHorde() {
  const aim = { eye: [0, 1.6, -31], target: [0, 0.5, -57] }
  await waitForHorde(() => (window.__testRoom.metrics().module.agents ?? 0) > 0, 30)
  await pause(GPU_MODE ? 6000 : 1000)
  chainSetupBuffers = await page.evaluate(() => window.__glCounts.buffers)
  await fireAndSettle(CHAIN_THROWN, 300, aim)
  await page.evaluate(([view]) => window.__testRoom.equip('rifle_5_56') && window.__testRoom.look(view.eye, view.target), [aim])
  await page.waitForFunction(() => window.__testRoom.tool?.phase == null, null, { timeout: SETTLE_TIMEOUT_MS, polling: 100 }).catch(() => pageErrors.push('the rifle never got ready'))
  for (let shot = 0; shot < 10; shot++) {
    await page.evaluate(() => window.__testRoom.use())
    await pause(GPU_MODE ? 120 : 400)
  }
  await pause(GPU_MODE ? 5000 : 1000)
}

function checkHorde(id, found) {
  const own = phases.find((p) => p.name === id)
  const crowd = found
  if (crowd.agents === undefined) return fail(`${id}: the crowd area published no metrics (${Object.keys(crowd).join(', ')})`)
  if (crowd.draw_calls > HORDE_BUDGET.drawsPerFrame) fail(`${id}: the horde makes ${crowd.draw_calls} draw calls (budget ${HORDE_BUDGET.drawsPerFrame})`)
  if (own && own.drawsPerFrame > idle.drawsPerFrame * HORDE_BUDGET.drawGrowth) fail(`${id}: ${own.drawsPerFrame} draws per frame, idle was ${idle.drawsPerFrame}`)
  if (own && own.buffers > (id === 'dense_horde' ? HORDE_BUDGET.buffersDense : chainBuffers)) fail(`${id}: ${own.buffers} GPU buffers created during play`)
  if (id === 'dense_horde') {
    if (!(crowd.falls_pressure > 0)) fail(`dense_horde: no fall by pressure (${crowd.falls_pressure})`)
    if (!(crowd.climbers > 0)) fail(`dense_horde: nobody climbed the mound (${crowd.climbers})`)
  }
  if (id === 'chain_horde') {
    if (!(crowd.falls_chain > 0)) fail(`chain_horde: no chain fall beyond the blasts (${crowd.falls_chain})`)
  }
  if (GPU_MODE && crowd.crowd_ms_p99 > HORDE_BUDGET.crowdMsP99) fail(`${id}: crowd step p99 ${crowd.crowd_ms_p99} ms (budget ${HORDE_BUDGET.crowdMsP99} ms)`)
}

async function phase(name, run) {
  const before = await page.evaluate(() => window.__perf.mark())
  if (process.env.PERF_STACKS) await page.evaluate(listUploads)
  const profiler = process.env.PERF_PROFILE === name ? await page.context().newCDPSession(page) : undefined
  if (profiler) await profiler.send('Profiler.enable').then(() => profiler.send('Profiler.setSamplingInterval', { interval: 100 })).then(() => profiler.send('Profiler.start'))
  await run()
  if (profiler) writeFileSync(join(outDir, `perf-${name}.cpuprofile`), JSON.stringify((await profiler.send('Profiler.stop')).profile))
  const result = await page.evaluate(([label, start]) => window.__perf.read(label, start), [name, before])
  // the most frames any deferred queue had work waiting so far (the frame scheduler keeps it per queue), and each queue's forced runs
  const queues = await page.evaluate(() => window.__testRoom.frameStats?.().budget.queues ?? [])
  result.maxFramesWaiting = Math.max(0, ...queues.map((queue) => queue.maxFramesWaiting))
  result.queues = Object.fromEntries(queues.map((queue) => [queue.id, { maxFramesWaiting: queue.maxFramesWaiting, forced: queue.forced, ranUnits: queue.ranUnits }]))
  if (process.env.PERF_STACKS) result.bufferStacks = await page.evaluate(() => Object.entries(window.__bufferStacks).sort((a, b) => b[1] - a[1]).slice(0, 80))
  phases.push(result)
  console.log(`PHASE ${JSON.stringify(result)}`)
  return result
}

// --- in the page ---

/**
 * Lights every point and spot slot of the room's LightBudget at once, each with a colour and a position of its own, draws a frame and reads what three.js sent the shader for a lit material:
 * `pointLights[slot]` and `spotLights[slot]` must hold the light of that slot (colour times intensity, position in view space). A slot that points at another light is the bug the budget removes.
 */
async function readLightSlots() {
  const THREE = window.__THREE
  const room = window.__testRoom
  const { lights, webgl, scene, camera } = room
  const problems = []
  const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance
  const lease = (() => {
    for (let count = lights.sizes.point; count > 0; count--) {
      const taken = lights.lease({ owner: 'perf.light_slots', point: count })
      if (taken) return taken
    }
    return null
  })()
  const spots = []
  for (let index = 0; index < lights.sizes.spot; index++) {
    const spot = lights.acquire({ owner: 'perf.light_slots', kind: 'spot', priority: 1e6, color: [1, 1, 1], intensity: 1, distance: 30, position: [0, 3, 0], angle: 0.5 })
    if (spot) spots.push(spot)
  }
  const colourOf = (k, total) => [(k + 1) / (total + 1), 1 - (k + 1) / (total + 1), 0.25 + 0.5 * ((k * 7) % total) / total]
  const worldOf = (k) => [-6 + k * 0.8, 1.2 + (k % 3) * 0.7, -4 - (k % 5) * 0.9]
  const handles = lease ? lease.handles : []
  handles.forEach((handle, k) => handle.update({ color: colourOf(k, handles.length), intensity: 1.5, distance: 20, position: worldOf(k) }))
  spots.forEach((handle, k) => handle.update({ color: colourOf(k + 3, spots.length + 3), intensity: 2, distance: 30, position: worldOf(k + 20), target: [worldOf(k + 20)[0], 0, worldOf(k + 20)[2]] }))
  camera.updateMatrixWorld(true)
  webgl.render(scene, camera)
  // a lit material the frame drew
  let uniforms = null
  scene.traverse((node) => {
    const material = node.isMesh && node.visible ? node.material : null
    const found = material && !Array.isArray(material) ? webgl.properties.get(material).uniforms : null
    if (!uniforms && found?.pointLights && found?.spotLights) uniforms = found
  })
  if (!uniforms) problems.push('no lit material drew in the frame')
  else {
    const expectedView = (world) => new THREE.Vector3(...world).applyMatrix4(camera.matrixWorldInverse)
    const check = (kind, list, shaderLights, colourFor, worldFor, intensity) => {
      list.forEach((handle, k) => {
        const entry = shaderLights.value[handle.slot]
        const colour = colourFor(k)
        const view = expectedView(worldFor(k))
        if (!entry) problems.push(`${kind} slot ${handle.slot}: the shader has no light there`)
        else if (![entry.color.r - colour[0] * intensity, entry.color.g - colour[1] * intensity, entry.color.b - colour[2] * intensity].every((d) => near(d, 0, 2e-3))) problems.push(`${kind} slot ${handle.slot} holds another light (colour ${entry.color.r.toFixed(3)},${entry.color.g.toFixed(3)},${entry.color.b.toFixed(3)}, wanted ${(colour[0] * intensity).toFixed(3)},${(colour[1] * intensity).toFixed(3)},${(colour[2] * intensity).toFixed(3)})`)
        else if (!(near(entry.position.x, view.x, 1e-2) && near(entry.position.y, view.y, 1e-2) && near(entry.position.z, view.z, 1e-2))) problems.push(`${kind} slot ${handle.slot} holds a light at another place`)
      })
    }
    // the colours are linear numbers the budget wrote as linear, so the uniform equals colour x intensity exactly
    check('point', handles, uniforms.pointLights, (k) => colourOf(k, handles.length), worldOf, 1.5)
    check('spot', spots, uniforms.spotLights, (k) => colourOf(k + 3, spots.length + 3), (k) => worldOf(k + 20), 2)
  }
  const report = { point: handles.map((handle) => handle.slot), spot: spots.map((handle) => handle.slot), problems }
  lease?.release()
  for (const handle of spots) handle.release({ fadeMs: 0 })
  return report
}

function countWebGlCalls() {
  const counts = { programs: 0, buffers: 0, draws: 0, programNames: [] }
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
    // the name three gives each shader says which material made the program
    const link = proto.linkProgram
    proto.linkProgram = function (program) {
      const sources = (this.getAttachedShaders(program) ?? []).map((shader) => this.getShaderSource(shader) ?? '')
      counts.programNames.push([...new Set(sources.join('\n').match(/#define (?:USE_\w+|NUM_\w+ \d+|DISTANCE|DEPTH_PACKING \d+|SHADOWMAP_TYPE_\w+|SHADER_NAME \w+|FLAT_SHADED|MATCAP|LAMBERT|PHONG|STANDARD|BASIC)/g) ?? [])].join(' ').replace(/#define /g, ''))
      return link.call(this, program)
    }
    wrap('createBuffer', 'buffers')
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) wrap(name, 'draws')
  }
}

/** Tags every attribute with the code that made its geometry (the stack outside three.js), so an upload can be traced to the feature that asked for it. */
function tagAttributeCreators() {
  let namespace
  Object.defineProperty(window, '__THREE', {
    configurable: true,
    get: () => namespace,
    set(value) {
      namespace = value
      const proto = value.BufferGeometry.prototype
      const setAttribute = proto.setAttribute
      proto.setAttribute = function (name, attribute) {
        if (attribute && !attribute.__by) {
          const lines = (new Error().stack ?? '').split('\n').slice(2).map((line) => line.trim().replace(/^at /, ''))
          attribute.__by = `${this.type} ` + lines.filter((line) => !/ (BufferGeometry|[A-Za-z]*Geometry|Object\.setAttribute)\b|new [A-Za-z]*Geometry/.test(line)).slice(0, 7).join(' < ')
        }
        return setAttribute.call(this, name, attribute)
      }
    },
  })
}

/** Starts a fresh tally of the buffer attributes three.js uploads (its upload callback also runs on every refill, so an attribute counts once). */
function listUploads() {
  window.__bufferStacks = {}
  const proto = window.__THREE.BufferAttribute.prototype
  if (proto.__tallied) return
  proto.__tallied = true
  const original = proto.onUploadCallback
  const seen = new WeakSet()
  proto.onUploadCallback = function () {
    if (seen.has(this)) return original.call(this)
    seen.add(this)
    const key = `${this.constructor.name} count=${this.count} item=${this.itemSize} ${this.__by ?? ''}`
    window.__bufferStacks[key] = (window.__bufferStacks[key] ?? 0) + 1
    return original.call(this)
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
    mark: () => ({ ...window.__glCounts, programNames: window.__glCounts.programNames.length, frame: frames.length, longTask: longTasks.length, slowFrame: slowFrames.length }),
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
        programNames: counts.programNames.slice(start.programNames),
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
