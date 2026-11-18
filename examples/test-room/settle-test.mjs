// Nothing broken keeps shaking (CLAUDE.md §6 and §12, outside CI by §9): every household object of the catalogue is laid out and blown up, the room's own scenery
// (bookcase, table, brick wall, laundry tub) is shot and blown up, and a charge digs a crater in the open ground. After the debris has had time to settle, every
// loose piece is watched frame by frame: one awake for the whole watch while it moves is shaking between its neighbours, and fails the run with its material.
// Saves shots/settle-*.png. Run: node build.mjs && node settle-test.mjs [url] [--rounds=N]   (default dist/test-room.html, 2 rounds)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
/** Playwright from NODE_PATH (browser-checks sets it), else the workspace's playwright-core. @returns {typeof import('playwright')} */
const loadPlaywright = () => {
  try {
    return require('playwright')
  } catch {
    return require('playwright-core')
  }
}
const { chromium } = loadPlaywright()
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const args = process.argv.slice(2)
const base = args.find((a) => !a.startsWith('--')) ?? pathToFileURL(join(here, 'dist/test-room.html')).href
const rounds = Number(args.find((a) => a.startsWith('--rounds='))?.split('=')[1] ?? 2)
/** `--trace`: 20 frames of each failing piece's state (speeds, ground, sleep) after the verdict, to find why. */
const isTracing = args.includes('--trace')
/** Seconds the debris gets to settle, then the seconds every piece is watched. */
const SETTLE_MS = 9000
const WATCH_MS = 6000
/** A piece awake for the whole watch that travels more than this (m) is shaking. */
const SHAKING_PATH = 0.01

