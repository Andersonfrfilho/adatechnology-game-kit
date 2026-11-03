#!/usr/bin/env node
// Where every drawn thing in the test room comes from. Opens the built test room (examples/test-room/dist/test-room.html, with every module of the kit),
// then the room alone and each loaded module's area, and lists every visible mesh, line, point cloud or sprite that no builder of the kit marked
// (`markKitOrigin` of game-contracts): what was drawn on the spot instead of coming from the SDK that owns that kind of piece. The source check
// (audit.mjs) reads the code; this one reads the screen, so a box drawn in place of a model is found whatever the code calls it.
//
//   node tools/kit-audit/scene.mjs            report
//   node tools/kit-audit/scene.mjs --check    exit 1 on an unmarked drawing that is not pending in allowlist.json (`drawn`) — CI runs this
//   node tools/kit-audit/scene.mjs --area weapons_area
//
// A drawing is reported under the first screen that shows it, so a `drawn` entry names that area (or `*`).
//
// Pieces drawn as a stand-in shape because the kit has no model yet (`standIn`, the items without a team model) are counted, not failed.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const check = args.includes('--check')
const only = args.includes('--area') ? args[args.indexOf('--area') + 1] : null
const page = join(root, 'examples/test-room/dist/test-room.html')
if (!existsSync(page)) {
  console.error('examples/test-room/dist/test-room.html is missing: run node examples/test-room/build.mjs first')
  process.exit(2)
}
const { chromium } = (() => {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* the next one */
    }
  }
  throw new Error('playwright not found (set NODE_PATH or install it)')
})()

const { drawn = [] } = JSON.parse(readFileSync(join(here, 'allowlist.json'), 'utf8'))
const pendingOf = (area, path) => drawn.find((entry) => (entry.area === '*' || entry.area === area) && new RegExp(entry.match).test(path))

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const url = `${pathToFileURL(page).href}?ui=0`

// one page for every area: the room clears what an area spawned when the next one opens (loading the page again for each area made the check take ~40 min)
const tab = await browser.newPage({ viewport: { width: 640, height: 400 } })
await tab.goto(url, { timeout: 180000 })
await tab.waitForFunction(() => window.__testRoom, null, { timeout: 180000 })

/** Opens an area (none: the room as it starts), waits until the scene stops growing, and returns the unmarked drawings grouped by path, and the stand-ins. */
const census = (area) =>
  tab.evaluate(async (area) => {
    const room = window.__testRoom
    const frames = (n) => new Promise((done) => { let k = 0; const step = () => (++k >= n ? done() : requestAnimationFrame(step)); requestAnimationFrame(step) })
    const count = () => { let n = 0; room.scene.traverse(() => n++); return n }
    if (area) await room.openAreaAsync(area)
    // modules build some of their area over a few frames: wait until the scene stops growing, at most 60 s (a frame of the vehicles area takes seconds in software GL)
    const until = performance.now() + 60000
    for (let last = -1; performance.now() < until; ) {
      await frames(5)
      const now = count()
      if (now === last) break
      last = now
    }
    const unmarked = {}
    const standIns = new Set()
    const pathOf = (o) => { const names = []; for (let q = o; q && q !== room.scene; q = q.parent) names.push(q.name || `(${q.type})`); return names.reverse().join(' > ') }
    room.scene.traverse((o) => {
      if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return
      for (let q = o; q; q = q.parent) if (q.visible === false) return
      let origin = null
      for (let q = o; q && !origin; q = q.parent) origin = q.userData?.kitOrigin ?? null
      if (origin) {
        if (origin.standIn) standIns.add(origin.id ?? origin.owner)
        return
      }
      const path = pathOf(o)
      unmarked[path] = (unmarked[path] ?? 0) + 1
    })
    return { modules: room.modules(), unmarked, standIns: [...standIns] }
  }, area)

const started = Date.now()
const bare = await census(null)
const areas = only ? [only] : bare.modules.filter((m) => m.hasArea).map((m) => m.id)
const results = [{ area: '(room)', ...bare }]
for (const area of areas) {
  results.push({ area, ...(await census(area)) })
  console.error(`  ${area}: ${((Date.now() - started) / 1000).toFixed(0)} s`)
}
await browser.close()

let fresh = 0
let pending = 0
const seen = new Set()
for (const { area, unmarked, standIns } of results) {
  const lines = []
  for (const [path, n] of Object.entries(unmarked)) {
    // a drawing is reported once, under the first screen that showed it (the room's own, or what a module keeps between areas)
    if (seen.has(path)) continue
    seen.add(path)
    const known = pendingOf(area === '(room)' ? 'room' : area, path)
    if (known) pending += n
    else fresh += n
    lines.push(`  ${known ? 'pendente' : 'NOVO    '} ${n} × ${path}${known ? `  →  ${known.fix}` : ''}`)
  }
  if (lines.length || standIns.length) {
    console.log(`\n${area}${standIns.length ? ` (${standIns.length} itens ainda em forma simples: ${standIns.slice(0, 8).join(', ')}${standIns.length > 8 ? '…' : ''})` : ''}`)
    for (const line of lines.sort()) console.log(line)
  }
}
console.log(`\n${fresh} desenhos novos sem origem no kit, ${pending} pendentes conhecidos (allowlist.json, drawn), ${results.length} telas abertas`)
if (check && fresh > 0) {
  console.error('\nPeça desenhada fora do SDK dono: use a peça do kit (CLAUDE.md, "Nada desenhado à mão"), marque o construtor do kit com markKitOrigin, ou liste em drawn de tools/kit-audit/allowlist.json com a correção.')
  process.exit(1)
}
