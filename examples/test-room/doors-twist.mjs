// Opens every leaf of the door items in the real room (E as the hand does it) and checks that each leaf turns about one fixed axis all the way, never tipping out of its
// plane (a door past 90 degrees mixed as Euler angles did), and that opening a car door never puts the player inside the car. Saves shots/doors-twist-<item>-meio|aberta.png.
// Run: node build.mjs && node doors-twist.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright')) // NODE_PATH points at it, as in test.mjs
const url = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : pathToFileURL(join(here, 'dist/test-room.html')).href
const out = join(here, 'shots')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${url}?scene=doors&table=0&ui=0&items=sink_kitchen,washing_machine,kitchen_cabinet_base,sink_bathroom,kitchen_cabinet_wall`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__testRoom.spawned().some((s) => s.itemId === 'sedan'), null, { timeout: 2400000, polling: 5000 })
await page.waitForTimeout(3000)
const objs = await page.evaluate(() => window.__testRoom.spawned().map((s) => ({ id: s.objectId, item: s.itemId, at: [s.root.position.x, s.root.position.y, s.root.position.z], ry: s.root.rotation.y, leaves: window.__testRoom.leaves(s.objectId) })).filter((s) => s.leaves.length))
console.log(JSON.stringify(objs.map((o) => [o.item, o.leaves])))
/** @typedef {[number, number, number, number]} Quat4 */
/** @returns {Promise<Quat4 | null>} */
const quatOf = (/** @type {string} */ o, /** @type {string} */ p) => page.evaluate(([o, p]) => { const s = window.__testRoom.spawned().find((x) => x.objectId === o); const g = s?.root.getObjectByName(p); return g ? /** @type {Quat4} */ (g.quaternion.toArray()) : null }, [o, p])
/** @returns {Quat4} */
const mul = (/** @type {Quat4} */ a, /** @type {Quat4} */ b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
/** @returns {Quat4} */
const inv = (/** @type {Quat4} */ q) => [-q[0], -q[1], -q[2], q[3]]
const axisAngle = (/** @type {Quat4} */ q) => { const s = Math.hypot(q[0], q[1], q[2]); return { axis: s < 1e-9 ? [0, 0, 0] : [q[0] / s, q[1] / s, q[2] / s], angle: 2 * Math.atan2(s, q[3]) } }
let worst = 0
const failures = []
for (const o of objs) {
  for (const [li, leaf] of o.leaves.entries()) {
    if (li > 1 && o.item !== 'sedan') break
    const rest = await quatOf(o.id, leaf)
    if (!rest) { console.log('no group', o.item, leaf); continue }
    const fwd = [Math.sin(o.ry), Math.cos(o.ry)]
    /** @type {[number, number, number]} */
    const eye = [o.at[0] + fwd[0] * 2.2 + fwd[1] * 1.2, 1.9, o.at[2] + fwd[1] * 2.2 - fwd[0] * 1.2]
    await page.evaluate(([e, t]) => window.__testRoom.look(e, t), /** @type {[[number, number, number], [number, number, number]]} */ ([eye, [o.at[0] ?? 0, (o.at[1] ?? 0) + 0.7, o.at[2] ?? 0]]))
    const lockedBefore = await page.evaluate(() => window.__testRoom.log.entries().filter((e) => e.type === 'door_locked').length)
    await page.evaluate(([o, p]) => window.__testRoom.useLeaf(o, p), [o.id, leaf])
    const box = await page.evaluate((id) => { const s = window.__testRoom.spawned().find((x) => x.objectId === id); if (!s) return [0, 0, 0, 0]; const b = new window.__THREE.Box3().setFromObject(s.root); return [b.min.x, b.min.z, b.max.x, b.max.z] }, o.id)
    const samples = []
    let intoCar = 0
    const t0 = Date.now()
    while (Date.now() - t0 < 60000) {
      const v = await page.evaluate(([o, p]) => window.__testRoom.leafOpening(o, p), [o.id, leaf])
      const q = await quatOf(o.id, leaf)
      samples.push({ v, d: axisAngle(mul(inv(rest), q ?? rest)) })
      if (o.item === 'sedan') {
        // the car's own box at rest, shrunk by its doors and mirrors: the player's feet never get in there
        const [x, , z] = await page.evaluate(() => window.__testRoom.playerPosition)
        if (x > box[0] + 0.25 && x < box[2] - 0.25 && z > box[1] + 0.25 && z < box[3] - 0.25) intoCar++
      }
      if (v > 0.98 || (Date.now() - t0 > 4000 && (await page.evaluate(() => window.__testRoom.door)) === null)) break
      await page.waitForTimeout(40)
    }
    await page.waitForTimeout(500)
    const end = axisAngle(mul(inv(rest), (await quatOf(o.id, leaf)) ?? rest))
    let dev = 0
    for (const s of samples) if (s.d.angle > 0.05) dev = Math.max(dev, Math.acos(Math.min(1, Math.abs(s.d.axis[0] * end.axis[0] + s.d.axis[1] * end.axis[1] + s.d.axis[2] * end.axis[2]))))
    worst = Math.max(worst, dev)
    // a leaf the scene locked only rattles: nothing to measure, and it says so instead of passing on no motion
    const locked = (await page.evaluate(() => window.__testRoom.log.entries().filter((e) => e.type === 'door_locked').length)) > lockedBefore
    if (locked) {
      console.log(`LOCK ${o.item} ${leaf}: locked by the scene, it rattles and does not move (not measured)`)
      await page.waitForFunction(() => window.__testRoom.door === null, null, { timeout: 60000 }).catch(() => {})
      continue
    }
    const ok = dev < 0.01 && intoCar === 0
    if (!ok) failures.push(`${o.item}:${leaf}`)
    if (intoCar) console.log(`FAIL ${o.item} ${leaf}: the player was inside the car in ${intoCar} samples`)
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${o.item} ${leaf}: opened ${(samples.at(-1)?.v ?? 0).toFixed(2)}, final turn ${(end.angle * 180 / Math.PI).toFixed(0)} deg about [${end.axis.map((x) => x.toFixed(2))}], ${samples.length} samples, worst axis drift ${(dev * 180 / Math.PI).toFixed(2)} deg`)
    await page.evaluate(([o, p]) => window.__testRoom.useLeaf(o, p), [o.id, leaf])
    await page.waitForFunction(() => window.__testRoom.door === null, null, { timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}
// the shots: each object from the side and a step back, so the whole leaf is in the frame, its open clip played (the same pose the hand drives), mid-swing and open;
// one file per object (`-2`, `-3` for the second and third of an item)
/** @type {Record<string, number>} */
const count = {}
for (const o of objs) {
  const n = (count[o.item] = (count[o.item] ?? 0) + 1)
  const name = `doors-twist-${o.item}${n > 1 ? `-${n}` : ''}`
  const box = await page.evaluate((id) => { const s = window.__testRoom.spawned().find((x) => x.objectId === id); if (!s) return [0, 0, 0, 0, 0, 0]; const b = new window.__THREE.Box3().setFromObject(s.root); return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] }, o.id)
  const centre = [((box[0] ?? 0) + (box[3] ?? 0)) / 2, ((box[1] ?? 0) + (box[4] ?? 0)) / 2, ((box[2] ?? 0) + (box[5] ?? 0)) / 2]
  const size = Math.max((box[3] ?? 0) - (box[0] ?? 0), (box[4] ?? 0) - (box[1] ?? 0), (box[5] ?? 0) - (box[2] ?? 0))
  const back = 1.2 + size * 1.1
  // in front and to the side of the object (its front looks along +z turned by ry), a little above its top
  const fx = Math.sin(o.ry)
  const fz = Math.cos(o.ry)
  /** @type {[number, number, number]} */
  const target = [centre[0] ?? 0, centre[1] ?? 0, centre[2] ?? 0]
  // to the right of its front, or to the left when something else stands between that eye and the object (a barbecue in front of a wardrobe)
  /** @type {Array<[number, number, number]>} */
  const eyes = [1, -1].map((side) => [(centre[0] ?? 0) + (fx * 0.8 + side * fz * 0.6) * back, (box[4] ?? 1) + 0.6, (centre[2] ?? 0) + (fz * 0.8 - side * fx * 0.6) * back])
  const hidden = await page.evaluate(([id, list, t]) => {
    const T = window.__THREE
    const others = window.__testRoom.spawned().filter((x) => x.objectId !== id).map((x) => new T.Box3().setFromObject(x.root))
    return list.map((e) => {
      const from = new T.Vector3(e[0], e[1], e[2])
      const to = new T.Vector3(t[0], t[1], t[2])
      const ray = new T.Ray(from, to.clone().sub(from).normalize())
      const far = from.distanceTo(to)
      const hit = new T.Vector3()
      return others.some((b) => ray.intersectBox(b, hit) !== null && from.distanceTo(hit) < far)
    })
  }, /** @type {[string, Array<[number, number, number]>, [number, number, number]]} */ ([o.id, eyes, target]))
  const eye = /** @type {[number, number, number]} */ (eyes[hidden[0] && !hidden[1] ? 1 : 0])
  await page.evaluate(([e, t]) => window.__testRoom.look(e, t), /** @type {[[number, number, number], [number, number, number]]} */ ([eye, target]))
  await page.waitForTimeout(300)
  // the clips of the aimed item: the eye now rests on this object
  const clips = await page.evaluate((id) => { const a = window.__testRoom.animations(); return a?.objectId === id ? a.clips : [] }, o.id)
  const clip = clips.find((c) => c.id.startsWith('open'))
  if (!clip) { console.log('no open clip for the shots of', o.item, clips.map((c) => c.id).join(',')); continue }
  await page.evaluate(([c, id]) => window.__testRoom.playAnimation(c, id), [clip.id, o.id])
  await page.waitForTimeout(clip.duration * 500)
  await page.screenshot({ path: join(out, `${name}-meio.png`) })
  await page.waitForTimeout(clip.duration * 500 + 400)
  // the same view as mid-swing: the eye drifts while the clip plays
  await page.evaluate(([e, t]) => window.__testRoom.look(e, t), /** @type {[[number, number, number], [number, number, number]]} */ ([eye, target]))
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(out, `${name}-aberta.png`) })
  const close = clips.find((c) => c.id.startsWith('close'))
  if (close) {
    await page.evaluate(([c, id]) => window.__testRoom.playAnimation(c, id), [close.id, o.id])
    await page.waitForTimeout(close.duration * 1000 + 300)
  }
}
console.log(`worst drift ${(worst * 180 / Math.PI).toFixed(2)} deg; ${failures.length} failures ${failures.join(', ')}`)
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors')
await browser.close()
if (failures.length || errors.length) process.exit(1)
