// A pushed piece of the scenery takes its collision with it: the player walks through where the shelf stood and is stopped where it stands now. Saves shots/push-collider-*.png.
// Run: node build.mjs && node push-collider-test.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright')
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] ?? pathToFileURL(join(here, 'dist/test-room.html')).href

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?table=0&pushForce=2000`)
await page.waitForFunction(() => window.__testRoom?.world.has('shelf'), null, { timeout: 180000 })
await page.waitForTimeout(1500)

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const state = () => page.evaluate(() => {
  const r = window.__testRoom
  return { shelfZ: r.world.state('shelf').position[2], shelfX: r.world.state('shelf').position[0], playerZ: r.playerPosition[2], push: r.push.state }
})
const shot = (name) => page.screenshot({ path: join(shots, `push-collider-${name}.png`), timeout: 180000 })
const look = (eye, target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])

const start = await state()
const oldZ = start.shelfZ
const x = start.shelfX
await page.evaluate(() => window.__testRoom.setCameraMode('third'))
await look([x, 1.7, oldZ + 1], [x, 1.2, oldZ])
await page.keyboard.down('KeyE')
await page.waitForFunction(() => window.__testRoom.push.state?.phase === 'push', null, { timeout: 60000 })
await page.keyboard.down('KeyW')
await page.waitForFunction((z) => window.__testRoom.world.state('shelf').position[2] < z - 2.5, oldZ, { timeout: 60000 })
await page.keyboard.up('KeyW')
await page.keyboard.up('KeyE')
await page.waitForTimeout(800)
const moved = await state()
check(moved.shelfZ < oldZ - 2.5 && moved.push === null, `the shelf was pushed from z ${oldZ.toFixed(2)} to z ${moved.shelfZ.toFixed(2)}`)

await page.evaluate(() => { window.__lastZ = undefined })
// walk from before the old place, through it, up to the shelf
await look([x, 1.7, oldZ + 1.5], [x, 1.7, moved.shelfZ - 8])
await page.keyboard.down('KeyW')
await page.waitForFunction((z) => window.__testRoom.playerPosition[2] <= z, oldZ, { timeout: 60000 })
const through = await state()
await shot('through-old-place')
check(Math.abs(through.playerZ - oldZ) < 1.5, `the player crosses where the shelf stood (z ${through.playerZ.toFixed(2)})`)
await page.waitForFunction((z) => window.__testRoom.playerPosition[2] < z - 1, oldZ, { timeout: 60000 })
await page.waitForFunction(() => {
  const r = window.__testRoom
  const was = window.__lastZ
  window.__lastZ = r.playerPosition[2]
  return was !== undefined && Math.abs(was - r.playerPosition[2]) < 1e-4
}, null, { timeout: 60000, polling: 1000 })
await shot('blocked-at-new-place')
const blocked = await state()
await page.keyboard.up('KeyW')
check(blocked.playerZ > blocked.shelfZ, `the shelf stops the player where it stands now (player z ${blocked.playerZ.toFixed(2)}, shelf z ${blocked.shelfZ.toFixed(2)})`)
check(blocked.playerZ < oldZ - 1, `the player got past the old footprint (z ${oldZ.toFixed(2)})`)

// the piece comes back over its old footprint
await page.evaluate(([x2, z]) => window.__testRoom.look([x2, 1.7, z + 0.9], [x2, 1.2, z]), [x, blocked.shelfZ])
await page.keyboard.down('KeyE')
await page.waitForFunction(() => window.__testRoom.push.state?.phase === 'push', null, { timeout: 60000 })
await page.keyboard.down('KeyS')
await page.waitForFunction((z) => window.__testRoom.world.state('shelf').position[2] > z, oldZ, { timeout: 60000 })
await page.keyboard.up('KeyS')
await page.keyboard.up('KeyE')
await page.waitForTimeout(500)
await shot('pulled-over-old-place')
check((await state()).shelfZ > oldZ, 'pulled back, it crosses the place it left')
check(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await browser.close()
console.log(failures.length ? `${failures.length} FAILED` : 'ALL OK')
process.exit(failures.length ? 1 : 0)
