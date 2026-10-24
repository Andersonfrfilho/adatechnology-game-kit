// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/floorplan-area.js')
const page = join(here, 'dist/sala-casas.html')
if (!existsSync(bundle)) throw new Error('dist/floorplan-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('floorplan_area')) throw new Error('the bundle does not carry the floorplan_area module')
for (const id of ['house_one_pillar', 'house_gas_explodes', 'floorplan_typologies', 'single_storey_a', 'log_cabin', 'triage_tent', 'planLod', 'addBlocker']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('FloorplanArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-casas.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads with a wide arena, the contract report is clean, a house stands in the room's destruction world, the walls stop the walk,
// the door opens with E, the floors go up and down, the level of detail follows the budget, the bench hit brings the wall down, and the six scenarios of the team's house area pass.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const playwright = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright || !existsSync(page)) {
  console.log('skipped the browser check (no playwright or no room page)')
} else {
  const shots = join(here, 'shots')
  mkdirSync(shots, { recursive: true })
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
  const errors = []
  const external = []
  let failed = 0
  const check = (name, ok, detail) => {
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
  for (const lang of ['pt-BR', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (/^(file|data|blob|about):/.test(url)) return route.continue()
      external.push(url)
      return route.abort()
    })
    const tab = await context.newPage()
    tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}&arena=40`)
    await tab.waitForFunction(() => window.__floorplanReport, null, { timeout: 90000 })
    const frames = (seconds) => tab.evaluate((s) => { for (let t = 0; t < s; t += 0.05) window.__testRoom.update(0.05) }, seconds)
    await frames(1)
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `floorplan-${lang}.png`) })

    const loaded = await tab.evaluate(() => {
      const report = window.__floorplanReport
      const room = window.__testRoom
      const checks = room.log.entries({ channel: 'check' }).filter((e) => e.data?.module === report.module)
      return { ok: report.ok, items: report.items, scenarios: report.scenarios, problems: report.problems, checks: checks.length, failedChecks: checks.filter((e) => e.type !== 'pass').map((e) => e.text), houses: report.area.houses.length, parts: room.metrics().module.parts, bench: room.bench('floorplan_area').controls().map((c) => c.id) }
    })
    check(`[${lang}] contract report is clean: 5 specimens, 7 scenarios, every check passed`, loaded.ok && loaded.problems.length === 0 && loaded.items.length === 5 && loaded.scenarios.length === 7 && loaded.failedChecks.length === 0 && loaded.checks > 0, loaded)
    check(`[${lang}] the first house stands in the room's world (one house, over 100 parts)`, loaded.houses === 1 && Number(loaded.parts) > 100, { houses: loaded.houses, parts: loaded.parts })
    // the houses are drawn with the interactables kit through the default adapter (game-floorplan-interactables), with no adapter injected by the page
    const kit = await tab.evaluate(() => {
      const iv = window.__floorplanReport.area.houses[0].house.interactives
      if (!iv || !iv.active) return { active: false }
      const types = new Set([...iv.entries.values()].map((e) => e.type))
      return { active: true, entries: iv.entries.size, interactables: iv.interactables().length, types: ['fridge', 'wall_socket', 'wall_switch'].filter((t) => types.has(t)), lamps: iv.plane.items.filter((e) => e.type === 'lamp').length, warnings: iv.warnings, adapter: iv.kit.A.version }
    })
    check(`[${lang}] the first house is made of kit objects: fridge, sockets, switches and the lamps of the rooms, built by the package's default adapter`, kit.active && kit.entries > 30 && kit.interactables > 10 && kit.types.length === 3 && kit.lamps > 0 && kit.warnings.length === 0 && kit.adapter === '0.3.0', kit)
    check(`[${lang}] the bench lists the package, the typology, the state, the seed and the actions`, ['package', 'template', 'state', 'seed', 'houses', 'budget', 'build', 'enter', 'up', 'down', 'door', 'strike'].every((id) => loaded.bench.includes(id)), loaded.bench)

    // the four packages: pick a typology of each and build it
    const packages = await tab.evaluate(() => {
      const bench = window.__testRoom.bench('floorplan_area')
      const area = window.__floorplanReport.area
      const out = {}
      for (const group of area.groups()) {
        bench.set('package', group.id)
        const template = bench.value('template')
        area.build()
        const house = area.houses[0]
        out[group.id] = { template, parts: house.house.structure.parts.length, floors: house.plan.floors.length, templates: group.templates.length }
      }
      return out
    })
    check(`[${lang}] each package builds its first typology (residential, commercial, rural, post-apocalyptic)`, ['residential', 'commercial', 'rural', 'post_apocalyptic'].every((id) => packages[id] && packages[id].parts > 0), packages)
    await frames(0.5)

    // walk in: the wall stops the player, the open space does not
    const walk = await tab.evaluate(async () => {
      const room = window.__testRoom
      const bench = room.bench('floorplan_area')
      bench.set('package', 'residential')
      bench.set('template', 'single_storey_a')
      bench.set('seed', 1)
      bench.act('build')
      for (let i = 0; i < 40; i++) room.update(0.05)
      const area = window.__floorplanReport.area
      const { house, plan } = area.houses[0]
      bench.act('enter')
      for (let i = 0; i < 5; i++) room.update(0.05)
      const THREE_V = room.camera.position.constructor
      const local = () => { const v = new THREE_V(room.camera.position.x, 0.5, room.camera.position.z); house.group.worldToLocal(v); return v }
      const start = local()
      const inside = start.x > 0 && start.x < plan.w && start.z > 0 && start.z < plan.d
      // walk in short hops toward a point past the left wall: the hop that would enter the wall is refused
      for (let hop = 0; hop < 40; hop++) {
        const cur = local()
        const to = house.group.localToWorld(new THREE_V(cur.x - 0.25, 0, start.z))
        room.walk([to.x, 0, to.z], 0.1)
        for (let i = 0; i < 8; i++) room.update(0.05)
      }
      const end = local()
      return { inside, start: [start.x, start.z], end: [end.x, end.z], width: plan.w }
    })
    check(`[${lang}] standing inside the house, the walls stop the walk toward the outside`, walk.inside && walk.end[0] > -0.1 && walk.end[0] < walk.width, walk)

    // E opens the door in reach; the door in front of the player is found by the target
    const door = await tab.evaluate(async () => {
      const room = window.__testRoom
      const bench = room.bench('floorplan_area')
      const { house, plan } = window.__floorplanReport.area.houses[0]
      const THREE_V = room.camera.position.constructor
      const d = plan.doors.find((x) => x.exterior && x.floor === 0)
      const centre = plan.rooms.find((r) => r.id === d.opensTo)
      const dw = house.group.localToWorld(new THREE_V(d.u, 1.6, d.v))
      const cw = house.group.localToWorld(new THREE_V((centre.u0 + centre.u1) / 2, 1.6, (centre.v0 + centre.v1) / 2))
      const len = Math.hypot(cw.x - dw.x, cw.z - dw.z)
      room.look([dw.x + ((cw.x - dw.x) / len) * 0.9, 1.7, dw.z + ((cw.z - dw.z) / len) * 0.9], [dw.x, 1.5, dw.z])
      for (let i = 0; i < 12; i++) room.update(0.05)
      const before = room.metrics().module.doors_open
      const aim = room.metrics().module.target
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
      for (let i = 0; i < 20; i++) room.update(0.05)
      return { before, aim, after: room.metrics().module.doors_open }
    })
    check(`[${lang}] the door in reach is named by the target and E opens it`, door.before === 0 && door.after >= 1 && String(door.aim).length > 2, door)

    // floors
    const floors = await tab.evaluate(async () => {
      const room = window.__testRoom
      const bench = room.bench('floorplan_area')
      bench.set('package', 'residential')
      bench.set('template', 'townhouse')
      bench.act('build')
      for (let i = 0; i < 40; i++) room.update(0.05)
      bench.act('enter')
      room.update(0.05)
      const y0 = room.camera.position.y
      bench.act('up')
      room.update(0.05)
      const up = room.camera.position.y
      const floorUp = room.metrics().module.floor
      bench.act('down')
      room.update(0.05)
      return { y0, up, floorUp, down: room.camera.position.y }
    })
    check(`[${lang}] one floor up the eye is 2.8 m higher, and back`, floors.floorUp === 1 && floors.up - floors.y0 > 2.5 && Math.abs(floors.down - floors.y0) < 0.2, floors)

    // the level of detail: by hand, then a row shared by the budget
    const lod = await tab.evaluate(async () => {
      const room = window.__testRoom
      const bench = room.bench('floorplan_area')
      bench.set('houses', 4)
      for (let i = 0; i < 40; i++) room.update(0.05)
      const area = window.__floorplanReport.area
      bench.set('lod', 'auto')
      bench.set('budget', 300)
      for (let i = 0; i < 20; i++) room.update(0.05)
      const sum = () => area.houses.reduce((n, h) => n + h.house.lod, 0)
      const levels = area.houses.map((h) => h.house.lod)
      const tight = sum()
      const planned = room.metrics().module.planned
      bench.set('budget', 100000)
      for (let i = 0; i < 20; i++) room.update(0.05)
      const roomy = sum()
      bench.set('lod', '2')
      const hidden = area.houses.every((h) => h.house.lod === 2)
      bench.set('lod', '0')
      const full = area.houses.every((h) => h.house.lod === 0)
      bench.set('houses', 1)
      bench.set('lod', 'auto')
      for (let i = 0; i < 40; i++) room.update(0.05)
      return { levels, tight, roomy, planned, hidden, full, houses: area.houses.length }
    })
    check(`[${lang}] a tight budget lowers the level of the row, a roomy one gives every house the full level; by hand 0 and 2 hold`, lod.levels.length === 4 && lod.tight > lod.roomy && lod.roomy === 0 && lod.planned > 0 && lod.hidden && lod.full && lod.houses === 1, lod)

    // hit the aimed wall: the burst marks it, the C4 brings it down; the reset puts it back
    const hit = await tab.evaluate(async () => {
      const room = window.__testRoom
      const bench = room.bench('floorplan_area')
      bench.set('template', 'single_storey_a')
      bench.act('build')
      for (let i = 0; i < 40; i++) room.update(0.05)
      const { house } = window.__floorplanReport.area.houses[0]
      const THREE_V = room.camera.position.constructor
      const p = house.group.localToWorld(new THREE_V(4, 1.4, 0.05))
      room.look([p.x, 1.6, p.z + 6], [p.x, 1.4, p.z])
      room.update(0.05)
      const before = room.metrics().module.broken
      bench.set('hit', 'c4')
      bench.act('strike')
      for (let i = 0; i < 160; i++) room.update(0.05)
      const after = room.metrics().module.broken
      bench.act('reset')
      for (let i = 0; i < 4; i++) room.update(0.05)
      return { before, after, reset: room.metrics().module.broken }
    })
    await tab.screenshot({ path: join(shots, `floorplan-c4-${lang}.png`) })
    check(`[${lang}] the C4 on the aimed wall brings parts down and the reset puts them back`, hit.before === 0 && hit.after > 0 && hit.reset === 0, hit)

    // the scenarios: the six of the team and the typologies
    const scen = await tab.evaluate(async () => {
      const room = window.__testRoom
      const list = room.scenarios.filter((s) => s.id.startsWith('house_') || s.id === 'floorplan_typologies')
      const result = await room.runScenarios(list)
      return { total: list.length, passed: result.passed, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => [r.id, r.checks.filter((c) => !c.ok).map((c) => c.label)]) }
    })
    check(`[${lang}] the 6 scenarios of the team's house area and the typologies pass`, scen.total === 7 && scen.failed === 0 && scen.passed === 7, scen)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  check('nothing left the page', external.length === 0, external.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
