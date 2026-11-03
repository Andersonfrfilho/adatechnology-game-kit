// Memory check of the test room (CLAUDE.md, "Memória"): repeats the same cycle (scenarios, or opening areas, then room.clear()) and fails when what is
// left after each cycle keeps growing. It counts every WebGL buffer, vertex array, texture, framebuffer and program the page creates and deletes, the
// canvases still alive after a forced GC, the event listeners on window, document and the canvas, the intervals still running, and the JS heap
// (the total of a heap snapshot, so garbage does not count).
//   node leak.mjs                       every phase
//   LEAK_PHASE=explosions|glass|areas|more|hands   one phase (CI runs them in parallel)
//   LEAK_SCENARIOS=a;b                  with LEAK_PHASE, only these scenarios
//   LEAK_ROUNDS=3                       measured cycles
//   LEAK_WARMUP=2                       warm-up cycles before the first count
// Writes dist/leak.json. Exit code 1 when a budget fails.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const PHASES = {
  // the blasts: the chain of P13 bottles, a grenade among bodies, the gas of a house, a gas bottle under the barbecue
  explosions: { scenarios: ['explosives_p13_chain', 'grenade_by_radius', 'house_gas_explodes', 'furniture_gas_bottle_explodes'] },
  // glass that cracks and shatters (car, window, shower, TV) and cars that roll over and come into the yard
  glass: { scenarios: ['vehicles_9mm_windshield', 'house_window_glass', 'furniture_shower_glass_shatters', 'furniture_tv_screen_shatters', 'vehicles_rollover', 'car_in_the_yard'] },
  // opening the areas one after another (cars, crowd, houses, explosives, bodies) and clearing the room
  areas: { areas: ['Veículos', 'Multidão', 'Casas', 'Explosivos', 'Personagens'] },
  // the other areas: weapons, items, animals, effects, ground, sound, plants and the city
  more: { areas: ['Armas', 'Itens', 'Animais', 'effects', 'Terreno', 'Som', 'Árvores, plantas e flores', 'Cidade'] },
  // the hands: one weapon of each kind taken, fired and put away, in first and third person
  hands: { hands: true },
}
// What a cycle may leave behind, per measured cycle (above it the room keeps something it removed). Measured after the fixes of 2026-11-02:
// buffers +0 to +70, textures 0, canvases 0, heap under 0.5 MB.
const BUDGET = { buffer: 150, vao: 80, texture: 2, framebuffer: 0, program: 2, canvases: 2, listeners: 0, intervals: 0, heapMB: 2 }
const ROUNDS = Number(process.env.LEAK_ROUNDS ?? 3)
const WARMUP = Number(process.env.LEAK_WARMUP ?? 2)
const ONLY = process.env.LEAK_PHASE
// LEAK_SCENARIOS=a;b  replaces the scenarios of the phase, to find which one keeps memory
if (ONLY && process.env.LEAK_SCENARIOS && PHASES[ONLY]) PHASES[ONLY] = { scenarios: process.env.LEAK_SCENARIOS.split(';') }

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
const { chromium } = loadPlaywright()

// Runs in the page before anything else: counts what the page creates and frees.
const INSTRUMENT = `(() => {
  const live = { buffer: 0, vao: 0, texture: 0, framebuffer: 0, renderbuffer: 0, program: 0 }
  const pairs = [['createBuffer', 'deleteBuffer', 'buffer'], ['createVertexArray', 'deleteVertexArray', 'vao'], ['createTexture', 'deleteTexture', 'texture'],
    ['createFramebuffer', 'deleteFramebuffer', 'framebuffer'], ['createRenderbuffer', 'deleteRenderbuffer', 'renderbuffer'], ['createProgram', 'deleteProgram', 'program']]
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue
    for (const [make, free, key] of pairs) {
      const m = C.prototype[make], f = C.prototype[free]
      if (!m) continue
      C.prototype[make] = function (...a) { const r = m.apply(this, a); if (r) live[key]++; return r }
      C.prototype[free] = function (o, ...a) { if (o) live[key]--; return f.call(this, o, ...a) }
    }
  }
  let canvases = 0
  const gone = new FinalizationRegistry(() => canvases--)
  const create = Document.prototype.createElement
  Document.prototype.createElement = function (tag, ...a) { const el = create.call(this, tag, ...a); if (String(tag).toLowerCase() === 'canvas') { canvases++; gone.register(el, 0) } return el }
  let listeners = 0
  const seen = new WeakMap()
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener
  const watched = (t) => t === window || t === document || t instanceof HTMLCanvasElement
  const key = (type, opt) => type + '|' + (typeof opt === 'boolean' ? opt : !!(opt && opt.capture))
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (fn && watched(this)) { let s = seen.get(this); if (!s) seen.set(this, (s = new Map())); const k = key(type, opt); let set = s.get(k); if (!set) s.set(k, (set = new Set())); if (!set.has(fn)) { set.add(fn); listeners++ } }
    return add.call(this, type, fn, opt)
  }
  EventTarget.prototype.removeEventListener = function (type, fn, opt) {
    const set = seen.get(this)?.get(key(type, opt)); if (set && set.delete(fn)) listeners--
    return remove.call(this, type, fn, opt)
  }
  const intervals = new Set()
  const si = window.setInterval, ci = window.clearInterval
  window.setInterval = function (...a) { const id = si.apply(this, a); intervals.add(id); return id }
  window.clearInterval = function (id) { intervals.delete(id); return ci.call(this, id) }
  window.__leakCount = () => ({ ...live, canvases, listeners, intervals: intervals.size })
})()`

