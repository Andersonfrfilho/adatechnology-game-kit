// No box of the engine holds air (CLAUDE.md §12, "nenhum colisor sem geometria"; outside CI by §9): every household object of the catalogue is laid out, and each box the
// engine holds of it (the boxes of the piece it is once it can move) is looked into by rays through the middle of its faces. A ray that goes in more than AIR without
// meeting what is drawn of the object found air held as solid: chips made in there never come to rest, and what falls on it lies on nothing. A kennel drawn as boards round
// the air was one box, with its doorway shut.
// A piece listed in KNOWN is debt counted: it may only leave the list. A piece not listed fails the run.
// Run: node build.mjs && node hollow-test.mjs [url]   (default dist/test-room.html)
import { createRequire } from 'node:module'
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
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? pathToFileURL(join(here, 'dist/test-room.html')).href

/**
 * What the script reads of a renderer piece: its root, its centre in the root and the boxes the engine holds of it (`partBoxes`, else one box of `halfExtents`).
 * @typedef {{ objectId: string; root: import('three').Object3D; centerV: import('three').Vector3; halfExtents: [number, number, number]; round?: unknown; partBoxes?: Array<{ center: [number, number, number]; half: [number, number, number]; rotation?: [number, number, number, number] }> }} EnginePiece
 */

/** Pieces whose colliders still hold air: empty since spec 019. A piece that has to enter it is debt counted, with the reason. */
const KNOWN = new Set(/** @type {string[]} */ (JSON.parse(process.env.HOLLOW_KNOWN ?? 'null') ?? []))

const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
/** @type {string[]} */
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom?.world.has('shelf') && window.__furnitureReport, null, { timeout: 180000 })
await page.evaluate(() => window.__testRoom.waitUntilReady(30))
const found = await page.evaluate(async () => {
  const r = window.__testRoom
  const T = window.__THREE
  /** How far (m) into a box a ray may go before it meets what is drawn. */
  const AIR = 0.05
  const GRID = 5
  /** The share of each face, from its middle, the rays go in by: a round leg held as the box around it leaves its corners empty, and that is the fit. */
  const MIDDLE = 0.6
  /** One or two rays go by a slit between two boards. */
  const OPEN_RAYS = 3
  /** @type {string[]} */
  const ids = window.__furnitureReport.items
  /** @type {Array<{ id: string, so: any }>} */
  const laid = []
  ids.forEach((id, i) => {
    try {
      laid.push({ id, so: r.spawn(id, [-14 + (i % 9) * 3.5, 0, 8 + Math.floor(i / 9) * 3.5], 0) })
    } catch {
      // an object the room cannot lay by itself (it needs a wall) is left out
    }
  })
  await new Promise((resolve) => setTimeout(resolve, 4000))
  /** @type {{ rayFirst(from: number[], direction: number[], length: number): { distance: number } | null }} */
  const engine = /** @type {any} */ (window).__roomPhysics.world
  /** A ray through the very middle of a face runs along an edge of a drawn cylinder's cap and three's raycast misses it: the grid is set off by a share of a cell. */
  const SKEW = 0.0731
  const caster = new T.Raycaster()
  // whatever layer a mesh draws in (a batch, the first person's), it is drawn
  caster.layers.enableAll()
  const origin = new T.Vector3()
  const direction = new T.Vector3()
  /** @type {Record<string, string[]>} */
  const out = {}
  let looked = 0
  for (const { id, so } of laid) {
    // the renderer's piece with what the engine holds of it: its centre and the boxes of its parts (internal fields of game-destruction-three, not of the public `Piece`)
    const piece = /** @type {EnginePiece | undefined} */ (/** @type {unknown} */ (r.renderer.pieces().find((/** @type {any} */ p) => p.objectId === so.objectId)))
    // a round piece (a can) is looked into by its box too: where each ray enters it is the engine's to say (a cylinder, a hull), not this script's
    if (!piece) continue
    looked++
    /** @type {any[]} */
    const meshes = []
    so.root.updateMatrixWorld(true)
    so.root.traverse((/** @type {any} */ o) => {
      if (!o.isMesh) return
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.side = T.DoubleSide
      // a mesh drawn in a batch keeps the sphere of what it was: the ray is tried against what it holds now
      o.geometry.computeBoundingSphere()
      o.geometry.computeBoundingBox()
      meshes.push(o)
    })
    const centre = piece.centerV.clone().applyQuaternion(piece.root.quaternion).add(piece.root.position)
    const boxes = piece.partBoxes ?? [{ center: [0, 0, 0], half: piece.halfExtents }]
    /** @type {string[]} */
    const air = []
    boxes.forEach((/** @type {any} */ box, /** @type {number} */ n) => {
      if (2 * Math.min(...box.half) < AIR + 0.01) return
      const turn = piece.root.quaternion.clone()
      if (box.rotation) turn.multiply(new T.Quaternion(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]))
      const at = new T.Vector3(box.center[0], box.center[1], box.center[2]).applyQuaternion(piece.root.quaternion).add(centre)
      let open = 0
      let worst = 0
      for (let axis = 0; axis < 3; axis++) for (const way of [-1, 1]) for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
        const local = [0, 0, 0]
        local[axis] = -way * (box.half[axis] + 0.01)
        local[(axis + 1) % 3] = box.half[(axis + 1) % 3] * (((i + 0.5 + SKEW) / GRID) * 2 - 1) * MIDDLE
        local[(axis + 2) % 3] = box.half[(axis + 2) % 3] * (((j + 0.5 + SKEW) / GRID) * 2 - 1) * MIDDLE
        origin.set(local[0], local[1], local[2]).applyQuaternion(turn).add(at)
        direction.set(axis === 0 ? way : 0, axis === 1 ? way : 0, axis === 2 ? way : 0).applyQuaternion(turn)
        caster.set(origin, direction)
        caster.far = 2 * box.half[axis] + 0.02
        // where the ray enters what the engine holds of the piece (its box, its cylinder, its hull): a ray that never enters it holds no air of it
        const entry = engine.rayFirst([origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], caster.far)
        if (!entry) continue
        const hit = caster.intersectObjects(meshes, false)[0]
        const deep = (hit ? hit.distance : caster.far) - entry.distance
        if (deep <= AIR) continue
        open++
        worst = Math.max(worst, deep)
      }
      if (open >= OPEN_RAYS) air.push(`box ${n} of ${boxes.length} (${box.half.map((/** @type {number} */ h) => (2 * h).toFixed(2)).join(' x ')} m): ${open} rays go up to ${worst.toFixed(2)} m in`)
    })
    if (air.length > 0) out[id] = air
  }
  return { laid: laid.length, looked, out }
})
await browser.close()

const failing = Object.keys(found.out)
const fresh = failing.filter((id) => !KNOWN.has(id))
const paid = [...KNOWN].filter((id) => !failing.includes(id))
console.log(`hollow-test: ${found.laid} objects laid, ${found.looked} are pieces; ${failing.length} hold air in a box (${fresh.length} not in the known list)`)
for (const id of failing) console.log(`  ${KNOWN.has(id) ? 'known' : 'NEW  '} ${id}: ${found.out[id].slice(0, 3).join('; ')}${found.out[id].length > 3 ? `; and ${found.out[id].length - 3} more` : ''}`)
for (const id of paid) console.log(`  PAID  ${id}: no box of it holds air any more, take it out of KNOWN`)
for (const error of errors) console.log(`  page error: ${error}`)
if (process.argv.includes('--list')) console.log(JSON.stringify(failing))
process.exit(fresh.length > 0 || paid.length > 0 || errors.length > 0 ? 1 : 0)
