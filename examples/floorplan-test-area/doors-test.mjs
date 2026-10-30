// The doors of a house worked by hand in the real room, with the real E key, in first and third person: the hand goes to the handle, the handle turns, the leaf swings,
// and E again closes it. Prints what happened and saves shots/doors-house-*.png.
// Run: node build.mjs && node doors-test.mjs [first|third]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright') // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const modes = process.argv[2] ? [process.argv[2]] : ['first', 'third']

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${pathToFileURL(join(here, 'dist/sala-casas.html')).href}?arena=40&table=0`)
await page.waitForFunction(() => window.__floorplanReport, null, { timeout: 240000 })

const failures = []
const check = (ok, label, data) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${data === undefined ? '' : ` ${JSON.stringify(data)}`}`)
  if (!ok) failures.push(label)
}
const shot = (name) => page.screenshot({ path: join(shots, `doors-house-${name}.png`), timeout: 180000 })
const tapE = async () => {
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(60)
  await page.keyboard.up('KeyE')
}
// stand inside the entrance, a step from the door, looking at its handle side
const standAtDoor = () =>
  page.evaluate(() => {
    const room = window.__testRoom
    const { house, plan } = window.__floorplanReport.area.houses[0]
    const V = room.camera.position.constructor
    const d = plan.doors.find((x) => x.exterior && x.floor === 0)
    const centre = plan.rooms.find((r) => r.id === d.opensTo)
    const dw = house.group.localToWorld(new V(d.u, 1.0, d.v))
    const cw = house.group.localToWorld(new V((centre.u0 + centre.u1) / 2, 1.0, (centre.v0 + centre.v1) / 2))
    const len = Math.hypot(cw.x - dw.x, cw.z - dw.z)
    room.look([dw.x + ((cw.x - dw.x) / len) * 1.2, 1.7, dw.z + ((cw.z - dw.z) / len) * 1.2], [dw.x, 1.1, dw.z])
    return d.id
  })
const doorsOpen = () => page.evaluate(() => window.__testRoom.metrics().module.doors_open)
const hand = () => page.evaluate(() => ({ door: window.__testRoom.avatarState().door, hand: window.__testRoom.handState().targets?.R?.position }))

for (const mode of modes) {
  console.log(`--- ${mode} person`)
  await page.evaluate((m) => window.__testRoom.setCameraMode(m), mode)
  const id = await standAtDoor()
  await page.waitForTimeout(500)
  const before = await doorsOpen()
  await tapE()
  await page.waitForFunction(() => window.__testRoom.avatarState().door?.phase === 'swing', null, { timeout: 60000, polling: 30 })
  const during = await hand()
  await page.waitForTimeout(300)
  await shot(`${mode}-opening`)
  check(during.door && during.hand, `E on the door ${id}: the hand is on the handle while it swings`, during)
  await page.waitForFunction(() => !window.__testRoom.avatarState().door, null, { timeout: 60000 })
  check((await doorsOpen()) === before + 1, 'the door is open', { before, after: await doorsOpen() })
  await shot(`${mode}-open`)
  // look at the doorway again from where the player stands now (the player went beside the handle)
  await page.evaluate(() => {
    const room = window.__testRoom
    const { house, plan } = window.__floorplanReport.area.houses[0]
    const d = plan.doors.find((x) => x.exterior && x.floor === 0)
    const dw = house.group.localToWorld(new (room.camera.position.constructor)(d.u, 1.1, d.v))
    const [x, , z] = room.playerPosition
    room.look([x, 1.7, z], [dw.x, 1.1, dw.z])
  })
  await tapE()
  await page.waitForFunction(() => window.__testRoom.avatarState().door?.phase === 'swing', null, { timeout: 60000, polling: 30 })
  await page.waitForFunction(() => !window.__testRoom.avatarState().door, null, { timeout: 60000 })
  check((await doorsOpen()) === before, 'E again closes it')
}

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors')
await browser.close()
if (failures.length || errors.length) process.exit(1)
