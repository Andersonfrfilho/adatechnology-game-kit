// Pushing with a load and being shoved, in the real room: the room's table pushed with cans on its top (they ride along), and zombies of the crowd area shoving a sofa
// at the player, in first and third person. Prints what happened and saves shots/push-load-*.png.
// Run: node build.mjs && node push-load-test.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = /** @type {typeof import('playwright')} */ (createRequire(import.meta.url)('playwright')) // NODE_PATH points at it, as in test.mjs
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const base = process.argv[2] ?? pathToFileURL(join(here, 'dist/test-room.html')).href
const TABLE_TOP = 0.78
const WAIT = { timeout: 90000, polling: 50 }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

/** @type {string[]} */
const failures = []
const check = (/** @type {boolean} */ ok, /** @type {string} */ label) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}
/** True once the wait settled, false when it timed out: the frames run at whatever speed the GPU gives. */
const held = (/** @type {Promise<unknown>} */ wait) => wait.then(() => true, () => false)
/** Waits for `n` drawn frames: a time in the game, not on the clock, so a slow GPU waits as long as a fast one. */
const frames = (/** @type {number} */ n) =>
  page.evaluate((count) => new Promise((done) => {
    let left = count
    const tick = () => (--left <= 0 ? done(undefined) : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  }), n)
const shot = (/** @type {string} */ name) => page.screenshot({ path: join(shots, `push-load-${name}.png`), timeout: 180000 })
const look = (/** @type {[number, number, number]} */ eye, /** @type {[number, number, number]} */ target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])
const camera = (/** @type {import('@adatechnology/game-test-room').CameraMode} */ mode) => page.evaluate((m) => window.__testRoom.setCameraMode(m), mode)
/** Where world objects stand now (the room's destruction world), in the order asked. */
const positions = (/** @type {string[]} */ ids) => page.evaluate((list) => list.map((id) => window.__testRoom.world.state(id)?.position ?? [NaN, NaN, NaN]), ids)
const pushEnded = () => held(page.waitForFunction(() => window.__testRoom.push.state === null, null, WAIT))
const open = async (/** @type {string} */ query) => {
  await page.goto(`${base}?${query}`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom?.world, null, { timeout: 180000 })
  await frames(30)
}

// 1. the room's table with two cans on its top, pushed in each camera
// the page is opened twice: in a headless run the first load of the room keeps drawing its first view while the game runs on
await open('table=0')
await open('table=0')
const cans = await page.evaluate((top) => [window.__testRoom.spawn('item_canned_beans', [3.1, top, 0.1], 0).objectId, window.__testRoom.spawn('item_canned_beans', [3.9, top, -0.1], 0).objectId], TABLE_TOP)
// water spilled on the top: the stain goes with the table
await page.evaluate((top) => window.__testRoom.fluids.splash('water', [3.5, top + 0.3, 0.2], 0.15), TABLE_TOP)
await frames(60)
const stainOnTable = () => page.evaluate(() => window.__testRoom.fluids.stains().find((s) => s.surface === 'table')?.center ?? null)
const stainStart = await stainOnTable()
/** The way along which the table can go 1.3 m with nothing in the way (the room's scenery has a car parked by it), as [x, z]. */
const freeWay = () =>
  page.evaluate(() => {
    const [x = 0, , z = 0] = window.__testRoom.world.state('table')?.position ?? []
    /** @type {{ min: [number, number, number], max: [number, number, number] }} */
    const box = { min: [x - 0.8, 0.06, z - 0.4], max: [x + 0.8, 0.74, z + 0.4] }
    /** @type {Array<[number, number]>} */
    const ways = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    return ways.find(([dx, dz]) => window.__testRoom.world.sweepBox(box, [dx, 0, dz], 1.3, { ignore: 'table' }) === null) ?? [0, -1]
  })
