// Only what its definition says is pushed, in the real room with the real keys: E on a can grabs it with no ring, E on a sofa fills the ring. Saves shots/pushable-*.png.
// Run: node build.mjs && node pushable-test.mjs [url]   (default dist/test-room.html)
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
await page.goto(`${base}?table=0`)
await page.waitForFunction(() => window.__testRoom && window.__testRoom.testTable.items().some((item) => item.id === 'item_soda_can'), null, { timeout: 180000 })
await page.waitForTimeout(1500)

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const ringShown = () => page.evaluate(() => [...document.querySelectorAll('.tr-ring')].some((ring) => getComputedStyle(ring).display !== 'none' && getComputedStyle(ring).visibility !== 'hidden'))
const grabs = () => page.evaluate(() => window.__testRoom.log.entries({ type: 'grab' }).length)
const hold = async (seconds) => {
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(seconds * 1000)
}

const ids = await page.evaluate(() => {
  const room = window.__testRoom
  const can = room.spawn('item_soda_can', [-1.6, 0, 6], 0)
  const sofa = room.spawn('sofa', [1.6, 0, 6], 0)
  room.setTool('hand')
  return { can: can.objectId, sofa: sofa.objectId }
})
await page.waitForTimeout(500)

// the can: not leaned on, in the hand at once
await page.evaluate(() => window.__testRoom.look([-1.6, 1.7, 7], [-1.6, 0.06, 6]))
await page.waitForTimeout(300)
await page.screenshot({ path: join(shots, 'pushable-can-before.png'), timeout: 180000 })
const before = await grabs()
await hold(1.2)
check((await page.evaluate(() => window.__testRoom.push.state)) === null, 'holding E on the can does not lean on it')
check(!(await ringShown()), 'no ring on the can')
check((await grabs()) === before + 1, 'E grabbed the can at once')
await page.screenshot({ path: join(shots, 'pushable-can-no-ring.png'), timeout: 180000 })
await page.keyboard.up('KeyE')
await page.keyboard.press('KeyE')
await page.waitForTimeout(300)

// the sofa: the ring fills and the push starts
await page.evaluate(() => window.__testRoom.look([1.6, 1.7, 7.1], [1.6, 0.45, 6]))
await page.waitForTimeout(300)
await page.keyboard.down('KeyE')
await page.waitForFunction(() => (window.__testRoom.push.state?.progress ?? 0) > 0.25, null, { timeout: 60000, polling: 50 })
const state = await page.evaluate(() => window.__testRoom.push.state)
check(state?.objectId === ids.sofa, `E leans on the sofa (${state?.objectId})`)
check(await ringShown(), 'the ring shows on the sofa')
await page.screenshot({ path: join(shots, 'pushable-sofa-ring.png'), timeout: 180000 })
await page.keyboard.up('KeyE')

check(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await browser.close()
console.log(failures.length ? `${failures.length} FAILED` : 'ALL OK')
process.exit(failures.length ? 1 : 0)
