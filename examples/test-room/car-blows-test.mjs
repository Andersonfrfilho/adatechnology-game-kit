// Blows on a car in the real room (owner, 2026-11-28): a punch, a kick, a bat, a tactical knife and a katana on the sedan's doors, each on its own spot; then the doors seen
// square on, at a grazing angle and from inside the car with a door open, with the exit of a rifle round through the front door. Saves shots/car-blows-*.png and
// fails when a blow leaves nothing. Outside CI (§9).
// Run: node build.mjs && NODE_PATH=... node car-blows-test.mjs [url]
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
  const path = join(shots, `car-blows-${name}.png`)
  await page.screenshot({ path, timeout: 60000 })
  if (out) copyFileSync(path, join(out, `car-blows-${name}.png`))
  console.log('saved', path)
}
// the sedan along z, its left side (x < 0) facing the player; the doors from z = 4.9 (rear) to 6.6 (front)
const SIDE = -0.92
await room('window.__carEvents = []; r.on("event", (e) => { for (const x of Array.isArray(e) ? e : [e]) if (x && /dent|hole|damage/.test(x.type)) window.__carEvents.push(x.type) })')
await room('r.spawn("sedan", [0, 0, 6], 0)')
await page.waitForTimeout(4000)
/** @type {string[]} */
const failures = []
/** One blow of `tool` at the door point `z`, height `y`, the player standing `away` metres out. @param {string} tool @param {number} z @param {number} y @param {number} away */
async function blow(tool, z, y, away = 0.55) {
  await room('r.setTool(a)', tool)
  await page.waitForTimeout(600)
  // a swing that does not reach (the clip started a frame late) is swung again, at most five times
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let tries = 0; tries < 40; tries++) {
      await room('r.look(a.eye, a.target)', { eye: [SIDE - away, 1.5, z], target: [SIDE + 0.1, y, z] })
      if ((await room('return r.use()')) === 'ok') break
      await page.waitForTimeout(120)
    }
    // the blow lands at the clip's impact: keep aiming there until it has
    for (let i = 0; i < 14; i++) {
      await room('r.look(a.eye, a.target)', { eye: [SIDE - away, 1.5, z], target: [SIDE + 0.1, y, z] })
      await page.waitForTimeout(100)
    }
    const events = await room('return window.__carEvents.splice(0)')
    console.log(tool, JSON.stringify(events))
    if (Array.isArray(events) && events.length > 0) return
  }
  failures.push(`${tool}: the blow left nothing on the car`)
}
await blow('hand', 6.35, 0.75, 0.4)
await blow('kick', 6.05, 0.45, 0.7)
await blow('baseball_bat', 5.75, 0.7, 0.7)
await blow('tactical_knife', 5.4, 0.9, 0.3)
await blow('katana', 5.1, 0.7, 0.75)
// a rifle round square through the front door, for its exit inside
await room('r.setTool("colt_m4a1")')
for (let tries = 0; tries < 60; tries++) {
  await room('r.look(a.eye, a.target)', { eye: [SIDE - 2, 0.75, 6.25], target: [SIDE + 0.2, 0.72, 6.25] })
  if ((await room('return r.use()')) === 'ok') break
  await page.waitForTimeout(120)
}
await page.waitForTimeout(1500)
// the round's marks on the front door: its entry outside, its exit inside the sheet and through the door's card
const doorMarks = await room(`const s = r.spawned().find((o) => o.itemId === 'sedan'); let count = 0, inward = 0
  s.root.traverse((o) => { if (!o.isInstancedMesh || !o.userData.decal) return; let door = false; for (let q = o; q; q = q.parent) if (q.userData?.plateOf === 'door_front_right') door = true; if (!door) return
    const m = new o.matrix.constructor(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); count++; if (m.elements[8] > 0.5) inward++ } })
  return { count, inward }`)
console.log('front door marks', JSON.stringify(doorMarks))
if (!doorMarks || doorMarks.inward < 1) failures.push('the round left no exit inside the front door')
await room('r.setTool("hand")')
await page.waitForTimeout(800)
/** @param {string} name @param {number[]} eye @param {number[]} target */
const view = async (name, eye, target) => {
  await room('r.look(a.eye, a.target)', { eye, target })
  await page.waitForTimeout(500)
  await shot(name)
}
await view('doors', [SIDE - 1.6, 0.85, 5.75], [SIDE, 0.65, 5.75])
await view('punch', [SIDE - 0.35, 0.78, 6.35], [SIDE, 0.75, 6.35])
await view('kick', [SIDE - 0.4, 0.5, 6.05], [SIDE, 0.45, 6.05])
await view('bat', [SIDE - 0.45, 0.72, 5.75], [SIDE, 0.7, 5.75])
await view('knife', [SIDE - 0.3, 0.92, 5.4], [SIDE, 0.9, 5.4])
await view('katana', [SIDE - 0.4, 0.72, 5.1], [SIDE, 0.7, 5.1])
await view('grazing', [SIDE - 0.08, 0.7, 4.3], [SIDE + 0.02, 0.62, 6.6])
// inside: the front door opened, the eye in the doorway looking at the door's inner face
const opened = await room('const s = r.spawned().find((o) => o.itemId === "sedan"); return r.useLeaf(s.objectId, "door_front_right") || r.useLeaf(s.objectId)')
if (!opened) failures.push('the front door did not open')
await page.waitForTimeout(2500)
await view('door-open', [SIDE - 1.4, 1.0, 7.4], [SIDE - 0.4, 0.7, 6.4])
// the inside face of the open door, square on: the exit of the round through the door's card (an inward mark, the one deepest from the entry)
const exitAt = await room(`const s = r.spawned().find((o) => o.itemId === 'sedan'); const all = []
  s.root.traverse((o) => { if (!o.isInstancedMesh || !o.userData.decal) return; let door = false; for (let q = o; q; q = q.parent) if (q.userData?.plateOf === 'door_front_right') door = true; if (!door) return
    const m = new o.matrix.constructor(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); const e = m.elements; const n = Math.hypot(e[8], e[9], e[10]); all.push({ p: [e[12], e[13], e[14]], out: [e[8] / n, e[9] / n, e[10] / n] }) } })
  const dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2])
  const near = all.filter((a) => all.some((b) => b !== a && dist(a, b) < 0.25))
  let best = null, far = -1
  for (const a of near) for (const b of near) { const d = dist(a, b); if (d > far && d < 0.25) { far = d; best = a.out[0] * b.out[0] < 0 ? a : b } }
  // of the two ends of the path, the inside one faces away from the outside entry: the one whose facing points the other way from the outermost mark
  if (!best) return null
  const others = near.filter((x) => dist(x, best) < 0.25)
  const deepest = others.reduce((m, x) => (dist(x, others[0]) > dist(m, others[0]) ? x : m), others[0])
  return deepest`)
if (exitAt) {
  const [px, py, pz] = exitAt.p
  const [nx, , nz] = exitAt.out
  await view('inside', [px + nx * 0.6, py + 0.25, pz + nz * 0.6], [px, py, pz])
  await view('inside-close', [px + nx * 0.2, py + 0.05, pz + nz * 0.2], [px, py, pz])
} else failures.push('no exit mark to look at')
for (const error of errors) failures.push(`page error: ${error}`)
await browser.close()
console.log(failures.length === 0 ? 'car-blows-test: every blow marks the car' : `car-blows-test: ${failures.join('; ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