/** How far along `way` a position went. */
const along = (/** @type {[number, number]} */ way, /** @type {readonly number[]} */ from, /** @type {readonly number[]} */ to) => ((to[0] ?? 0) - (from[0] ?? 0)) * way[0] + ((to[2] ?? 0) - (from[2] ?? 0)) * way[1]
for (const mode of /** @type {const} */ (['first', 'third'])) {
  console.log(`--- table, ${mode} person`)
  await camera(mode)
  const [table = [0, 0, 0], ...canStart] = await positions(['table', ...cans])
  const way = /** @type {[number, number]} */ (await freeWay())
  // the player stands on the other side of the table from the way it goes, the arms' length off its face
  const off = way[0] === 0 ? 1.15 : 1.45
  await look([(table[0] ?? 0) - way[0] * off, 1.7, (table[2] ?? 0) - way[1] * off], [table[0] ?? 0, 0.6, table[2] ?? 0])
  await page.keyboard.down('KeyE')
  await held(page.waitForFunction(() => window.__testRoom.push.state?.phase === 'push', null, WAIT))
  const mass = await page.evaluate(() => window.__testRoom.push.state?.massKg ?? 0)
  check(mass > 1, `the table is pushed with the cans' mass in it (${mass.toFixed(1)} kg)`)
  if (mode === 'third') await page.evaluate((w) => { const r = window.__testRoom; const [x, , z] = r.playerPosition; r.look([x, 1.7, z], [x + w[0] * 4, 1.1, z + w[1] * 4]) }, way)
  await page.keyboard.down('KeyW')
  const pushed = await held(page.waitForFunction(([from, w]) => {
    const at = window.__testRoom.world.state('table')?.position ?? from
    return (at[0] - from[0]) * w[0] + (at[2] - from[2]) * w[1] > 1
  }, /** @type {const} */ ([[table[0] ?? 0, table[1] ?? 0, table[2] ?? 0], way]), WAIT))
  check(pushed, `W pushes the table more than 1 m (way ${way.join(', ')})`)
  // let go of W before the picture: a slow frame would keep pushing it into whatever stands farther on
  await page.keyboard.up('KeyW')
  await shot(`table-${mode}`)
  await frames(60)
  const [tableEnd = [0, 0, 0], ...canEnd] = await positions(['table', ...cans])
  const moved = along(way, table, tableEnd)
  for (const k of cans.keys()) {
    const ride = along(way, canStart[k] ?? [], canEnd[k] ?? [])
    const y = canEnd[k]?.[1] ?? 0
    check(Math.abs(ride - moved) < 0.05 && y > TABLE_TOP - 0.05, `can ${k + 1} rode with the table (${ride.toFixed(2)} m against ${moved.toFixed(2)} m) and is still on its top (y ${y.toFixed(2)})`)
  }
  if (mode === 'first') {
    const stain = await stainOnTable()
    check(stainStart !== null && stain !== null && Math.abs(along(way, stainStart, stain) - moved) < 0.02, `the water spilled on the top went with the table (${stain && stainStart ? along(way, stainStart, stain).toFixed(2) : '?'} m against ${moved.toFixed(2)} m)`)
  }
  await page.keyboard.up('KeyE')
  await pushEnded()
}

