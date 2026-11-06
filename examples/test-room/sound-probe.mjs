// Sound probe of the test room: opens an area, records every sound the room's engine is asked for (id, volume, position, when) and when its nodes
// really start in the AudioContext, records the room's output to a file, and runs the steps it is given (bench actions, waits).
// Run: node sound-probe.mjs <steps.json> [--url http://localhost:4280/test-room.html] [--out shots/sound]
// steps.json: { "query": "area=Vehicles", "steps": [{ "bench": "vehicles_area", "set": { "driving": "semi" } }, { "act": "drive_lane", "bench": "vehicles_area" }, { "wait": 6000 }] }
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = /** @type {typeof import('playwright')} */ (require('playwright'))

const args = process.argv.slice(2)
const flag = (/** @type {string} */ name, /** @type {string | number} */ fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const plan = JSON.parse(readFileSync(args[0], 'utf8'))
const url = flag('--url', 'http://localhost:4280/test-room.html')
const out = flag('--out', 'shots/sound')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: Number(flag('--w', 960)), height: Number(flag('--h', 540)) } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.addInitScript(() => {
  // every node start, in context time, with the context time at the call: the delay a sound really has
  const starts = []
  window.__soundStarts = starts
  for (const Node of [AudioBufferSourceNode, OscillatorNode]) {
    const start = Node.prototype.start
    Node.prototype.start = function (when, ...rest) {
      starts.push({ kind: Node.name, at: this.context.currentTime, when: when ?? 0, wall: performance.now() })
      return start.call(this, when, ...rest)
    }
  }
  // the output goes to a recorder too
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target instanceof AudioDestinationNode) {
      const ctx = target.context
      if (!ctx.__tap) {
        ctx.__tap = ctx.createMediaStreamDestination()
        const rec = new MediaRecorder(ctx.__tap.stream, { mimeType: 'audio/webm;codecs=opus' })
        /**
           * @type {Blob[]}
           */
        const chunks = []
        rec.ondataavailable = (e) => chunks.push(e.data)
        window.__soundRecording = { rec, chunks, ctx, startedWall: performance.now(), startedCtx: ctx.currentTime }
        rec.start(250)
      }
      connect.call(this, ctx.__tap)
    }
    return connect.call(this, target, ...rest)
  }
})
console.log('open', plan.query)
await page.goto(`${url}?${plan.query ?? ''}`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__testRoom.audio, null, { timeout: 300000 })
console.log('room up')
// the context, the mix chain and the recorder exist before the first action, so its first milliseconds are on the recording
await page.evaluate(() => {
  const engine = window.__testRoom.audio
  engine.unlock?.()
  engine.warmUp?.()
})
await page.waitForTimeout(plan.settle ?? 4000)
await page.evaluate(() => {
  const room = window.__testRoom
  const engine = room.audio
  const calls = []
  window.__soundCalls = calls
  const ctxTime = () => window.__soundRecording?.ctx.currentTime ?? null
  const play = engine.play.bind(engine)
  engine.play = (id, options = {}) => {
    const handle = play(id, options)
    calls.push({ type: 'play', id, volume: options.volume ?? 1, position: options.position ?? null, wall: performance.now(), ctx: ctxTime(), played: Boolean(handle), kind: handle?.kind ?? null })
    return handle
  }
  const loop = engine.loop.bind(engine)
  engine.loop = (id, ...rest) => {
    const handle = loop(id, ...rest)
    calls.push({ type: 'loop', id, wall: performance.now(), ctx: ctxTime() })
    return {
      set(state) {
        calls.push({ type: 'set', id, ...state, wall: performance.now(), ctx: ctxTime() })
        return handle.set(state)
      },
      stop() {
        calls.push({ type: 'stop', id, wall: performance.now(), ctx: ctxTime() })
        return handle.stop()
      },
    }
  }
  // the room log: the module's own lines (a crash at so many m/s), with the time they were written
  window.__frames = 0
  const tick = () => (window.__frames++, requestAnimationFrame(tick))
  requestAnimationFrame(tick)
  window.__roomLines = []
  const add = room.log?.add?.bind(room.log)
  if (add) room.log.add = (entry, ...rest) => (window.__roomLines.push({ line: entry?.text ?? String(entry), wall: performance.now() }), add(entry, ...rest))
})
const t0 = await page.evaluate(() => performance.now())
for (const step of plan.steps) {
  if (step.wait) await page.waitForTimeout(step.wait)
  if (step.mark) await page.evaluate((m) => window.__soundCalls.push({ type: 'mark', id: m, wall: performance.now() }), step.mark)
  if (step.set) await page.evaluate(({ bench, set }) => Object.entries(set).forEach(([k, v]) => window.__testRoom.bench(bench).set(k, v)), step)
  if (step.act) await page.evaluate(({ bench, act }) => window.__soundCalls.push({ type: 'act', id: act, ok: window.__testRoom.bench(bench).act(act), wall: performance.now() }), step)
  if (step.eval) await page.evaluate(step.eval)
  if (step.shot) await page.screenshot({ path: join(out, step.shot), timeout: 180000 })
}
const result = await page.evaluate(async () => {
  const r = window.__soundRecording
  let audio = null
  if (r) {
    await new Promise((done) => {
      r.rec.onstop = done
      r.rec.stop()
    })
    const blob = new Blob(r.chunks, { type: 'audio/webm' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    audio = { base64: btoa(s), startedWall: r.startedWall }
  }
  return { frames: window.__frames, calls: window.__soundCalls, starts: window.__soundStarts, lines: window.__roomLines, audio }
})
if (result.audio) writeFileSync(join(out, `${plan.name ?? 'probe'}.webm`), Buffer.from(result.audio.base64, 'base64'))
const rel = (/** @type {number} */ w) => Math.round(w - t0)
const report = {
  calls: result.calls.map((/** @type {{ wall: number; }} */ c) => ({ ...c, t: rel(c.wall) })),
  lines: (result.lines ?? []).map((/** @type {{ wall: number; }} */ l) => ({ ...l, t: rel(l.wall) })),
  starts: result.starts.filter((/** @type {{ wall: number; }} */ s) => s.wall >= t0).map((/** @type {{ wall: number; when: number; at: number; }} */ s) => ({ ...s, t: rel(s.wall), lateMs: Math.round((Math.max(s.when, s.at) - s.at) * 1000) })),
  recordingStartsAt: result.audio ? rel(result.audio.startedWall) : null,
  frames: result.frames,
}
writeFileSync(join(out, `${plan.name ?? 'probe'}.json`), JSON.stringify(report, null, 1))
console.log(`calls ${report.calls.length}, starts ${report.starts.length}, lines ${report.lines.length}, recording at ${report.recordingStartsAt} ms`)
await browser.close()
