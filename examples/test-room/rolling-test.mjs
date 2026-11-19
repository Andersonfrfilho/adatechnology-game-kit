// How far and how long round things roll after they fall off a table (outside CI by CLAUDE.md §9): a glass bottle, a steel can and a wooden bat (and a broomstick)
// are let go lying on their side at the height of a table, moving off its edge at TABLE_SPEED, on the room's concrete slab and on a lawn. Each is watched until
// it sleeps or nearly stops (or MAX_SECONDS, of the renderer's own clock); the table of time, distance and path is printed and the last one (the can) is shot where it
// stopped: shots/rolling-<label>-<ground>.png, the numbers in shots/rolling-<label>.json. A last run kicks a stopped can (impulse) to check it rolls again. The slope is
// the unit tests' (`rolling-by-material.test.ts`, `game-physics-jolt` `rolling-damping.test.ts`): the room has no ramp to roll down.
// Run: node build.mjs && node rolling-test.mjs [url]   (default dist/test-room.html; the 4280 serves http://localhost:4280/test-room.html)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
/** Playwright from NODE_PATH (browser-checks sets it), else the workspace's playwright-core. @returns {typeof import('playwright')} */
const loadPlaywright = () => {
  try {
    return require('playwright')
  } catch {
    return require('playwright-core')
  }
}
const { chromium } = loadPlaywright()
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const args = process.argv.slice(2)
const base = args.find((a) => !a.startsWith('--')) ?? pathToFileURL(join(here, 'dist/test-room.html')).href
const label = args.find((a) => a.startsWith('--label='))?.split('=')[1] ?? 'run'
const ITEMS = ['item_broomstick', 'item_baseball_bat', 'item_glass_bottle', 'item_soda_can']
const GROUNDS = ['concrete_slab', 'lawn']
/** Height (m) of the table top and the speed (m/s) a thing leaves its edge with. */
const TABLE_HEIGHT = 0.78
const TABLE_SPEED = 1.2
const MAX_SECONDS = 40

const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom?.world, null, { timeout: 180000 })
await page.evaluate(() => window.__testRoom.waitUntilReady(30))
// the time the pieces were stepped by (the renderer's own clock), not the wall's: a loaded machine draws fewer frames, not a slower world
await page.evaluate(() => {
  const r = window.__testRoom
  const step = r.renderer.update.bind(r.renderer)
  window.__simSeconds = 0
  r.renderer.update = (/** @type {number} */ dt) => {
    window.__simSeconds += dt
    step(dt)
  }
})