// 2. a sofa pushed against a nightstand shoves it along, and the drag scratches the concrete floor, in each camera
for (const mode of /** @type {const} */ (['first', 'third'])) {
  console.log(`--- sofa against a nightstand, ${mode} person`)
  await open('table=0')
  const [sofaId, nightstandId] = await page.evaluate(() => [window.__testRoom.spawn('sofa', [-2, 0, 6], 0).objectId, window.__testRoom.spawn('nightstand', [-2, 0, 4.6], 0).objectId])
  await page.evaluate(() => {
    const counted = /** @type {{ scrapes: number }} */ (/** @type {unknown} */ (window))
    counted.scrapes = 0
    window.__testRoom.vfx.onMarks((event) => {
      if (event.type === 'add' && event.mark.kind === 'scrape') counted.scrapes++
    })
  })
  await frames(60)
  await camera(mode)
  const [, , sofaZ = 0] = (await positions([sofaId]))[0] ?? []
  const [, , nightZ = 0] = (await positions([nightstandId]))[0] ?? []
  await look([-2, 1.7, sofaZ + 1.3], [-2, 0.6, sofaZ])
  await page.keyboard.down('KeyE')
  await held(page.waitForFunction(() => window.__testRoom.push.state?.phase === 'push', null, WAIT))
  if (mode === 'third') await page.evaluate(() => { const r = window.__testRoom; const [x, , z] = r.playerPosition; r.look([x + 0.8, 1.7, z + 0.6], [x, 0.6, z - 3]) })
  await page.keyboard.down('KeyW')
  const shoved = await held(page.waitForFunction(([id, z]) => (window.__testRoom.world.state(id)?.position[2] ?? z) < z - 0.8, /** @type {const} */ ([nightstandId, nightZ]), WAIT))
  await page.keyboard.up('KeyW')
  await shot(`chain-${mode}`)
  const chained = await page.evaluate(() => window.__testRoom.log.entries({ type: 'push_chained' }).length)
  const scrapes = await page.evaluate(() => /** @type {{ scrapes: number }} */ (/** @type {unknown} */ (window)).scrapes)
  const [sofaNow = [0, 0, 0], nightNow = [0, 0, 0]] = await positions([sofaId, nightstandId])
  check(shoved && chained === 1, `the sofa shoves the nightstand along (nightstand z ${nightZ.toFixed(2)} to ${(nightNow[2] ?? 0).toFixed(2)}, sofa z ${sofaZ.toFixed(2)} to ${(sofaNow[2] ?? 0).toFixed(2)})`)
  check(scrapes >= 2 && scrapes % 2 === 0, `the drag scratched the concrete floor (${scrapes} strips)`)
  await page.keyboard.up('KeyE')
  await pushEnded()
}

// 3. zombies born behind a sofa shove it at the player, in each camera
for (const mode of /** @type {const} */ (['first', 'third'])) {
  console.log(`--- zombies, ${mode} person`)
  // the crowd area lies 45 m out (its centre), past the room's own 14 m: the arena is opened to 60 m so the sofa may move there
  await open('area=crowd_area&table=0&arena=60')
  await held(page.waitForFunction(() => window.__testRoom.bench('crowd_area') !== null, null, { ...WAIT, timeout: 180000 }))
  await page.evaluate(() => {
    const bench = window.__testRoom.bench('crowd_area')
    bench?.set('scene', 'furniture_shove')
    bench?.act('spawn')
  })
  await camera(mode)
  const leaned = await held(page.waitForFunction(() => window.__testRoom.log.entries({ type: 'push_shoved' }).length > 0, null, { ...WAIT, timeout: 180000 }))
  check(leaned, 'the zombies lean on the sofa and it moves')
  if (!leaned) continue
  const shoved = await page.evaluate(() => {
    const entry = window.__testRoom.log.entries({ type: 'push_shoved' })[0]
    return { objectId: entry?.objectId ?? '', pushers: entry?.data?.['pushers'] }
  })
  const [from = [0, 0, 0]] = await positions([shoved.objectId])
  await held(page.waitForFunction(([id, z]) => (window.__testRoom.world.state(id)?.position[2] ?? z) > z + 0.6, /** @type {const} */ ([shoved.objectId, from[2] ?? 0]), { ...WAIT, timeout: 120000 }))
  if (mode === 'third') await page.evaluate(() => { const r = window.__testRoom; const [x, , z] = r.playerPosition; r.look([x + 0.6, 1.7, z + 0.5], [x, 0.9, z - 3]) })
  await shot(`zombies-${mode}`)
  const [sofa = [0, 0, 0]] = await positions([shoved.objectId])
  const player = await page.evaluate(() => window.__testRoom.playerPosition)
  check((sofa[2] ?? 0) > (from[2] ?? 0) + 0.3, `the sofa went toward the player (z ${(from[2] ?? 0).toFixed(2)} to ${(sofa[2] ?? 0).toFixed(2)}), pushed by ${String(shoved.pushers ?? '?')} bodies`)
  check((sofa[2] ?? 0) < player[2], `it stops at the player and does not go through (sofa z ${(sofa[2] ?? 0).toFixed(2)}, player z ${player[2].toFixed(2)})`)
}

check(errors.length === 0, `no page errors ${errors.join(' | ')}`)
await browser.close()
console.log(failures.length ? `${failures.length} FAILED` : 'ALL OK')
process.exit(failures.length ? 1 : 0)
