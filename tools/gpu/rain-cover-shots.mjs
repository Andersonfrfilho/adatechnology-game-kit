// Prints of the rain cover (`chuva-coberta-*.png`): a car in a storm seen from outside and from the driver's seat, and a house with a porch.
// The vehicles page and the floorplan page get the weather area injected, so the storm draws the rain curtain and the near rain on top of the roofs the areas feed.
// Run (machine busy: one browser at a time, short): flock ~/.cache/adatechnology-game-kit/perf-measure.lock nice node tools/gpu/rain-cover-shots.mjs [outDir]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openRoomPage } from '../check-area/contact-sheet.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = resolve(process.argv[2] ?? join(root, 'examples/weather-test-area/shots'))
const require = createRequire(import.meta.url)
const { chromium } = /** @type {Partial<typeof import('playwright')>} */ (['playwright', 'playwright-core'].map((id) => { try { return require(id) } catch { return undefined } }).find(Boolean) ?? {})
if (!chromium) throw new Error('playwright not found')
mkdirSync(outDir, { recursive: true })

/** Opens a room page, loads the weather area into it and makes it storm. */
async function stormyPage(pageFile) {
  const opened = await openRoomPage({ chromium, pageFile })
  // the machine is busy and the swiftshader frame slow: a smaller picture
  await opened.page.setViewportSize({ width: 1100, height: 650 })
  await opened.page.addScriptTag({ path: join(root, 'examples/weather-test-area/dist/weather-area.js') })
  await opened.page.evaluate(() => {
    const room = /** @type {any} */ (window).__testRoom
    const report = /** @type {any} */ (window).WeatherArea.loadInto(room)
    for (let t = 0; t < 0.3; t += 0.05) room.update(0.05)
    const bench = room.bench('weather_area')
    if (!bench) throw new Error(`the weather area has no bench: ${JSON.stringify(report)}`)
    bench.set('state', 'storm')
  })
  return opened
}

/**
 * Stands the player at `stand` (the rain falls round the player's camera), steps the room for `seconds`, then draws it from `eye` looking at `target`
 * (the debug camera: the player's camera and the rain round it stay) and takes the picture without the panels.
 */
async function shoot(page, file, stand, eye, target, seconds = 6) {
  await page.evaluate(([at, from, to, run]) => {
    const room = /** @type {any} */ (window).__testRoom
    for (const element of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('body *'))) {
      if (element.tagName !== 'CANVAS' && !element.querySelector('canvas') && ['fixed', 'absolute'].includes(getComputedStyle(element).position)) element.style.display = 'none'
    }
    room.walk(at, 0.2)
    for (let t = 0; t < run; t += 0.05) room.update(0.05)
    room.setDebugCamera({ position: from, target: to, fov: 62 })
    for (let t = 0; t < 0.4; t += 0.05) room.update(0.05)
  }, [stand, eye, target, seconds])
  await page.screenshot({ path: join(outDir, file), timeout: 240000 })
  console.log(`shot ${file}`)
}

const vehicles = await stormyPage(join(root, 'examples/vehicles-test-area/dist/sala-veiculos.html'))
try {
  const car = await vehicles.page.evaluate(() => {
    const room = /** @type {any} */ (window).__testRoom
    const spawned = room.spawn('sedan', [14, 0, -14], 0)
    const at = spawned.root.position
    return { id: spawned.objectId, at: [at.x, at.y, at.z], cover: room.rainCover.coverTopAt(at.x, at.z) ?? null, beside: room.rainCover.coverTopAt(at.x + 6, at.z) ?? null }
  })
  console.log('car', JSON.stringify(car))
  const [x, , z] = car.at
  // outside: the storm falls on the glass and the roof, a step away it falls on the ground
  await shoot(vehicles.page, 'chuva-coberta-carro-fora.png', [x, 0, z - 3], [x - 3.6, 1.7, z - 5.2], [x, 1.1, z])
  // inside: from the driver's seat, forward through the windshield: dry in the cabin, wet on the glass outside
  await shoot(vehicles.page, 'chuva-coberta-carro-dentro.png', [x - 3, 0, z], [x - 0.35, 1.2, z + 0.1], [x - 0.3, 1.1, z + 6], 1)
  console.log('errors', JSON.stringify(vehicles.errors.slice(0, 5)))
} finally {
  await vehicles.browser.close()
}

// the log cabin of the rural pack: its porch has a roof of its own, lower than the house's
const houses = await stormyPage(join(root, 'examples/floorplan-test-area/dist/sala-casas.html'))
try {
  await houses.page.waitForFunction(() => /** @type {any} */ (window).__floorplanReport, null, { timeout: 120000 })
  const found = await houses.page.evaluate(() => {
    const room = /** @type {any} */ (window).__testRoom
    const bench = room.bench('floorplan_area')
    bench.set('package', 'rural')
    bench.set('template', 'log_cabin')
    bench.set('seed', 1)
    bench.act('build')
    // the house is cut over several frames: wait until the room has drawn it
    for (let tries = 0; tries < 150; tries++) room.update(0.1)
    for (let t = 0; t < 1; t += 0.05) room.update(0.05)
    const { house } = /** @type {any} */ (window).__floorplanReport.area.houses[0]
    const porch = house.r.rooms.find((/** @type {any} */ candidate) => candidate.type === 'porch')
    const Vector3 = house.group.position.constructor
    const at = house.group.localToWorld(new Vector3((porch.u0 + porch.u1) / 2, 0, (porch.v0 + porch.v1) / 2))
    const outside = house.group.localToWorld(new Vector3((porch.u0 + porch.u1) / 2 - 6, 0, porch.v1 + 4))
    return { porch: [at.x, at.z], outside: [outside.x, outside.z], covered: room.rainCover.coverTopAt(at.x, at.z) ?? null, open: room.rainCover.coverTopAt(outside.x, outside.z) ?? null }
  })
  console.log('house', JSON.stringify(found))
  const [px, pz] = found.porch
  // under the porch roof: dry floor, looking out at the rain that falls beyond its edge
  await shoot(houses.page, 'chuva-coberta-varanda.png', [px, 0, pz], [px, 1.7, pz], [px, 1.1, pz + 8], 6)
  console.log('errors', JSON.stringify(houses.errors.slice(0, 5)))
} finally {
  await houses.browser.close()
}
