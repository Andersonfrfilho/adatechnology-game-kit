// Level of an AK shot and of the spent case it ejects in the real test room, measured at the output of the room's mix (after the compressor and the
// limiter): single rounds a second and a half apart (the shot window, then the window where the case lands) and a full-auto burst of the whole magazine.
// Run: node build.mjs && (cd dist && python3 -m http.server 44xx) && node sound-casing-levels.mjs [--url http://localhost:44xx/test-room.html] [--out shots/casing-levels]
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = (() => {
  for (const id of ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      // next
    }
  }
  throw new Error('playwright not found')
})()
const flag = (/** @type {string} */ name, /** @type {string} */ fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}
const url = flag('url', 'http://localhost:4491/test-room.html')
const out = flag('out', 'shots/casing-levels')
const TOOL = flag('tool', 'ak_47')
const SINGLES = Number(flag('singles', '6'))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome-stable', args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (/** @type {Error} */ e) => console.error('pageerror', e.message))
await page.addInitScript(() => {
  /** @type {{ at: number; peak: number; rms: number }[]} */
  const blocks = []
  window.__blocks = blocks
  const meters = new Map()
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = /** @type {AudioNode['connect']} */ (/** @this {AudioNode} @param {AudioNode | AudioParam} target @param {...number} rest */ function (target, ...rest) {
    if (!(target instanceof AudioDestinationNode)) return /** @type {(this: AudioNode, ...a: unknown[]) => AudioNode} */ (connect).call(this, target, ...rest)
    const ctx = target.context
    window.__ctx = ctx
    if (!meters.has(ctx)) {
      const meter = ctx.createScriptProcessor(2048, 1, 1)
      meter.onaudioprocess = (/** @type {AudioProcessingEvent} */ e) => {
        const data = e.inputBuffer.getChannelData(0)
        let peak = 0
        let sum = 0
        for (const v of data) {
          peak = Math.max(peak, Math.abs(v))
          sum += v * v
        }
        blocks.push({ at: ctx.currentTime, peak, rms: Math.sqrt(sum / data.length) })
      }
      /** @type {(this: AudioNode, ...a: unknown[]) => AudioNode} */ (connect).call(meter, target)
      meters.set(ctx, meter)
    }
    return /** @type {(this: AudioNode, ...a: unknown[]) => AudioNode} */ (connect).call(this, meters.get(ctx), ...rest)
  })
})
await page.goto(`${url}?ui=0&table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__testRoom.audio, null, { timeout: 600000 })
const result = await page.evaluate(async (/** @type {{ tool: string; singles: number }} */ { tool, singles }) => {
  const r = window.__testRoom
  r.audio?.unlock?.()
  r.audio?.warmUp?.()
  const wait = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms))
  const frames = async (/** @type {number} */ seconds) => {
    for (let i = 0; i < seconds * 60; i++) {
      r.update(1 / 60)
      await wait(16)
    }
  }
  await wait(3000)
  r.resume()
  r.setTool(tool)
  for (let i = 0; i < 90; i++) r.update(1 / 60)
  r.look([-9, 1.7, 9], [-9, 1.5, 30])
  await frames(1)
  const fireTimes = []
  for (let n = 0; n < singles; n++) {
    fireTimes.push(window.__ctx.currentTime)
    r.use()
    await frames(1.6)
  }
  await frames(1)
  const burstFrom = window.__ctx.currentTime
  const burstRounds = r.tool.ammo
  for (let n = 0; n < burstRounds; n++) {
    r.use()
    await frames(0.1)
  }
  await frames(3)
  const burstTo = window.__ctx.currentTime
  return { fireTimes, burstFrom, burstTo, burstRounds, blocks: window.__blocks.slice(), ammoLeft: r.tool.ammo }
}, { tool: TOOL, singles: SINGLES })
await browser.close()

const db = (/** @type {number} */ v) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -120)
const window_ = (/** @type {number} */ from, /** @type {number} */ to) => {
  const inside = result.blocks.filter((/** @type {{ at: number; peak: number; rms: number }} */ b) => b.at >= from && b.at < to)
  return { peak: Math.max(0, ...inside.map((/** @type {{ at: number; peak: number; rms: number }} */ b) => b.peak)), rms: Math.max(0, ...inside.map((/** @type {{ at: number; peak: number; rms: number }} */ b) => b.rms)) }
}
const rows = result.fireTimes.map((/** @type {number} */ t) => {
  const shot = window_(t, t + 0.3)
  const casing = window_(t + 0.35, t + 1.5)
  return { shotPeakDb: db(shot.peak), shotRmsDb: db(shot.rms), casingPeakDb: db(casing.peak), casingRmsDb: db(casing.rms) }
})
const mean = (/** @type {number[]} */ xs) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)
const burst = window_(result.burstFrom, result.burstTo)
const summary = {
  tool: TOOL,
  singles: rows,
  meanShotPeakDb: mean(rows.map((/** @type {{ shotPeakDb: number; shotRmsDb: number; casingPeakDb: number; casingRmsDb: number }} */ r) => r.shotPeakDb)),
  meanCasingPeakDb: mean(rows.map((/** @type {{ shotPeakDb: number; shotRmsDb: number; casingPeakDb: number; casingRmsDb: number }} */ r) => r.casingPeakDb)),
  casingBelowShotPeakDb: mean(rows.map((/** @type {{ shotPeakDb: number; shotRmsDb: number; casingPeakDb: number; casingRmsDb: number }} */ r) => r.shotPeakDb - r.casingPeakDb)),
  casingBelowShotRmsDb: mean(rows.map((/** @type {{ shotPeakDb: number; shotRmsDb: number; casingPeakDb: number; casingRmsDb: number }} */ r) => r.shotRmsDb - r.casingRmsDb)),
  burst: { rounds: result.burstRounds, peakDb: db(burst.peak), rmsDb: db(burst.rms) },
}
console.log(JSON.stringify(summary, null, 1))
writeFileSync(join(out, 'casing-levels.json'), JSON.stringify(summary, null, 1))
