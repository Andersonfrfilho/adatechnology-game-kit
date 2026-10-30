// Opening by hand in the real room, with the real E key, in first and third person: a fridge, a wardrobe, a microwave, a car door, a locked wardrobe and a door
// that hits a nightstand. Prints what happened and saves shots/doors-*.png.
// Run: node build.mjs && node doors-test.mjs [url] [first|third]   (default dist/test-room.html, both views)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright') // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : pathToFileURL(join(here, 'dist/test-room.html')).href
const modes = process.argv[3] ? [process.argv[3]] : ['first', 'third']

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${base}?scene=doors&table=0`)
await page.waitForFunction(() => window.__testRoom && window.__testRoom.spawned().some((s) => s.itemId === 'sedan'), null, { timeout: 240000 })
await page.waitForTimeout(1500)

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
const shot = (name) => page.screenshot({ path: join(shots, `doors-${name}.png`), timeout: 180000 })
const look = (eye, target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])
/** Looks from where the player stands now (it walked to the handle) at a point. */
const lookFromHere = (target) => page.evaluate((t) => { const r = window.__testRoom; const [x, , z] = r.playerPosition; r.look([x, 1.7, z], t) }, target)
/** The world box of a spawned object: [min, max]. */
const boxOf = (objectId) => page.evaluate((o) => { const r = window.__testRoom; const s = r.spawned().find((x) => x.objectId === o); const b = new window.__THREE.Box3().setFromObject(s.root); return [b.min.toArray(), b.max.toArray()] }, objectId)
const camera = (mode) => page.evaluate((m) => window.__testRoom.setCameraMode(m), mode)
const ids = await page.evaluate(() => window.__testRoom.spawned().map((s) => ({ id: s.objectId, item: s.itemId, at: [s.root.position.x, s.root.position.y, s.root.position.z] })))
const idOf = (item, n = 0) => ids.filter((s) => s.item === item)[n]
const opening = (objectId, part) => page.evaluate(([o, p]) => window.__testRoom.leafOpening(o, p), [objectId, part])
const door = () => page.evaluate(() => window.__testRoom.door)
const lastAction = (type) => page.evaluate((t) => window.__testRoom.log.entries().filter((e) => e.type === t).length, type)
/** A tap of E (shorter than the push hold), then waits for the hand to let go. */
const tapE = async () => {
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(60)
  await page.keyboard.up('KeyE')
}
const waitPhase = (phase) =>
  page.waitForFunction((p) => window.__testRoom.door?.phase === p || window.__testRoom.log.entries().slice(-1)[0]?.type === 'door_blocked', phase, { timeout: 90000, polling: 30 }).catch(async (e) => {
    console.log('waiting for', phase, JSON.stringify(await page.evaluate(() => ({ door: window.__testRoom.door, log: window.__testRoom.log.entries().slice(-5).map((x) => `${x.type} ${x.text} ${JSON.stringify(x.data ?? {})}`) }))))
    throw e
  })
const waitIdle = () => page.waitForFunction(() => window.__testRoom.door === null, null, { timeout: 60000, polling: 50 })
const leaves = await page.evaluate((list) => Object.fromEntries(list.map((s) => [s.id, window.__testRoom.leaves(s.id)])), ids)
console.log('leaves', JSON.stringify(leaves))

for (const mode of modes) {
  console.log(`--- ${mode} person`)
  await camera(mode)
  // the fridge: the door comes toward the player, the hand on the handle
  const fridge = idOf('fridge')
  await look([fridge.at[0] + 0.1, 1.7, fridge.at[2] + 1.25], [fridge.at[0] + 0.2, 1.0, fridge.at[2] + 0.35])
  const aimedPart = await page.evaluate(() => window.__testRoom.inspectInfo()?.part)
  await tapE()
  await waitPhase('swing')
  const st = await door()
  await page.waitForFunction(([o, p]) => window.__testRoom.leafOpening(o, p) > 0.45, [fridge.id, st?.part ?? 'door_fridge'], { timeout: 60000 })
  await shot(`${mode}-fridge-opening`)
  check(st && st.objectId === fridge.id, `E on the fridge (aimed part ${aimedPart}) works its door ${st?.part}`)
  await waitIdle()
  const fridgePart = st?.part ?? 'door_fridge'
  check((await opening(fridge.id, fridgePart)) > 0.95, `the fridge door ends open (${(await opening(fridge.id, fridgePart)).toFixed(2)})`)
  await shot(`${mode}-fridge-open`)
  await lookFromHere([fridge.at[0], 1.0, fridge.at[2] + 0.1])
  await tapE()
  await waitIdle()
  check((await opening(fridge.id, fridgePart)) < 0.05, 'a second E closes it')

  // the wardrobe: aim at one door
  const wr = idOf('wardrobe', 0)
  await look([wr.at[0], 1.7, wr.at[2] + 1.4], [wr.at[0] - 0.25, 1.2, wr.at[2]])
  await tapE()
  await waitPhase('swing')
  const wst = await door()
  await waitIdle()
  check(wst?.objectId === wr.id && (await opening(wr.id, wst.part)) > 0.95, `E opens the wardrobe's ${wst?.part}`)
  await shot(`${mode}-wardrobe-open`)
  await lookFromHere([wr.at[0], 1.2, wr.at[2] + 0.1])
  await tapE()
  await waitIdle()

  // locked: rattles, does not move
  const lk = idOf('wardrobe', 1)
  await look([lk.at[0], 1.7, lk.at[2] + 1.4], [lk.at[0] - 0.25, 1.2, lk.at[2]])
  const lockedBefore = await lastAction('door_locked')
  await tapE()
  await waitPhase('rattle')
  await page.waitForTimeout(150)
  await shot(`${mode}-locked-rattle`)
  await waitIdle()
  check((await lastAction('door_locked')) > lockedBefore, 'the locked wardrobe rattles (logged)')
  check((await page.evaluate((o) => Math.max(...window.__testRoom.leaves(o).map((p) => window.__testRoom.leafOpening(o, p))), lk.id)) === 0, 'and none of its doors moves')

  // a door that hits the nightstand in front of it stops short
  const bl = idOf('wardrobe', 2)
  await look([bl.at[0] + 0.3, 1.7, bl.at[2] + 1.5], [bl.at[0] - 0.3, 1.2, bl.at[2]])
  const blockedBefore = await lastAction('door_blocked')
  await tapE()
  await waitIdle()
  const bst = await page.evaluate((o) => window.__testRoom.leaves(o).map((p) => [p, window.__testRoom.leafOpening(o, p)]), bl.id)
  const moved = bst.filter(([, v]) => v > 0)
  check((await lastAction('door_blocked')) > blockedBefore && moved.length === 1 && moved[0][1] < 0.9, `the door hits the barbecue and stops at ${moved.map(([p, v]) => `${p} ${v.toFixed(2)}`).join(', ')}`)
  await shot(`${mode}-blocked`)
  // close it again for the next run
  await lookFromHere([bl.at[0] - 0.3, 1.2, bl.at[2] + 0.3])
  await tapE()
  await waitIdle()

  // the microwave on the table
  const mw = idOf('microwave')
  const [mwMin, mwMax] = await boxOf(mw.id)
  const mwFront = [(mwMin[0] + mwMax[0]) / 2 - 0.08, (mwMin[1] + mwMax[1]) / 2, mwMax[2]]
  await look([mwFront[0], 1.6, mwFront[2] + 0.8], mwFront)
  await tapE()
  await waitIdle()
  check((await opening(mw.id, 'door')) > 0.95, 'E opens the microwave')
  await shot(`${mode}-microwave-open`)
  await lookFromHere([mwFront[0], mwFront[1], mwFront[2] - 0.15])
  await tapE()
  await waitIdle()

  // the car: the door the eye rests on, not all of them
  const car = idOf('sedan')
  const carLeaves = leaves[car.id] ?? []
  await look([car.at[0] - 0.5, 1.65, car.at[2] - 1.9], [car.at[0] - 0.5, 0.95, car.at[2] - 0.8])
  const carAim = await page.evaluate(() => window.__testRoom.inspectInfo()?.part)
  await tapE()
  await waitPhase('swing')
  const cst = await door()
  await page.waitForTimeout(500)
  await shot(`${mode}-car-opening`)
  await waitIdle()
  const carOpen = await page.evaluate(([o, list]) => list.map((p) => [p, window.__testRoom.leafOpening(o, p)]).filter(([, v]) => v > 0), [car.id, carLeaves])
  check(cst?.objectId === car.id && carOpen.length === 1, `E opens one door of the car (aimed ${carAim}): ${carOpen.map(([p, v]) => `${p} ${v.toFixed(2)}`).join(', ')}`)
  await shot(`${mode}-car-open`)
  await lookFromHere([car.at[0] - 0.5, 0.95, car.at[2] - 0.8])
  await tapE()
  await waitIdle()
}

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors')
await browser.close()
if (failures.length || errors.length) process.exit(1)