const dist = join(here, 'dist/test-room.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
mkdirSync(join(here, 'dist'), { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const report = { budget: BUDGET, rounds: ROUNDS, phases: {} }
let failed = 0

/** The JS heap that is really kept: the sum of a heap snapshot's nodes (taking one runs a full GC first). */
async function heapMB(cdp) {
  const chunks = []
  const onChunk = (e) => chunks.push(e.chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  const snapshot = JSON.parse(chunks.join(''))
  const fields = snapshot.snapshot.meta.node_fields
  const size = fields.indexOf('self_size')
  let total = 0
  for (let i = size; i < snapshot.nodes.length; i += fields.length) total += snapshot.nodes[i]
  return total / 1048576
}

for (const [name, phase] of Object.entries(PHASES)) {
  if (ONLY && ONLY !== name) continue
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(INSTRUMENT)
  await page.goto(`${pathToFileURL(dist).href}?table=0&ui=0`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 300000 })
  const cdp = await page.context().newCDPSession(page)
  const cycle = () =>
    page.evaluate(async (p) => {
      const room = window.__testRoom
      if (p.scenarios) await room.runScenarios(room.scenarios.filter((s) => p.scenarios.includes(s.id)))
      if (p.hands) {
        const ids = [...room.arsenal.weapons.keys()]
        const kinds = new Map()
        for (const id of ids) {
          const kind = room.arsenal.weapons.get(id)?.action?.kind ?? 'other'
          if (!kinds.has(kind)) kinds.set(kind, id)
        }
        for (const camera of ['first', 'third']) {
          room.setCameraMode(camera)
          for (const id of kinds.values()) {
            room.equip(id)
            for (let i = 0; i < 10; i++) room.update(1 / 30)
            room.use()
            for (let i = 0; i < 30; i++) room.update(1 / 30)
          }
        }
        room.setCameraMode('first')
      }
      for (const group of p.areas ?? []) {
        await room.openAreaAsync(group)
        for (let i = 0; i < 60; i++) room.update(1 / 60)
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      room.clear()
      room.update(1 / 60)
      // the on-screen memory warning of the room (memory_leak): kept before the log is emptied, so the report says whether the room warned
      window.__memoryWarnings = (window.__memoryWarnings ?? 0) + room.log.entries({ type: 'memory_leak' }).length
      // the behaviour log is bounded on purpose (its last 5000 lines): emptied here so its filling up does not read as a leak
      room.log.clear()
    }, phase)
  // a few real frames after the clear, so what is left was drawn (or freed) by the renderer, then a full GC before counting
  const sample = async () => {
    await page.waitForTimeout(1500)
    // FinalizationRegistry callbacks (the canvas count) run some time after the collection: collect, let them run, collect again
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage')
      await page.waitForTimeout(500)
    }
    return page.evaluate(() => window.__leakCount())
  }
  // caches that fill once (shaders, sounds, the first build of each model) fill during the warm-up cycles
  for (let w = 0; w < WARMUP; w++) await cycle()
  const first = await sample()
  first.heapMB = await heapMB(cdp)
  const samples = [first]
  for (let r = 0; r < ROUNDS; r++) {
    await cycle()
    const s = await sample()
    s.usedMB = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576
    samples.push(s)
  }
  const last = samples[samples.length - 1]
  last.heapMB = await heapMB(cdp)
  // the renderer may hold one cycle's drawing a frame longer: the lower of the last two samples is what stays
  const prev = samples[samples.length - 2]
  const kept = Object.fromEntries(Object.keys(BUDGET).map((key) => [key, key === 'heapMB' ? last.heapMB : Math.min(last[key], prev[key])]))
  const rows = Object.entries(BUDGET).map(([key, perRound]) => {
    const growth = (kept[key] - first[key]) / ROUNDS
    return { key, first: +first[key].toFixed(1), last: +kept[key].toFixed(1), perRound: +growth.toFixed(2), budget: perRound, ok: growth <= perRound }
  })
  const warnings = await page.evaluate(() => window.__memoryWarnings ?? 0)
  const ok = rows.every((row) => row.ok) && errors.length === 0
  if (!ok) failed++
  report.phases[name] = { ok, rows, samples, errors, warnings }
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${name}`)
  for (const row of rows) console.log(`  ${row.ok ? 'ok ' : 'XX '} ${row.key.padEnd(12)} ${String(row.first).padStart(9)} -> ${String(row.last).padStart(9)}   ${row.perRound >= 0 ? '+' : ''}${row.perRound} per cycle (budget ${row.budget})`)
  for (const error of errors) console.log(`  XX  page error: ${error}`)
  console.log(`  ${warnings === 0 ? 'ok ' : '!! '} on-screen memory warnings: ${warnings}`)
  await page.close()
}

await browser.close()
writeFileSync(join(here, ONLY ? `dist/leak-${ONLY}.json` : 'dist/leak.json'), JSON.stringify(report, null, 2))
if (failed) {
  console.log(`\n${failed} phase(s) keep memory after each cycle: something removed from the scene was not released (releaseObject3D / discardObject3D of game-shapes-three), or a list still holds it.`)
  process.exit(1)
}
console.log('\nno phase keeps memory across cycles')
