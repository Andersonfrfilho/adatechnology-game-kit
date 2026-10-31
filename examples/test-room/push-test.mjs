// Pushing furniture in the real room, with the real keys, in first and third person. Prints what happened and saves shots/push-*.png.
// Run: node build.mjs && node push-test.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright') // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] ?? pathToFileURL(join(here, 'dist/test-room.html')).href

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?scene=push&table=0`)
await page.waitForFunction(() => window.__testRoom && window.__testRoom.spawned().some((s) => s.itemId === 'wardrobe'), null, { timeout: 180000 })
await page.waitForTimeout(1500)

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const state = () =>
  page.evaluate(() => {
    const r = window.__testRoom
    const at = (id) => r.spawned().find((s) => s.itemId === id)?.root.position
    return { push: r.push.state, player: [r.playerPosition[0], r.playerPosition[2]], nightstand: at('nightstand')?.z, bbq: at('bbq')?.z, wardrobe: at('wardrobe')?.z }
  })
const shot = (name) => page.screenshot({ path: join(shots, `push-${name}.png`), timeout: 180000 })
const look = (eye, target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])
const camera = (mode) => page.evaluate((m) => window.__testRoom.setCameraMode(m), mode)
/** Holds E until the ring has gone `until` of the way (real seconds of a slow GL run). */
const holdUntil = async (test) => {
  await page.keyboard.down('KeyE')
  await page.waitForFunction(test, null, { timeout: 60000, polling: 50 })
}
const ringShown = () => page.evaluate(() => {
  const ring = document.querySelector('.tr-ring')
  return ring ? getComputedStyle(ring).display !== 'none' : false
})

for (const mode of ['first', 'third']) {
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
  await page.waitForTimeout(2200)
  await shot(`${mode}-pushing`)
  await page.keyboard.up('KeyW')
  const after = await state()
  check(after.nightstand < before.nightstand - 0.3, `W pushes the nightstand (${before.nightstand.toFixed(2)} to ${after.nightstand.toFixed(2)})`)
  check(Math.abs(before.player[1] - after.player[1] - (before.nightstand - after.nightstand)) < 0.05, 'the player goes with it')
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(800)
  await page.keyboard.up('KeyS')
  check((await state()).nightstand > after.nightstand + 0.1, 'S pulls it back')
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(400)
  check((await state()).push === null, 'letting go of E ends it')
  await shot(`${mode}-released`)

  // too heavy
  const heavyZ = (await state()).bbq
  await look([1.6, 1.7, heavyZ + 1.2], [1.6, 0.8, heavyZ])
  await holdUntil(() => window.__testRoom.push.state?.phase === 'strain')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(900)
  await shot(`${mode}-too-heavy`)
  await page.keyboard.up('KeyW')
  const heavy = await state()
  check(heavy.push?.block === 'too_heavy' && heavy.bbq === heavyZ, `the grill (${Math.round(heavy.push?.massKg ?? 0)} kg) does not budge`)
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(300)

  // at the wall
  const wardrobeZ = (await state()).wardrobe
  await look([0, 1.7, wardrobeZ + 1.3], [0, 1.3, wardrobeZ])
  await holdUntil(() => window.__testRoom.push.state?.phase === 'push')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => window.__testRoom.push.state?.block === 'obstacle', null, { timeout: 60000 })
  await page.waitForTimeout(500)
  await shot(`${mode}-blocked`)
  const blocked = await state()
  await page.waitForTimeout(500)
  const still = await state()
  await page.keyboard.up('KeyW')
  check(still.push?.phase === 'strain' && still.player[1] === blocked.player[1] && still.wardrobe === blocked.wardrobe, `at the wall neither the wardrobe (z ${still.wardrobe.toFixed(2)}) nor the player advance`)
  // back off the wall for the next pass
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyS')
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(300)
}

// a tap still grabs
await camera('first')
const z = (await state()).nightstand
await look([-1.6, 1.7, z + 1], [-1.6, 0.45, z])
await page.keyboard.press('KeyE')
await page.waitForTimeout(200)
check(await page.evaluate(() => window.__testRoom.log.entries({ type: 'grab' }).length > 0), 'a tap on E still grabs')
check(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await browser.close()
console.log(failures.length ? `${failures.length} FAILED` : 'ALL OK')
process.exit(failures.length ? 1 : 0)