/** @type {Array<{ ground: string; item: string; seconds: number; distance: number; path: number; asleep: boolean }>} */
const rows = []
for (const ground of GROUNDS) {
  for (const item of ITEMS) {
    const row = await page.evaluate(
      async ({ ground, item, height, speed, maxSeconds }) => {
        const r = window.__testRoom
        const THREE = window.__THREE
        r.clear()
        r.terrain.setLayout({ surface: ground })
        const at = [6, height, 6]
        const spawned = r.spawn(item, /** @type {[number, number, number]} */ (at), 0)
        const root = spawned.root
        // lying on its side, its long axis across the way it rolls (x): a bottle's axis along z
        const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
        const long = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z'
        if (long === 'y') root.rotation.set(Math.PI / 2, 0, 0)
        if (long === 'x') root.rotation.set(0, Math.PI / 2, 0)
        root.position.set(at[0], height + 0.06, at[2])
        root.updateMatrixWorld(true)
        const piece = r.renderer.makePiece(spawned.objectId, { velocity: [speed, 0, 0] })
        const start = root.position.clone()
        const wait = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
        const t0 = window.__simSeconds
        let still = 0
        let seconds = maxSeconds
        let asleep = false
        let path = 0
        let last = root.position.clone()
        while (window.__simSeconds - t0 < maxSeconds) {
          await wait()
          const v = Math.hypot(piece.velocity[0], piece.velocity[1], piece.velocity[2])
          const w = Math.hypot(piece.angularVelocity[0], piece.angularVelocity[1], piece.angularVelocity[2])
          path += Math.hypot(root.position.x - last.x, root.position.z - last.z)
          last = root.position.clone()
          still = v < 0.03 && w < 0.5 ? still + 1 : 0
          if (piece.sleeping || still >= 20) {
            seconds = window.__simSeconds - t0
            asleep = piece.sleeping
            break
          }
        }
        const p = root.position
        return { ground, item, seconds: Math.round(seconds * 10) / 10, distance: Math.round(Math.hypot(p.x - start.x, p.z - start.z) * 100) / 100, path: Math.round(path * 100) / 100, asleep }
      },
      { ground, item, height: TABLE_HEIGHT, speed: TABLE_SPEED, maxSeconds: MAX_SECONDS },
    )
    rows.push(row)
    console.log(`${row.ground.padEnd(14)} ${row.item.padEnd(13)} ${String(row.seconds).padStart(5)} s ${String(row.distance).padStart(6)} m (path ${row.path} m) ${row.asleep ? 'asleep' : 'still'}`)
  }
  // a shot of the last one (the can) where it stopped, close, with the run's numbers over the page
  await page.evaluate(
    ({ lines, title }) => {
      const r = window.__testRoom
      const objects = r.spawned()
      const p = objects[objects.length - 1]?.root.position ?? { x: 6, y: 0, z: 6 }
      r.look([p.x - 0.9, 0.55, p.z + 0.9], [p.x, 0.03, p.z])
      document.getElementById('rolling-report')?.remove()
      const box = document.createElement('pre')
      box.id = 'rolling-report'
      box.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:99999;margin:0;padding:10px 14px;background:rgba(0,0,0,.78);color:#fff;font:14px/1.45 monospace;border-radius:6px'
      box.textContent = [title, ...lines].join('\n')
      document.body.appendChild(box)
    },
    {
      title: `${label}: ${ground}, solto da mesa (${TABLE_HEIGHT} m) a ${TABLE_SPEED} m/s; tempo e distância até parar`,
      lines: rows.filter((r) => r.ground === ground).map((r) => `${r.item.replace('item_', '').padEnd(13)} ${String(r.seconds).padStart(4)} s  ${String(r.distance).padStart(5)} m  (caminho ${r.path} m)`),
    },
  )
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(shots, `rolling-${label}-${ground}.png`) })
}

// a can let go on the floor until it sleeps, then kicked across its axis: it rolls again
const ramp = await page.evaluate(async () => {
  const r = window.__testRoom
  r.clear()
  r.terrain.setLayout({ surface: 'concrete_slab' })
  const wait = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const spawned = r.spawn('item_soda_can', [6, 0.2, 6], 0)
  spawned.root.rotation.set(Math.PI / 2, 0, 0)
  spawned.root.updateMatrixWorld(true)
  const piece = r.renderer.makePiece(spawned.objectId, { velocity: [0, 0, 0] })
  await wait(4000)
  const rest = spawned.root.position.clone()
  const restSleeping = piece.sleeping
  // a kick across its axis, at its middle: it must roll on
  r.renderer.impulse(spawned.objectId, [0.4 * piece.mass, 0, 0], [rest.x, rest.y, rest.z])
  await wait(300)
  const kickedSpeed = Math.hypot(piece.velocity[0], piece.velocity[2])
  await wait(5000)
  const after = spawned.root.position
  return { restSleeping, kickedSpeed: Math.round(kickedSpeed * 100) / 100, rolledAfterKick: Math.round(Math.hypot(after.x - rest.x, after.z - rest.z) * 100) / 100 }
})
console.log(`kick: asleep before ${ramp.restSleeping}, speed after kick ${ramp.kickedSpeed} m/s, rolled ${ramp.rolledAfterKick} m`)
writeFileSync(join(shots, `rolling-${label}.json`), JSON.stringify({ rows, kick: ramp, errors }, null, 2))
if (errors.length) console.log('page errors:', errors)
await browser.close()