const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
/** @type {string[]} */
const failures = []
for (let round = 1; round <= rounds; round++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => failures.push(`round ${round}: page error ${e.message}`))
  await page.goto(base, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom?.world.has('shelf') && window.__furnitureReport, null, { timeout: 180000 })
  await page.evaluate(() => window.__testRoom.waitUntilReady(30))
  // lay out every household object of the catalogue in rows on the open floor behind the player
  const laid = await page.evaluate(() => {
    const r = window.__testRoom
    /** @type {string[]} */
    const ids = window.__furnitureReport.items
    /** @type {Array<[number, number, number]>} */
    const spots = []
    ids.forEach((id, i) => {
      const at = /** @type {[number, number, number]} */ ([-12 + (i % 9) * 3, 0, 8 + Math.floor(i / 9) * 3])
      try {
        r.spawn(id, at, 0)
        spots.push(at)
      } catch {
        // an object the room cannot lay by itself (it needs a wall) is left out
      }
    })
    return spots
  })
  await page.waitForTimeout(2000)
  // the room's scenery: the bookcase and the table shot through their legs and sides, then everything blown up, and a crater in the open
  const fired = await page.evaluate(async (/** @type {Array<[number, number, number]>} */ spots) => {
    const r = window.__testRoom
    const wait = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms))
    r.equip('rifle_5_56')
    let shots = 0
    for (const id of ['shelf', 'table']) {
      const at = r.world.state(id)?.position
      if (!at) continue
      for (const dx of [-0.58, 0.58]) for (const y of [0.25, 0.7, 1.1, 1.5]) {
        r.look([at[0] + dx, y, at[2] + 3], [at[0] + dx, y, at[2]])
        await wait(100)
        r.use()
        shots++
        await wait(120)
      }
    }
    let blasts = 0
    const blast = (/** @type {string} */ charge, /** @type {[number, number, number]} */ at) => {
      if (r.blastAt(charge, at)) blasts++
    }
    for (const id of ['target_wall', 'sink', 'test_table']) {
      const at = r.world.state(id)?.position
      if (at) blast('m67', [at[0], 0.8, at[2] + 0.8])
    }
    for (let i = 0; i < spots.length; i += 3) {
      const at = spots[i]
      blast('m67', [at[0] + 1.5, 0.5, at[2] + 0.5])
      await wait(150)
    }
    // a crater in open ground, with its gravel thrown about
    blast('c4', [14, 0.1, 14])
    const at = r.world.state('shelf')?.position ?? [-3.5, 0, 0]
    r.look([at[0] + 2.4, 1.6, at[2] + 2.0], [at[0], 0.3, at[2]])
    return { shots, blasts }
  }, laid)
  await page.waitForTimeout(SETTLE_MS)
  const watched = await page.evaluate(async (/** @type {number} */ watchMs) => {
    const r = window.__testRoom
    const pieces = r.renderer.pieces()
    /** @type {Map<object, { path: number, awake: number, frames: number, last: number[], first: number[], low: number }>} */
    const seen = new Map()
    const start = performance.now()
    while (performance.now() - start < watchMs) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      for (const p of pieces) {
        const at = [p.root.position.x, p.root.position.y, p.root.position.z]
        const s = seen.get(p) ?? { path: 0, awake: 0, frames: 0, last: at, first: at, low: Infinity }
        s.low = Math.min(s.low, at[1] - r.terrain.heightAt(at[0], at[2]))
        s.path += Math.hypot(at[0] - s.last[0], at[1] - s.last[1], at[2] - s.last[2])
        s.awake += p.sleeping ? 0 : 1
        s.frames++
        s.last = at
        seen.set(p, s)
      }
    }
    const materialOf = (/** @type {string} */ id) => {
      const parts = r.world.state(id)?.parts ?? []
      return [...new Set(parts.map((/** @type {{ material: string }} */ part) => part.material))].join('+') || '?'
    }
    return pieces.map((p) => {
      const s = seen.get(p) ?? { path: 0, awake: 0, frames: 1, last: [0, 0, 0], first: [0, 0, 0], low: 0 }
      const net = Math.hypot(s.last[0] - s.first[0], s.last[1] - s.first[1], s.last[2] - s.first[2])
      const v = Math.hypot(...p.velocity)
      return { id: p.objectId, material: materialOf(p.objectId), mass: p.mass, path: s.path, net, speed: v, low: s.low, half: p.halfExtents, alwaysAwake: s.awake === s.frames, at: [p.root.position.x, p.root.position.y, p.root.position.z].map((x) => +x.toFixed(2)) }
    })
  }, WATCH_MS)
  await page.screenshot({ path: join(shots, `settle-round${round}.png`) })
  const shaking = watched.filter((p) => p.alwaysAwake && p.path > SHAKING_PATH)
  const byMaterial = /** @type {Record<string, number>} */ ({})
  for (const p of watched) byMaterial[p.material] = (byMaterial[p.material] ?? 0) + 1
  console.log(`round ${round}: ${laid.length} objects laid, ${fired.shots} shots, ${fired.blasts} blasts; ${watched.length} loose pieces watched ${WATCH_MS / 1000} s, ${shaking.length} shaking`)
  console.log(`  pieces by material: ${JSON.stringify(byMaterial)}`)
  for (const p of shaking) {
    // shaking in place travels far and gets nowhere; one that gets somewhere is still sliding, rolling or flying
    const kind = p.net < p.path * 0.25 ? 'shaking in place' : 'never stops moving'
    const line = `round ${round}: ${p.id} (${p.material}, ${p.mass.toFixed(2)} kg, half ${p.half.map((x) => x.toFixed(3)).join('x')}) ${kind} at ${p.at.join(', ')}: ${(p.path * 1000).toFixed(0)} mm travelled, ${(p.net * 1000).toFixed(0)} mm from where it was, ${p.speed.toFixed(2)} m/s, lowest ${(p.low * 1000).toFixed(0)} mm over the ground`
    console.log(`  FAIL ${line}`)
    failures.push(line)
  }
  if (isTracing && shaking.length > 0) {
    const trace = await page.evaluate(async (/** @type {string[]} */ ids) => {
      const r = window.__testRoom
      const rows = []
      const fmt = (/** @type {ArrayLike<number>} */ v) => Array.from(v).map((x) => x.toFixed(3)).join(',')
      for (let frame = 0; frame < 20; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        for (const id of ids) {
          const p = /** @type {any} */ (r.renderer.piece(id))
          if (!p) continue
          const at = p.root.position
          rows.push(`${frame} ${id} at ${fmt([at.x, at.y, at.z])} ground ${r.terrain.heightAt(at.x, at.z).toFixed(3)} v ${fmt(p.velocity)} w ${fmt(p.angularVelocity)} onGround ${p.onGround} still ${(p.still ?? 0).toFixed(2)} tipping ${JSON.stringify(p.tipping ?? null)} round ${!!p.round} held ${p.held} frozen ${!!p.frozen}`)
        }
      }
      return rows
    }, shaking.slice(0, 4).map((p) => p.id))
    for (const row of trace) console.log(`  trace ${row}`)
  }
  await page.close()
}
await browser.close()
console.log(failures.length === 0 ? 'settle-test: nothing broken keeps shaking' : `settle-test: ${failures.length} failure(s)`)
process.exit(failures.length === 0 ? 0 : 1)
