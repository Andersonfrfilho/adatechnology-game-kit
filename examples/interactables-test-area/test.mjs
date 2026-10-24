// End-to-end test of dist/sala-moveis.html (the shared test room with the furniture area loaded) with Playwright (Chromium, software GL),
// file:// with the network blocked. Checks the load, the contract checks the room writes to its log, every scenario, and saves screenshots.
// Run: node build.mjs && node test.mjs   (Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH, e.g. /opt/pw-browsers)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {}
if (!chromium) throw new Error('playwright not found')
const dist = join(here, 'dist/sala-moveis.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
if (!existsSync(dist)) throw new Error('dist/sala-moveis.html missing: build examples/test-room (or set ROOM_HTML), then run build.mjs')
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })

const results = []
const check = (name, ok, detail) => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const external = []
const errors = []
async function open(query = '') {
  const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (/^(file|data|blob|about):/.test(url)) return route.continue()
    external.push(url)
    return route.abort()
  })
  const page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(pathToFileURL(dist).href + query)
  await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
  return page
}

for (const lang of ['pt-BR', 'en']) {
  const page = await open(`?lang=${lang}`)
  const rep = await page.evaluate(() => {
    const r = window.__furnitureReport
    const room = window.__testRoom
    const checks = room.log.entries({ channel: 'check' }).filter((e) => e.data?.module === r.module)
    return { module: r.module, ok: r.ok, items: r.items.length, scenarios: r.scenarios.length, problems: r.problems, checks: checks.length, failed: checks.filter((e) => e.type !== 'pass').map((e) => e.text), clips: checks.filter((e) => e.data?.check === 'animation').length }
  })
  check(`[${lang}] module loaded, 51 items, contract report ok`, rep.ok && rep.items === 51 && rep.problems.length === 0, rep)
  check(`[${lang}] every checkAnimation line in the room log passed`, rep.clips > 100 && rep.failed.length === 0, { clips: rep.clips, failed: rep.failed.slice(0, 3) })

  const spawned = await page.evaluate(() => {
    const room = window.__testRoom
    const bad = []
    for (const id of window.__furnitureReport.items) {
      try {
        const so = room.spawn(id, [0, 0, -5], 0)
        const st = room.world.state(so.objectId)
        if (id !== 'conduit_run' && (!st || st.parts.length === 0)) bad.push(`${id}: no parts`)
        room.clear()
      } catch (e) {
        bad.push(`${id}: ${e.message}`)
      }
    }
    return bad
  })
  check(`[${lang}] every item spawns with destructible parts`, spawned.length === 0, spawned)

  const report = await page.evaluate(async () => {
    const room = window.__testRoom
    const rep = await room.runScenarios(room.scenarios.filter((s) => s.id.startsWith('furniture_')))
    return { passed: rep.passed, failed: rep.failed, bad: rep.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`) }
  })
  check(`[${lang}] every furniture scenario is green`, report.failed === 0 && report.passed >= 14, report)

  // the characters and animals modules ride along too (owner rule): loaded, and one shot crosses a fridge door and then the zombie behind it
  const people = await page.evaluate(async () => {
    const room = window.__testRoom
    const r = window.__furnitureReport
    const run = await room.runScenarios(room.scenarios.filter((s) => s.id.includes('zombie_behind_door')))
    room.clear()
    return { characters: r.characters?.ok && r.characters.problems.length === 0 && r.characters.items.length, animals: r.animals?.ok && r.animals.problems.length === 0 && r.animals.items.length, scenario: { passed: run.passed, failed: run.failed, bad: run.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`) } }
  })
  check(`[${lang}] the characters and animals modules are loaded, and zombie_behind_door is green`, people.characters >= 25 && people.animals === 13 && people.scenario.passed === 1 && people.scenario.failed === 0, people)

  // the vehicles module rides along too (owner rule): loaded with its 8 vehicles, and the 7.62 shot at the light-mode sedan leaves the fridge beside it alone
  const cars = await page.evaluate(async () => {
    const room = window.__testRoom
    const r = window.__furnitureReport.vehicles
    const run = await room.runScenarios(room.scenarios.filter((s) => s.id.includes('car_in_the_yard')))
    room.clear()
    return { ok: r?.ok && r.problems.length === 0, items: r?.items?.length ?? 0, scenario: { passed: run.passed, failed: run.failed, bad: run.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`) } }
  })
  check(`[${lang}] the vehicles module is loaded (8 vehicles), and car_in_the_yard is green`, cars.ok && cars.items === 8 && cars.scenario.passed === 1 && cars.scenario.failed === 0, cars)

  // the vegetation module rides along too (owner rule): loaded with its 18 plants, and an axe fells the 15 cm trunk here as well
  const plants = await page.evaluate(async () => {
    const room = window.__testRoom
    const r = window.__furnitureReport.vegetation
    const run = await room.runScenarios(room.scenarios.filter((s) => s.id === 'veg_axe_fells_crown' || s.id === 'veg_walk_on_grass'))
    room.clear()
    return { ok: r?.ok && r.problems.length === 0, items: r?.items?.length ?? 0, scenarios: r?.scenarios?.length ?? 0, run: { passed: run.passed, failed: run.failed, bad: run.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`) } }
  })
  check(`[${lang}] the vegetation module is loaded (18 plants, 13 scenarios), and the axe and the grass walk are green`, plants.ok && plants.items === 18 && plants.scenarios === 13 && plants.run.passed === 2 && plants.run.failed === 0, plants)

  // the weapons module rides along (owner rule: this area shows what every phase adds): loaded, with its accessory bench, and a suppressor goes on an M4 here too
  const weapons = await page.evaluate(() => {
    const room = window.__testRoom
    const loaded = window.__furnitureReport.weapons
    room.setTool('colt_m4a1')
    for (let i = 0; i < 40; i++) room.update(0.02)
    const bench = room.bench('weapons_area')
    const accepted = bench ? bench.set('fit_muzzle', 'suppressor') : false
    for (let i = 0; i < 800; i++) room.update(0.02)
    const result = { module: loaded?.module, ok: loaded?.ok, problems: loaded?.problems ?? [], items: loaded?.items?.length ?? 0, controls: bench ? bench.controls().map((c) => c.id).filter((id) => id.startsWith('fit_')).length : 0, accepted, suppressed: room.tool.suppressed }
    room.setTool('hand')
    return result
  })
  check(`[${lang}] the weapons module is loaded too, its accessory bench works (suppressor on an M4)`, weapons.module === 'weapons_area' && weapons.ok && weapons.problems.length === 0 && weapons.items > 100 && weapons.controls === 10 && weapons.accepted && weapons.suppressed, weapons)

  // the items module rides along too, and the containers of the furniture hold real items (a fridge shows the cans and bottles of the goods catalog at their real size)
  const items = await page.evaluate(() => {
    const room = window.__testRoom
    const loaded = window.__furnitureReport.itemsArea
    const so = room.spawn('fridge', [0, 0, -5], 0)
    const found = []
    so.root.traverse((o) => o.userData?.contents && found.push(o.userData.contents.item))
    room.clear()
    return { module: loaded?.module, ok: loaded?.ok, problems: loaded?.problems ?? [], items: loaded?.items?.length ?? 0, inFridge: found.length }
  })
  check(`[${lang}] the items module is loaded too and the fridge holds real items`, items.module === 'items_area' && items.ok && items.problems.length === 0 && items.items > 300 && items.inFridge > 0, items)

  if (lang === 'pt-BR') {
    await page.close()
    const p = await open('?lang=pt-BR&ui=0')
    const shot = async (name, setup) => {
      await p.evaluate(setup)
      await p.waitForTimeout(500)
      await p.screenshot({ path: join(shots, name) })
    }
    const run = (f) => `(${f.toString()})()`
    await shot('01-kitchen-doors-open.png', run(() => {
      const room = window.__testRoom
      room.clear()
      const ids = ['fridge', 'kitchen_cabinet_base', 'stove', 'microwave'].map((t, i) => room.spawn(t, [(i - 1.5) * 1.5, 0, -5], 0).objectId)
      room.playAnimation('open_all', ids[0]); room.playAnimation('open_all', ids[1]); room.playAnimation('open_all', ids[2]); room.playAnimation('open_all', ids[3])
      for (let i = 0; i < 80; i++) room.update(0.02)
      room.look([0, 1.8, -1.4], [0, 0.9, -5])
      room.update(0.02)
    }))
    await shot('02-fridge-door-shot-off.png', run(() => {
      const room = window.__testRoom
      room.clear()
      const id = room.spawn('fridge', [0, 0, -5], 0).objectId
      room.playAnimation('open_door_fridge', id)
      for (let i = 0; i < 80; i++) room.update(0.02)
      room.setTool('pistol_9mm')
      room.update(0.4)
      for (let n = 0; n < 6 && room.world.state(id).parts.some((p) => p.id === 'door_fridge'); n++) {
        room.look([0, 1.1, -3.4], [0, 1.1, -4.7]); room.use()
        for (let i = 0; i < 25; i++) room.update(0.02)
      }
      for (let i = 0; i < 200; i++) room.update(0.02)
      room.look([1.2, 1.2, -2.6], [0, 0.5, -5])
      room.update(0.02)
    }))
    await shot('03-sofa-burning-tv-shattered.png', run(() => {
      const room = window.__testRoom
      room.clear()
      const sofa = room.spawn('sofa', [-1.5, 0, -5], 0).objectId
      const tv = room.spawn('tv', [1.5, 0, -5], 0).objectId
      room.world.hit(sofa, { type: 'fire', point: [-1.5, 0.4, -5], temperature: 900, radius: 0.9, duration: 6 })
      for (let i = 0; i < 160; i++) room.update(0.05)
      room.setTool('pistol_9mm')
      room.update(0.4)
      for (let n = 0; n < 6 && room.world.part(tv, 'screen')?.status !== 'broken'; n++) {
        room.look([1.5, 0.4, -3.4], [1.5, 0.4, -5]); room.use()
        for (let i = 0; i < 25; i++) room.update(0.02)
      }
      for (let i = 0; i < 20; i++) room.update(0.02)
      room.look([0, 1.6, -2], [0, 0.5, -5])
      room.update(0.02)
      void sofa
    }))
    await shot('04-gas-bottle-bbq-blast.png', run(() => {
      const room = window.__testRoom
      room.clear()
      const bbq = room.spawn('bbq', [2, 0, -6], 0).objectId
      const gas = room.spawn('gas_bottle', [-1.2, 0, -5], 0).objectId
      room.world.hit(bbq, { type: 'explosive', point: [2, 0.5, -5.1], energy: 400000, radius: 3, source: 'test' })
      for (let s = 0; s < 40 && room.log.entries({ type: 'explode', objectId: gas }).length === 0; s++) {
        room.world.hit(gas, { type: 'fire', point: [-1.2, 0.3, -5], temperature: 1000, radius: 0.5, duration: 1 })
        for (let i = 0; i < 50; i++) room.update(0.02)
      }
      for (let i = 0; i < 12; i++) room.update(0.02)
      room.look([0, 2.2, -0.5], [0.4, 0.5, -5.5])
      room.update(0.02)
    }))
    await p.close()
  } else await page.close()
}

check('no console errors', errors.length === 0, errors.slice(0, 3))
check('no external requests', external.length === 0, external.slice(0, 3))
await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
