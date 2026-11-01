#!/usr/bin/env node
// What every piece of the kit costs to draw. Opens the built test room and each loaded module's area, and sums, per marked piece (`markKitOrigin` of game-contracts),
// its draw calls (one per mesh and material, one more when it casts a shadow), triangles and materials. A piece seen several times counts its most expensive copy.
// budgets.json holds the most draw calls per owner (an owner not listed is a composition or an instanced batch, not one piece) and, in `pending`, the pieces already over it.
//
//   node tools/kit-audit/cost.mjs                     report, the most expensive first
//   node tools/kit-audit/cost.mjs --area vehicles_area
//   node tools/kit-audit/cost.mjs --json out.json
//   node tools/kit-audit/cost.mjs --check             exit 1 on a piece over its limit that is not pending, or a pending one that got worse (CI runs this)
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const optionOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const only = optionOf('--area')
const jsonPath = optionOf('--json')
const { chromium } = require('playwright')

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const tab = await browser.newPage({ viewport: { width: 640, height: 400 } })
await tab.goto(`${pathToFileURL(join(root, 'examples/test-room/dist/test-room.html')).href}?ui=0`)
await tab.waitForFunction(() => window.__testRoom, null, { timeout: 180000 })

const census = (area) =>
  tab.evaluate(async (area) => {
    const room = window.__testRoom
    const frames = (n) => new Promise((done) => { let k = 0; const step = () => (++k >= n ? done() : requestAnimationFrame(step)); requestAnimationFrame(step) })
    const count = () => { let n = 0; room.scene.traverse(() => n++); return n }
    if (area) await room.openAreaAsync(area)
    const until = performance.now() + 60000
    for (let last = -1; performance.now() < until; ) {
      await frames(5)
      const now = count()
      if (now === last) break
      last = now
    }
    const pieces = new Map()
    room.scene.traverse((object) => {
      if (!(object.isMesh || object.isLine || object.isPoints || object.isSprite)) return
      for (let q = object; q; q = q.parent) if (q.visible === false) return
      let holder = object
      while (holder && !holder.userData?.kitOrigin) holder = holder.parent
      if (!holder) return
      const piece = pieces.get(holder) ?? { id: holder.userData.kitOrigin.id ?? holder.name ?? '', owner: holder.userData.kitOrigin.owner ?? '', draws: 0, triangles: 0, materials: new Set() }
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const copies = object.count ?? 1
      const index = object.geometry?.index
      const vertices = index ? index.count : (object.geometry?.attributes?.position?.count ?? 0)
      piece.draws += materials.length + (object.castShadow ? 1 : 0)
      piece.triangles += Math.floor(vertices / 3) * copies
      for (const material of materials) piece.materials.add(material)
      pieces.set(holder, piece)
    })
    return {
      modules: room.modules(),
      pieces: [...pieces.values()].map((piece) => ({ ...piece, materials: piece.materials.size })),
    }
  }, area)

const started = Date.now()
const bare = await census(null)
const worst = new Map()
const take = (area, pieces) => {
  for (const piece of pieces) {
    const key = `${piece.owner}|${piece.id}`
    if ((worst.get(key)?.draws ?? -1) < piece.draws) worst.set(key, { ...piece, area })
  }
}
take('(room)', bare.pieces)
for (const area of only ? [only] : bare.modules.filter((module) => module.hasArea).map((module) => module.id)) {
  take(area, (await census(area)).pieces)
  console.error(`  ${area}: ${((Date.now() - started) / 1000).toFixed(0)} s`)
}
await browser.close()

const rows = [...worst.values()].sort((a, b) => b.draws - a.draws)
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(rows, null, 1))
console.log('draws  triangles  materials  owner / piece (area)')
for (const row of rows) console.log(`${String(row.draws).padStart(5)}  ${String(row.triangles).padStart(9)}  ${String(row.materials).padStart(9)}  ${row.owner} / ${row.id} (${row.area})`)
console.log(`\n${rows.length} pieces`)

const { limits, pending } = JSON.parse(readFileSync(join(here, 'budgets.json'), 'utf8'))
const keyOf = (row) => `${row.owner}|${row.id}`
const over = rows.filter((row) => limits[row.owner] !== undefined && row.draws > limits[row.owner])
const broken = over.filter((row) => row.draws > (pending[keyOf(row)] ?? limits[row.owner]))
const fixed = Object.keys(pending).filter((key) => !over.some((row) => keyOf(row) === key))
console.log(`${over.length} over the limit, ${over.length - broken.length} of them pending (budgets.json), ${broken.length} new or worse`)
for (const row of broken) console.log(`  NEW  ${row.owner} / ${row.id}: ${row.draws} draws (limit ${limits[row.owner]}, pending ${pending[keyOf(row)] ?? 'no'})`)
if (fixed.length > 0) console.log(`no longer over the limit, take out of pending: ${fixed.join(', ')}`)
if (args.includes('--check') && broken.length > 0) process.exit(1)
