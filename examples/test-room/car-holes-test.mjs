// Bullet holes on a car in the real room (owner, 2026-11-28): rounds of several calibres on the side panels at a slant, then the side seen at a
// grazing angle and close up. Saves shots/car-holes-*.png (and copies to OUT when given). Outside CI (CLAUDE.md §9).
// Run: node build.mjs && NODE_PATH=... node car-holes-test.mjs [url] [prefix]
import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright'))
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : pathToFileURL(join(here, 'dist/test-room.html')).href
const prefix = process.argv[3] ?? 'car-holes'
const out = process.env.OUT

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
  const path = join(shots, `${prefix}-${name}.png`)
  await page.screenshot({ path, timeout: 60000 })
  if (out) copyFileSync(path, join(out, `${prefix}-${name}.png`))
  console.log('saved', path)
}
const CAR = [0, 0, 6]
await room('window.__carEvents = []; r.on("event", (e) => { const list = Array.isArray(e) ? e : [e]; for (const x of list) if (x && (x.type === "hole" || x.type === "ricochet" || x.type === "dent")) window.__carEvents.push({ type: x.type, part: x.part, d: x.hole?.diameter, through: x.hole?.through, n: x.worldNormal, p: x.worldPoint ?? x.point }) })')
await room('r.spawn("sedan", a, 0)', CAR)
await page.waitForTimeout(4000)
// the car's box in the world, to aim at its side
const box = await room(`const s = r.spawned().find((o) => o.itemId === 'sedan'); const V = s.root.position.constructor; const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]; s.root.updateMatrixWorld(true)
  s.root.traverse((o) => { if (!o.isMesh || !o.visible || o.userData.decal) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const v = o.localToWorld(new V(x, y, z)); const a = [v.x, v.y, v.z]; for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a[k]); max[k] = Math.max(max[k], a[k]) } } })
  return { min, max }`).catch((e) => ({ error: String(e) }))
console.log('car box', JSON.stringify(box))
const weapons = (process.env.WEAPONS ?? 'glock_17,colt_m4a1,shotgun_pump_12,barrett_m82a1').split(',').filter((id) => id && id !== 'none')
/** @param {string} weapon @param {number[]} from @param {number[]} target @param {string} [midShot] a print a few frames after the round lands */
/** What went wrong: a weapon that would not fire, a round that left nothing on the car, a door that did not open. @type {string[]} */
const failures = []
async function fire(weapon, from, target, midShot) {
  await room('r.setTool(a)', weapon)
  for (let tries = 0; tries < 160; tries++) {
    await room('r.look(a.from, a.target)', { from, target })
    const status = await room('return r.use()')
    if (status === 'ok') {
      await page.waitForTimeout(80)
      const events = await room('const e = window.__carEvents.splice(0); return e.map((x) => [x.type, x.part, x.d, x.through, (x.p ?? []).map((v) => +v.toFixed(2))])')
      console.log(weapon, JSON.stringify(events))
      if (!Array.isArray(events) || events.length === 0) failures.push(`${weapon}: the round left nothing on the car`)
      if (midShot) {
        await page.waitForTimeout(45)
        await room('r.pause()')
        await shot(midShot)
        await room('r.resume()')
      }
      return true
    }
    await page.waitForTimeout(100)
  }
  failures.push(`could not fire ${weapon}`)
  return false
}
if (box && 'min' in box) {
  const [x0, y0, z0] = box.min
  const [x1, y1, z1] = box.max
  const alongX = x1 - x0 > z1 - z0
  const near = alongX ? z0 : x0
  const len = alongX ? [x0, x1] : [z0, z1]
  const yMid = y0 + (y1 - y0) * 0.45
  /** A point by the car's side: `t` along its length (0 rear, 1 front), height `y`, `off` metres out of its side. */
  const at = (/** @type {number} */ t, /** @type {number} */ y, /** @type {number} */ off) => (alongX ? [len[0] + (len[1] - len[0]) * t, y, near - off] : [near - off, y, len[0] + (len[1] - len[0]) * t])
  /** Where each calibre lands on the front door: side by side along it. */
  const spots = weapons.map((_, i) => 0.5 + (i - (weapons.length - 1) / 2) * 0.06)
  for (let i = 0; i < weapons.length; i++) {
    // nearly square on, a little from the front: the calibres side by side
    await fire(weapons[i], at(spots[i] + 0.08, yMid + 0.05, 3), at(spots[i], yMid, -0.2), i === 1 ? 'impact' : undefined)
    await page.waitForTimeout(700)
  }
  // a round along the side at a slant: a gouge on the rear door
  await fire('colt_m4a1', at(0.05, yMid - 0.05, 0.5), at(0.33, yMid - 0.1, -0.05))
  await page.waitForTimeout(700)
  await fire('glock_17', at(0.08, yMid + 0.1, 0.45), at(0.36, yMid + 0.02, -0.05))
  await page.waitForTimeout(1500)
  await room('r.setTool("hand")')
  await page.waitForTimeout(800)
  /** @param {string} name @param {number[]} from @param {number[]} target */
  const view = async (name, from, target) => {
    await room('r.look(a.from, a.target)', { from, target })
    await page.waitForTimeout(500)
    await shot(name)
  }
  await view('calibers', at(0.5, yMid + 0.02, 0.55), at(0.5, yMid, -0.2))
  for (let i = 0; i < weapons.length; i++) await view(`close-${weapons[i]}`, at(spots[i], yMid + 0.005, 0.085), at(spots[i], yMid, -0.2))
  await view('gouge', at(0.345, yMid - 0.03, 0.25), at(0.345, yMid - 0.05, -0.2))
  await view('front', at(0.5, yMid + 0.1, 1.9), at(0.5, yMid - 0.05, -0.2))
  // grazing: along the side, the eye a few centimetres off the body, both ways
  await view('side', at(0.3, yMid + 0.02, 0.06), at(0.75, yMid - 0.01, 0.0))
  await view('side-back', at(0.72, yMid + 0.02, 0.06), at(0.3, yMid - 0.01, 0.0))
  // the door opened after the rounds: its holes go with it (CLAUDE.md §7)
  const opened = await room('const s = r.spawned().find((o) => o.itemId === "sedan"); return r.useLeaf(s.objectId, "door_front_right")')
  if (!opened) failures.push('the front right door did not open')
  await page.waitForTimeout(2500)
  await view('door-open', at(0.85, yMid + 0.25, 1.6), at(0.5, yMid, -0.1))
}
if (!box || !('min' in box)) failures.push('no car in the room')
for (const error of errors) failures.push(`page error: ${error}`)
await browser.close()
console.log(failures.length === 0 ? 'car-holes-test: every calibre marks the car' : `car-holes-test: ${failures.join('; ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
