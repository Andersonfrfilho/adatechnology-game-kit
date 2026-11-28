// The chips of a shot wall in the real room (owner, 2026-11-28): they pile on each other at the foot of the wall and stop at the player, never inside the
// body. Rounds into the brick wall at knee height with the player close; prints the pile and the counts. Saves shots/debris-pile-*.png. Outside CI (§9).
// Run: node build.mjs && NODE_PATH=... node debris-pile-test.mjs [url]
import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright'))
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : pathToFileURL(join(here, 'dist/test-room.html')).href
const out = process.env.OUT
/** The brick wall of the room (`defaultScenery`) stands at z = -11. */
const WALL_FACE = -10.9

const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?table=0&ui=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && typeof window.__testRoom.spawn === 'function', null, { timeout: 240000 })
await page.waitForTimeout(2000)
/** @param {string} code @param {unknown} [arg] */
const room = (code, arg) => page.evaluate(({ c, a }) => new Function('r', 'a', c)(window.__testRoom, a), { c: code, a: arg })
const shot = async (/** @type {string} */ name) => {
  const path = join(shots, `debris-pile-${name}.png`)
  await page.screenshot({ path, timeout: 60000 })
  if (out) copyFileSync(path, join(out, `debris-pile-${name}.png`))
  console.log('saved', path)
}
const eye = [0.15, 1.55, WALL_FACE + 0.75]
await room('r.setTool("hand")')
await room('r.look(a.eye, a.target)', { eye, target: [0.15, 0.2, WALL_FACE] })
await page.waitForTimeout(800)
// the chips of a concrete face and the flakes of a car's skin, each round thrown off a spot at knee height in front of the player and towards the player
// (the effects a shot plays: `impact_concrete` on concrete, `impact_bodywork` on a car)
const SPOT = [0.15, 0.35, WALL_FACE + 0.05]
for (let i = 0; i < 24; i++) {
  await room('const v = r.renderer.vfx; v.play(a.i % 2 ? "impact_bodywork" : "impact_concrete", a.spot, { normal: [0, 0, 1], seed: a.i + 1, values: { bore: 0.0185, paint: 0x8a1c1c, dx: 0, dy: -0.3, dz: -0.95 } })', { spot: SPOT, i })
  if (i === 6) {
    await page.waitForTimeout(50)
    await shot('flying')
  }
  await page.waitForTimeout(150)
}
await page.waitForTimeout(3000)
// what the pieces did: at rest, on another piece (above the ground by more than half their own thickness), inside the player's body
const counts = await room(`const engine = r.renderer.vfx?.workshop?.() ?? null
  if (!engine) return { error: 'no workshop' }
  const p = r.playerPosition
  const on = engine.debris.pieces.filter((piece) => piece.on)
  const thin = (piece) => Math.min(piece.sx, piece.sy, piece.sz)
  return { pieces: on.length, resting: on.filter((piece) => piece.rest).length, stacked: on.filter((piece) => piece.rest && piece.y > thin(piece) * 0.5 + 0.004).length,
    insidePlayer: on.filter((piece) => Math.hypot(piece.x - p[0], piece.z - p[2]) < 0.3 && piece.y > p[1] && piece.y < p[1] + 1.75).length,
    nearestToPlayer: Math.min(...on.map((piece) => Math.hypot(piece.x - p[0], piece.z - p[2]))), player: p }`).catch((e) => ({ error: String(e) }))
console.log('debris', JSON.stringify(counts))
await shot('feet')
// from the side, low: the pile at the foot of the wall and the edge of it where the player stands
await room('r.look(a.eye, a.target)', { eye: [0.9, 0.5, WALL_FACE + 0.45], target: [0.15, 0.02, WALL_FACE + 0.3] })
await page.waitForTimeout(400)
await shot('side')
console.log('errors', errors.slice(0, 5))
await browser.close()
