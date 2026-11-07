// Pushing furniture in the real room, with the real keys, in first and third person. Prints what happened and saves shots/push-*.png.
// Run: node build.mjs && node push-test.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright')) // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] ?? pathToFileURL(join(here, 'dist/test-room.html')).href

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?scene=push&table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom && window.__testRoom.spawned().some((/** @type {{ itemId: string; }} */ s) => s.itemId === 'wardrobe'), null, { timeout: 180000 })
/** Waits for `n` drawn frames of the room: a time in frames, not in milliseconds, so a slow GPU waits as long in the game as a fast one. */
const frames = (/** @type {number} */ n) =>
  page.evaluate((count) => new Promise((done) => {
    let left = count
    const tick = () => (--left <= 0 ? done(undefined) : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  }), n)
/** True once the wait settled, false when it timed out: the frames run at whatever speed the GPU gives. */
const held = (/** @type {Promise<unknown>} */ wait) => wait.then(() => true, () => false)
const WAIT = { timeout: 60000, polling: 50 }
/** Waits until piece `id` stands still from one drawn frame to the next. */
const settled = (/** @type {string} */ id) =>
  page.evaluate((which) => new Promise((done) => {
    let last = NaN
    const tick = () => {
      const z = window.__testRoom.spawned().find((s) => s.itemId === which)?.root.position.z ?? NaN
      if (Math.abs(z - last) < 1e-5) done(undefined)
      else {
        last = z
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }), id)
/** Waits until piece `id` goes past `z` (`sign` 1: beyond it, -1: before it). */
const movedPast = (/** @type {string} */ id, /** @type {number} */ z, /** @type {1 | -1} */ sign) =>
  held(page.waitForFunction(([which, limit, way]) => ((window.__testRoom.spawned().find((s) => s.itemId === which)?.root.position.z ?? NaN) - limit) * way > 0, /** @type {const} */ ([id, z, sign]), WAIT))
const pushEnded = () => held(page.waitForFunction(() => window.__testRoom.push.state === null, null, WAIT))
await frames(60)

/** @type {string[]} */
const failures = []
const check = (/** @type {boolean} */ ok, /** @type {string} */ label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const state = () =>
  page.evaluate(() => {
    const r = window.__testRoom
    const at = (/** @type {string} */ id) => r.spawned().find((/** @type {{ itemId: string; }} */ s) => s.itemId === id)?.root.position
    return { push: r.push.state, player: [r.playerPosition[0], r.playerPosition[2]], nightstand: /** @type {number} the scene spawned it */ (at('nightstand')?.z), bbq: /** @type {number} */ (at('bbq')?.z), wardrobe: /** @type {number} */ (at('wardrobe')?.z) }
  })
const shot = (/** @type {string} */ name) => page.screenshot({ path: join(shots, `push-${name}.png`), timeout: 180000 })
const look = (/** @type {[number, number, number]} */ eye, /** @type {[number, number, number]} */ target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])
const camera = (/** @type {import('@adatechnology/game-test-room').CameraMode} */ mode) => page.evaluate((/** @type {import('@adatechnology/game-test-room').CameraMode} */ m) => window.__testRoom.setCameraMode(m), mode)
/** Holds E until the ring has gone `until` of the way (real seconds of a slow GL run). */
const holdUntil = async (/** @type {{ (): boolean; (): boolean; (): boolean; }} */ test) => {
  await page.keyboard.down('KeyE')
  await page.waitForFunction(test, null, { timeout: 60000, polling: 50 })
}
const ringShown = () => page.evaluate(() => {
  const ring = document.querySelector('.tr-ring')
  return ring ? getComputedStyle(ring).display !== 'none' : false
})

for (const mode of /** @type {const} */ (['first', 'third'])) {
  console.log(`--- ${mode} person`)
  await camera(mode)
  // the light piece: the ring, then walking with it
  const lightZ = (await state()).nightstand
  await look([-1.6, 1.7, lightZ + 1], [-1.6, 0.45, lightZ])
  await holdUntil(() => (window.__testRoom.push.state?.progress ?? 0) > 0.45)
  check(await ringShown(), 'the ring shows around the crosshair while E is held')
  await shot(`${mode}-ring`)
  await page.waitForFunction(() => window.__testRoom.push.state?.phase === 'push', null, { timeout: 60000 })
  check(!(await ringShown()), 'the ring goes when the timer is full')
  const before = await state()
  // level the view for the picture: looking down from the shoulder the body hides a low piece
  if (mode === 'third') await page.evaluate(() => { const r = window.__testRoom; const [x, , z] = r.playerPosition; r.look([x, 1.7, z], [x, 1.3, z - 4]) })
  await page.keyboard.down('KeyW')
  await movedPast('nightstand', before.nightstand - 0.8, -1)
  await shot(`${mode}-pushing`)
  await page.keyboard.up('KeyW')
  // the reading is taken once the piece stands still
  await settled('nightstand')
  const after = await state()
  check(after.nightstand < before.nightstand - 0.3, `W pushes the nightstand (${before.nightstand.toFixed(2)} to ${after.nightstand.toFixed(2)})`)
  check(Math.abs(before.player[1] - after.player[1] - (before.nightstand - after.nightstand)) < 0.05, 'the player goes with it')
  await page.keyboard.down('KeyS')
  check(await movedPast('nightstand', after.nightstand + 0.1, 1), 'S pulls it back')
  await page.keyboard.up('KeyS')
  await page.keyboard.up('KeyE')
  check(await pushEnded(), 'letting go of E ends it')
  await shot(`${mode}-released`)

  // too heavy
  const heavyZ = (await state()).bbq
  await look([1.6, 1.7, heavyZ + 1.2], [1.6, 0.8, heavyZ])
  await holdUntil(() => window.__testRoom.push.state?.phase === 'strain')
  await page.keyboard.down('KeyW')
  await frames(30)
  await shot(`${mode}-too-heavy`)
  await page.keyboard.up('KeyW')
  const heavy = await state()
  check(heavy.push?.block === 'too_heavy' && heavy.bbq === heavyZ, `the grill (${Math.round(heavy.push?.massKg ?? 0)} kg) does not budge`)
  await page.keyboard.up('KeyE')
  await pushEnded()

  // at the wall
  const wardrobeZ = (await state()).wardrobe
  await look([0, 1.7, wardrobeZ + 1.3], [0, 1.3, wardrobeZ])
  await holdUntil(() => window.__testRoom.push.state?.phase === 'push')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => window.__testRoom.push.state?.block === 'obstacle', null, { timeout: 60000 })
  await frames(20)
  await shot(`${mode}-blocked`)
  const blocked = await state()
  await frames(30)
  const still = await state()
  await page.keyboard.up('KeyW')
  check(still.push?.phase === 'strain' && still.player[1] === blocked.player[1] && still.wardrobe === blocked.wardrobe, `at the wall neither the wardrobe (z ${still.wardrobe.toFixed(2)}) nor the player advance`)
  // back off the wall for the next pass
  await page.keyboard.down('KeyS')
  await movedPast('wardrobe', blocked.wardrobe + 0.4, 1)
  await page.keyboard.up('KeyS')
  await page.keyboard.up('KeyE')
  await pushEnded()
}

// a tap is still a tap: the hand's own E opens the nightstand's drawer (a piece with a door is opened first) or grabs, it is never taken for a push
await camera('first')
const z = (await state()).nightstand
await look([-1.6, 1.7, z + 1], [-1.6, 0.45, z])
const taps = () => page.evaluate(() => ['grab', 'door_reach'].reduce((sum, type) => sum + window.__testRoom.log.entries({ type }).length, 0))
const tapsBefore = await taps()
await page.keyboard.press('KeyE')
check(await held(page.waitForFunction((n) => ['grab', 'door_reach'].reduce((sum, type) => sum + window.__testRoom.log.entries({ type }).length, 0) > n, tapsBefore, { ...WAIT, timeout: 10000 })), 'a tap on E is still a tap (opens the drawer or grabs), not a push')
check(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await browser.close()
console.log(failures.length ? `${failures.length} FAILED` : 'ALL OK')
process.exit(failures.length ? 1 : 0)
