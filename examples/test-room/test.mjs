// End-to-end test of dist/test-room.html (the room with the SDK's real content loaded) with Playwright (Chromium, software GL): opens it via file:// with the network blocked,
// runs every scenario (?scenario=all), prints the report and saves screenshots plus the behaviour log to shots/.
// Run: node build.mjs && node test.mjs   (Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH, e.g. /opt/pw-browsers)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* try the next one */
    }
  }
  throw new Error('playwright not found (set NODE_PATH or install it)')
}
const { chromium } = loadPlaywright()

const dist = join(here, 'dist/test-room.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
const shotsDir = join(here, 'shots')
mkdirSync(shotsDir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const external = []
const consoleErrors = []
// CI runs software GL, several times slower and nothing there reads the pictures: screenshots get a long timeout, and the first-person steps, the contact sheets and the close-ups keep every assertion
// (both languages, the 100 weapons held, each number) but take no picture; the pictures in shots/ come from a run on a developer's machine
const CI = Boolean(process.env.CI)
const SHOT = { timeout: 180000 }
const started = Date.now()
const lap = (label) => console.log(`TIME  ${((Date.now() - started) / 1000).toFixed(0)} s  ${label}`)
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await context.route('**/*', (route) => {
  const url = route.request().url()
  if (/^(file|data|blob|about):/.test(url)) return route.continue()
  external.push(url)
  return route.abort()
})
const page = await context.newPage()
// the weapon thumbnails (../weapon-svg/) exist only in the built site: on file:// each one is a CORS error plus a bare "Failed to load resource"
const isThumbnailError = (text) => /weapon-svg|^Failed to load resource: net::ERR_FAILED$/.test(text)
page.on('console', (m) => {
  if (m.type() === 'error' && !isThumbnailError(m.text())) consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

const url = pathToFileURL(dist).href

// TEST_ROOM_PART splits the run across CI jobs, each part opening its own pages: `scenarios` or `scenarios:i/n` (every scenario, or the i-th of n
// shares of them), `views` (the SDK content, the screenshots, the player's body, the test table), `hands` (first person, close-ups, contact sheets); unset runs all
const [PART, SHARD] = (process.env.TEST_ROOM_PART || 'all').split(':')
const runs = (part) => PART === 'all' || PART === part
const report = { passed: 0, failed: 0, results: [] }
let bodyOk = true

if (runs('scenarios')) {
  await page.goto(`${url}?scenario=all${SHARD ? `&shard=${SHARD}` : ''}`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
  Object.assign(report, await page.evaluate(() => window.__testRoomReport))
  console.log(`\nscenarios${SHARD ? ` ${SHARD}` : ''}: ${report.passed} passed, ${report.failed} failed`)
  for (const r of report.results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
    for (const c of r.checks) if (!c.ok) console.log(`   ✗ ${c.label}`)
  }
  // the behaviour log of the run
  const ndjson = await page.evaluate(() => window.__testRoom.log.toNDJSON())
  writeFileSync(join(shotsDir, SHARD ? `log-${SHARD.replace('/', '-of-')}.ndjson` : 'log.ndjson'), ndjson)
  lap('scenarios done')
}

if (runs('views')) {
  await page.goto(`${url}?ui=0&table=0`, { timeout: 180000 })
  await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
  // the default page carries the SDK's real items (the teams' content) and none of the old procedural demo ones
  const DEMO_IDS = ['chair', 'sofa_demo', 'shelf', 'old_tv', 'steel_sheet', 'glass_pane', 'concrete_block', 'brick_column', 'building_frame', 'car_door', 'small_tree', 'potted_plant', 'coffee_cup', 'glass_bottle', 'wooden_crate', 'steel_drum', 'plastic_bucket', 'jerrycan', 'rental_car']
  const content = await page.evaluate(() => {
    const r = window.__furnitureReport
    const lists = { household: r.items, weapons: r.weapons?.items ?? [], goods: r.itemsArea?.items ?? [], vehicles: r.vehicles?.items ?? [], vegetation: r.vegetation?.items ?? [], characters: r.characters?.items ?? [], animals: r.animals?.items ?? [] }
    const all = Object.values(lists).flat()
    const room = window.__testRoom
    const spawnable = {}
    for (const id of ['weapon_pistol_9mm', 'fridge', 'item_canned_beans', 'sedan', 'mango_tree', 'zombie_walker']) {
      try {
        spawnable[id] = !!room.spawn(id, [0, 0, -5], 0)
      } catch {
        spawnable[id] = false
      }
      room.clear()
    }
    return { counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])), all, spawnable, problems: Object.values(r).flatMap((x) => x?.problems ?? []).length }
  })
  const extra = content.all.filter((id) => id.startsWith('weapon_') || id.startsWith('item_')).length
  const demoLeft = DEMO_IDS.filter((id) => content.all.includes(id))
  const spawnOk = Object.values(content.spawnable).every(Boolean)
  const contentOk = content.counts.household === 51 && content.counts.weapons > 100 && content.counts.goods > 300 && demoLeft.length === 0 && spawnOk && extra > 400
  console.log(`${contentOk ? 'PASS' : 'FAIL'}  default page loads the SDK content`, JSON.stringify({ counts: content.counts, demoLeft, spawnable: content.spawnable }))
  if (!contentOk) report.failed++

  // screenshots: a fresh room per scene, driven through window.__testRoom
  async function shot(name, setup) {
    await page.goto(`${url}?ui=1`, { timeout: 180000 })
    await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
    await page.evaluate(setup)
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(shotsDir, `${name}.png`), ...SHOT })
  }
  await shot('overview', () => {
    const r = window.__testRoom
    r.spawn('fridge', [-1.5, 0, -2])
    r.spawn('sofa', [0.5, 0, -2])
    r.spawn('sedan', [4, 0, -4])
  })
  await shot('weapon-in-hand', () => {
    const r = window.__testRoom
    r.spawn('wardrobe', [0, 0, -3])
    r.setTool('pistol_9mm')
    for (let i = 0; i < 40; i++) r.update(0.02)
  })
  await shot('burning-sofa', () => {
    const r = window.__testRoom
    r.spawn('sofa', [0, 0, -4])
    r.setTool('lighter')
    r.update(0.4)
    r.look([0, 0.5, -3.2], [0, 0.4, -4])
    r.use(5)
    for (let i = 0; i < 12; i++) r.update(0.25)
    r.look([0.4, 1.2, -2.2], [0, 0.3, -4])
  })

  // the player's body: hidden in first person (the default), shown after V, with the startup hint in the log and the V hint on the HUD
  await page.goto(`${url}?ui=1`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 60000 })
  const before = await page.evaluate(() => ({ mode: window.__testRoom.cameraMode, visible: window.__testRoom.avatar?.root.visible, hint: window.__testRoom.log.entries().some((e) => /\bV\b/.test(e.text)) }))
  await page.keyboard.press('KeyV')
  await page.evaluate(() => {
    const r = window.__testRoom
    r.spawn('fridge', [-1.5, 0, -2])
    r.look([0, 1.7, 3.5], [0, 1.2, -8])
    for (let i = 0; i < 40; i++) r.update(0.02)
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotsDir, 'third-person.png'), ...SHOT })
  const after = await page.evaluate(() => ({ mode: window.__testRoom.cameraMode, visible: window.__testRoom.avatar?.root.visible, help: document.querySelector('.tr-help')?.textContent ?? '' }))
  bodyOk = before.mode === 'first' && before.visible === false && before.hint && after.mode === 'third' && after.visible === true && /V:/.test(after.help)
  console.log(`${bodyOk ? 'PASS' : 'FAIL'}  the player body: hidden in first person, shown after V, hint on the HUD and in the log`, JSON.stringify({ before, after: { mode: after.mode, visible: after.visible } }))


  // the test table: the goods and the weapons laid on the long dining table of the furniture catalogue a page at a time, and each trial (shot, punch, knife, fire, blast) reaches the item picked
  await page.goto(`${url}?ui=1&table=1`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 180000 })
  const table = await page.evaluate(() => {
    const r = window.__testRoom
    const groups = r.testTable.groups()
    const sizes = Object.fromEntries(groups.map((g) => [g, r.testTable.items().filter((i) => i.group === g).length]))
    const reached = {}
    for (const kind of ['shot', 'punch', 'stab', 'fire', 'blast']) {
      const page = r.testTable.find('item_canned_beans') ?? r.testTable.find(r.testTable.items()[0].id)
      const target = page.selected
      const before = r.log.entries().length
      r.testTable.trial(kind)
      for (let i = 0; i < 60; i++) r.update(1 / 60)
      reached[kind] = r.log.entries().slice(before).some((e) => e.objectId === target && e.type !== 'spawn')
    }
    const panel = !!document.querySelector('.tr-table') && document.querySelectorAll('.tr-table [data-trial]').length === 5
    return { groups: groups.length, sizes, reached, panel }
  })
  await page.evaluate(() => {
    const r = window.__testRoom
    r.testTable.relay()
    r.look([-8, 2.2, 6], [-8, 0.8, 3])
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotsDir, 'test-table.png'), ...SHOT })
  const tableOk = table.panel && table.groups > 5 && Object.values(table.reached).every(Boolean)
  console.log(`${tableOk ? 'PASS' : 'FAIL'}  test table: every group laid a page at a time, each trial reaches the item picked`, JSON.stringify(table))
  if (!tableOk) report.failed++
}

if (runs('hands')) {
  lap('before the first-person steps')
  // the first-person arms and the strikes, in both languages: bare hands, fists, a pistol and a rifle held, the rifle mid-reload, the punch, the shove and the kick at their impact, and the punch seen from behind
  const fpSteps = [
    ['bare-hands', () => { S.r.setTool('hand'); S.run(60) }],
    ['fists', () => { S.r.setTool('fists'); S.run(60) }],
    ['pistol', () => { S.r.setTool('glock_17'); S.run(60) }],
    ['rifle', () => { S.r.setTool('ak_47'); S.run(60) }],
    ['m4', () => { S.r.setTool('colt_m4a1'); S.run(60) }],
    ['rifle-reload', () => { S.r.use(); S.run(12); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); S.run(22); S.r.pause() }],
    ['pistol-reload', () => { S.r.resume(); S.run(60); S.r.setTool('glock_17'); S.run(60); S.r.use(); S.run(12); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); S.run(22); S.r.pause() }],
    ['punch', () => { S.r.resume(); S.run(60); S.r.setTool('fists'); S.run(40); S.r.use(); S.run(10); S.r.pause() }],
    ['shove', () => { S.r.resume(); S.run(60); S.r.setTool('shove'); S.run(40); S.r.use(); S.run(16); S.r.pause() }],
    ['kick', () => { S.r.resume(); S.run(60); S.r.setTool('hand'); S.run(40); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true })); S.run(19); S.r.pause() }],
    ['pistol-reload-empty', () => { S.r.resume(); S.run(100); S.r.setTool('desert_eagle_mark_xix'); S.run(60); S.r.look([-9, 1.7, 9], [-9, 1.5, 30]); for (let n = 0; S.r.tool.ammo > 0 && n < 90; n++) { S.r.use(); S.run(5) } for (let i = 0; i < 6; i++) S.run(300); S.look(); S.run(30); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); S.run(105); S.r.pause() }],
    ['m4-reload-empty', () => { S.r.resume(); S.run(100); S.r.setTool('colt_m4a1'); S.run(60); S.r.look([-9, 1.7, 9], [-9, 1.5, 30]); for (let n = 0; S.r.tool.ammo > 0 && n < 90; n++) { S.r.use(); S.run(5) } for (let i = 0; i < 6; i++) S.run(300); S.look(); S.run(30); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); S.run(130); S.r.pause() }],
    ['ak-reload-empty', () => { S.r.resume(); S.run(100); S.r.setTool('ak_47'); S.run(60); S.r.look([-9, 1.7, 9], [-9, 1.5, 30]); for (let n = 0; S.r.tool.ammo > 0 && n < 90; n++) { S.r.use(); S.run(5) } for (let i = 0; i < 6; i++) S.run(300); S.look(); S.run(30); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); S.run(150); S.r.pause() }],
    ['shotgun-pump', () => { S.r.resume(); S.run(100); S.r.setTool('remington_870'); S.run(60); S.r.look([-9, 1.7, 9], [-9, 1.5, 30]); S.r.use(); S.run(4); S.look(); S.run(14); S.r.pause() }],
    ['kick-left', () => { S.r.resume(); S.run(60); S.r.setTool('hand'); S.run(40); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true })); S.run(19); S.r.pause() }],
    ['kick-right', () => { S.r.resume(); S.run(60); S.r.setTool('hand'); S.run(40); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true })); S.run(19); S.r.pause() }],
    ['shove-wall', () => { S.r.resume(); S.run(70); S.r.spawn('wardrobe', [-9, 0, 8.3], 0); S.run(30); S.r.setTool('shove'); S.run(40); S.r.use(); S.run(16); S.r.pause() }],
    ['punch-third', () => { S.r.resume(); S.run(60); S.r.setCameraMode('third'); S.r.setTool('fists'); S.run(60); S.r.use(); S.run(10); S.r.pause() }],
  ]
  const fpExpect = { 'bare-hands': 'relaxed', fists: 'fists', pistol: 'hold', rifle: 'hold', m4: 'hold', 'rifle-reload': 'hold', 'pistol-reload': 'hold', 'pistol-reload-empty': 'hold', 'm4-reload-empty': 'hold', 'ak-reload-empty': 'hold', 'shotgun-pump': 'hold', punch: 'fists', shove: 'relaxed', 'shove-wall': 'relaxed', kick: 'relaxed', 'kick-left': 'relaxed', 'kick-right': 'relaxed' }
  const fpPlaying = { punch: 'punch_right', shove: 'shove_two_hands', kick: 'front_kick', 'kick-left': 'front_kick', 'kick-right': 'front_kick', 'shove-wall': 'shove_two_hands', 'punch-third': 'punch_right' }
  let fpOk = true
  for (const lang of ['pt-BR', 'en']) {
    await page.goto(`${url}?ui=0&lang=${lang}`, { timeout: 180000 })
    await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
    await page.evaluate(() => {
      const r = window.__testRoom
      r.clear()
      for (let i = 0; i < 600; i++) r.update(1 / 60)
      window.S = { r, run: (n) => { for (let i = 0; i < n; i++) r.update(1 / 60) }, look: () => r.look([-9, 1.7, 9], [-9, 1.5, -10]) }
      window.S.look()
      window.S.run(10)
    })
    lap(`first-person steps, ${lang}`)
    for (const [name, act] of fpSteps) {
      const seen = await page.evaluate(`(() => { (${act.toString()})(); const a = window.__testRoom.avatar; return { stance: a.arms?.stance ?? null, playing: a.arms?.playing ?? null, visible: a.firstPerson?.root.visible ?? null, strikes: window.__testRoom.log.entries().filter((e) => /impact in|impacto em/.test(e.text)).length } })()`)
      if (!CI) {
        await page.waitForTimeout(150)
        await page.screenshot({ path: join(shotsDir, `fp-${name}-${lang}.png`), ...SHOT })
      }
      const stanceOk = fpExpect[name] === undefined || seen.stance === fpExpect[name]
      const playOk = fpPlaying[name] === undefined || seen.playing === fpPlaying[name]
      const visibleOk = name === 'punch-third' ? seen.visible === false : seen.visible === true
      if (!(stanceOk && playOk && visibleOk)) fpOk = false
      console.log(`${stanceOk && playOk && visibleOk ? 'PASS' : 'FAIL'}  [${lang}] first-person arms: ${name}`, JSON.stringify(seen))
    }
  }
  lap('first-person steps done')
  if (!fpOk) report.failed++

  // close-ups, drawn from a debug camera while the player's camera, the arms and the weapon stay as they are (room.setDebugCamera): what the eye has to see in the moves that pass every assertion but
  // were not readable at the normal view: the tube loaded shell by shell, the slide racked by the support hand, the cup of the support hand under a handguard and the trigger finger.
  {
    let closeOk = true
    const verdict = (name, ok, info) => {
      if (!ok) closeOk = false
      console.log(`${ok ? 'PASS' : 'FAIL'}  close-up: ${name}`, JSON.stringify(info))
    }
    // (CI renders in software and every picture costs seconds there: the assertions run, the pictures are the ones committed)
    const closeShot = async (name, fn, arg) => {
      const info = await page.evaluate(fn, arg)
      if (CI) return info
      await page.waitForTimeout(250)
      await page.screenshot({ path: join(shotsDir, `closeup-${name}.png`), ...SHOT })
      return info
    }
    // one frame loop shared by the close-ups: the room back at the player's own view, the weapon out, the debug camera off
    await page.evaluate(() => {
      const r = window.__testRoom
      r.setDebugCamera(null)
      r.resume()
      r.setCameraMode('first')
      window.C = {
        r,
        key: (code, extra = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { code, ...extra })),
        at: (name) => {
          const part = r.scene.getObjectByName('weapon-viewmodel')?.getObjectByName(name)
          if (!part) return null
          part.updateWorldMatrix(true, false)
          const e = part.matrixWorld.elements
          return [e[12], e[13], e[14]]
        },
        view: (position, target, fov = 40) => r.setDebugCamera({ position, target, fov }),
        armed: (id) => {
          r.setDebugCamera(null)
          r.resume()
          window.S.look()
          window.S.run(30)
          r.setTool(id)
          window.S.run(60)
        },
        emptied: (id) => {
          window.C.armed(id)
          for (let n = 0; r.tool.ammo > 0 && n < 90; n++) {
            r.use()
            window.S.run(40)
          }
          window.S.run(180)
        },
      }
    })

    // the tube shotgun, empty: the shells go in one by one at the rule's seconds, a hand visit and a sound each, then the pump. One reload, looked at four times: the room stays paused between the shots
    const pumpTo = (arg) => {
      const r = window.C.r
      const S = window.S
      if (arg.start) {
        window.C.emptied('remington_870')
        const run = { frames: 0, ammo: [], visits: 0, away: false, capacity: r.tool.capacity, before: r.log.entries().length, rest: r.handState().targets.R.position.slice() }
        window.__pump = run
        window.C.key('KeyR')
      }
      const run = window.__pump
      r.resume()
      while (run.frames < arg.to) {
        S.run(1)
        run.frames++
        run.ammo.push(r.tool.ammo)
        const p = r.handState().targets?.R?.position
        if (p) {
          const d = Math.hypot(p[0] - run.rest[0], p[1] - run.rest[1], p[2] - run.rest[2])
          if (!run.away && d > 0.02) {
            run.away = true
            run.visits++
          } else if (run.away && d < 0.008) run.away = false
        }
      }
      r.pause()
      const sounds = r.log.entries().slice(run.before).filter((e) => e.type === 'sound' && e.data?.cue === 'shell_insert').map((e) => +e.t.toFixed(2))
      const port = window.C.at('loadPort')
      if (arg.view && port) window.C.view([port[0] + 0.32, port[1] + 0.1, port[2] + 0.08], port, 38)
      const steps = run.ammo.flatMap((a, i) => (i > 0 && a !== run.ammo[i - 1] ? [{ at: +(i / 60).toFixed(2), ammo: a }] : []))
      const actions = r.log.entries().slice(run.before).filter((e) => e.type === 'sound' && ['pump_back', 'pump_forward'].includes(e.data?.cue)).map((e) => +e.t.toFixed(2))
      const hand = r.handState().targets.R.position
      const awayFromGrip = +Math.hypot(hand[0] - run.rest[0], hand[1] - run.rest[1], hand[2] - run.rest[2]).toFixed(3)
      return { capacity: run.capacity, ammo: r.tool.ammo, reloading: r.tool.reloading, steps, sounds, actions, awayFromGrip, grip: r.handState().targets.grip, visits: run.visits, at: +(run.frames / 60).toFixed(2) }
    }
    let full = await page.evaluate(pumpTo, { start: true, to: 0 })
    for (const [name, to] of [['shell-1', 40], ['shell-3', 110], ['shell-6', 215], ['pump', 245]]) {
      const info = await closeShot(`870-${name}`, pumpTo, { to, view: true })
      console.log(`      870 ${name}: ${info.ammo}/${info.capacity} shells at ${info.at} s, ${info.sounds.length} sounds, ${info.visits} visits, shooting hand ${info.awayFromGrip} m from the grip`)
      // the pump moves the support hand only: the shooting hand is on the grip, closed, from the first sound of the pump
      if (name === 'pump') verdict('remington 870 at the pump: the shooting hand holds the grip (closed, not at the port)', info.awayFromGrip < 0.012 && info.grip >= 0.85 && info.actions.length > 0, { awayFromGrip: info.awayFromGrip, grip: info.grip, actions: info.actions })
    }
    full = await page.evaluate(pumpTo, { to: 60 * 8 })
    const secs = full.steps.map((entry) => entry.at)
    const gaps = secs.slice(1).map((t, i) => +(t - secs[i]).toFixed(2))
    verdict('remington 870 empty: one shell per step (the rule\'s 0.55 s), one sound and one hand visit each, every shell in before the pump', full.steps.length === full.capacity && full.steps.every((entry, i) => entry.ammo === i + 1) && gaps.every((g) => g >= 0.5) && full.sounds.length === full.capacity && full.visits === full.capacity && !full.reloading && full.actions.length === 2 && full.sounds.at(-1) < full.actions[0], { ...full, gaps })

    // the pistol, empty: the slide is racked by the support hand (it goes back and forward) and the snap is heard as it closes
    const glockTo = (arg) => {
      const r = window.C.r
      const S = window.S
      if (arg.start) {
        window.C.emptied('glock_17')
        window.__glock = { frames: 0, track: [], before: r.log.entries().length, slide: r.scene.getObjectByName('weapon-viewmodel').getObjectByName('slide') }
        window.C.key('KeyR')
      }
      const run = window.__glock
      r.resume()
      const step = () => {
        S.run(1)
        run.frames++
        const hand = r.handState().targets.L.position
        const at = window.C.at('slide')
        run.track.push({ x: run.slide.position.x, d: at ? Math.hypot(hand[0] - at[0], hand[1] - at[1], hand[2] - at[2]) : 9 })
      }
      // `to`: a frame; `rear`: until the slide is at the rear, the moment it is pulled back (the slide back and no longer going further)
      if (arg.rear) while (run.frames < 400 && !(run.track.length > 1 && run.track.at(-1).x < -0.02 && run.track.at(-1).x >= run.track.at(-2).x)) step()
      else while (run.frames < arg.to) step()
      r.pause()
      const snap = r.log.entries().slice(run.before).filter((e) => e.type === 'sound' && e.data?.cue === 'slide_release').map((e) => +e.t.toFixed(2))
      const at = window.C.at('slide')
      // from the left and above, where the support hand reaches over the slide
      if (arg.view && at) window.C.view([at[0] - 0.28, at[1] + 0.16, at[2] + 0.12], [at[0], at[1] - 0.02, at[2]], 38)
      return { track: run.track, snap, frames: run.frames }
    }
    await page.evaluate(glockTo, { start: true, to: 0 })
    await closeShot('glock-magazine', glockTo, { to: 30, view: true })
    const rack = await closeShot('glock-rack-back', glockTo, { rear: true, view: true })
    await closeShot('glock-closed', glockTo, { to: rack.frames + 60, view: true })
    const run = await page.evaluate(glockTo, { to: 60 * 4 })
    const xs = run.track.map((entry) => entry.x)
    const back = Math.min(...xs)
    const reached = Math.min(...run.track.map((entry) => entry.d))
    verdict('glock empty: the slide goes back and forward, the support hand reaches it and the snap sounds', back < -0.02 && Math.abs(xs.at(-1)) < 1e-3 && xs[0] === 0 && reached < 0.09 && run.snap.length === 1, { back: +back.toFixed(3), pulledAtFrame: rack.frames, handToSlide: +reached.toFixed(3), snapAt: run.snap })

    // the support hand at rest under a handguard: a palm-up cup, the forearm from below
    const cup = (id) => {
      const r = window.C.r
      window.C.armed(id)
      r.pause()
      const j = r.avatar.arms.joints('L')
      const fore = j.wrist.clone().sub(j.elbow)
      const left = r.handState().targets.L
      window.C.view([left.position[0] + 0.55, left.position[1], left.position[2] + 0.1], left.position, 40)
      return { underWrist: +(j.wrist.y - j.elbow.y).toFixed(3), offForward: +((Math.atan2(fore.x, -fore.z) * 180) / Math.PI).toFixed(0), rising: +((Math.atan2(fore.y, Math.hypot(fore.x, fore.z)) * 180) / Math.PI).toFixed(0) }
    }
    for (const [name, id] of [['m4', 'colt_m4a1'], ['ak', 'ak_47']]) {
      const geometry = await closeShot(`${name}-rest-side`, cup, id)
      verdict(`${id} at rest: forearm from below, the hand a cup under the handguard`, geometry.underWrist > 0.1 && geometry.offForward < 25 && geometry.rising > 20, geometry)
      // the same moment from the player's own camera
      await page.evaluate(() => window.__testRoom.setDebugCamera(null))
      if (!CI) {
        await page.waitForTimeout(250)
        await page.screenshot({ path: join(shotsDir, `closeup-${name}-rest-player.png`), ...SHOT })
      }
      await closeShot(`${name}-rest-below`, () => {
        const r = window.__testRoom
        const l = r.handState().targets.L.position
        window.C.view([l[0] + 0.1, l[1] - 0.5, l[2] + 0.35], l, 40)
      })
    }

    // the trigger finger, 25 cm from the grip: extended along the frame at rest, curled on the trigger mid-pull, extended again once released
    const finger = (phase) => {
      const r = window.C.r
      const S = window.S
      if (phase === 'rest') {
        window.C.armed('glock_17')
        r.pause()
      } else if (phase === 'pull') {
        r.resume()
        window.C.armed('glock_17')
        r.use()
        for (let n = 0; n < 40 && (r.handState().triggerFinger ?? 0) < 0.75; n++) S.run(1)
        r.pause()
      } else {
        r.resume()
        S.run(260)
        r.pause()
      }
      const grip = r.handState().targets.R.position
      // 25 cm away, in front of the hand and to its right, where the finger is seen from the side it curls to
      window.C.view([grip[0] + 0.17, grip[1] + 0.04, grip[2] - 0.18], [grip[0], grip[1] + 0.02, grip[2] - 0.03], 32)
      return +r.handState().triggerFinger.toFixed(2)
    }
    const fingerAt = {}
    for (const phase of ['rest', 'pull', 'released']) fingerAt[phase] = await closeShot(`trigger-finger-${phase}`, finger, phase)
    verdict('trigger finger: 0 at rest, curled on the trigger mid-pull (at least 0.75: more than 60 degrees at the first joint), 0 again once released', fingerAt.rest === 0 && fingerAt.pull >= 0.75 && fingerAt.released === 0, fingerAt)

    await page.evaluate(() => {
      window.__testRoom.setDebugCamera(null)
      window.__testRoom.resume()
    })
    if (!closeOk) report.failed++
  }
  lap('close-ups done')

  // every weapon with a model in the hands, in first person: contact sheets (five by four, with the id of the weapon) of the view of the hands and the weapon
  {
    await page.goto(`${url}?ui=0&lang=en`, { timeout: 180000 })
    await page.waitForFunction(() => window.__furnitureReport, null, { timeout: 90000 })
    const ids = await page.evaluate(() => {
      const r = window.__testRoom
      r.clear()
      for (let i = 0; i < 600; i++) r.update(1 / 60)
      r.look([-9, 1.7, 9], [-9, 1.5, -10])
      for (let i = 0; i < 10; i++) r.update(1 / 60)
      const held = []
      for (const id of r.arsenal.weapons.keys()) {
        r.setTool(id)
        for (let i = 0; i < 6; i++) r.update(1 / 60)
        const group = r.scene.getObjectByName('weapon-viewmodel')
        if (group && group.children[0] && group.children[0].children.length > 0) held.push(id)
      }
      window.__heldIds = held
      return held
    })
    const COLS = 5
    const ROWS = 4
    const CELL = { w: 384, h: 216 }
    const images = []
    for (const id of CI ? [] : ids) {
      await page.evaluate((tool) => {
        const r = window.__testRoom
        r.setTool(tool)
        for (let i = 0; i < 45; i++) r.update(1 / 60)
      }, id)
      await page.waitForTimeout(40)
      images.push((await page.screenshot({ clip: { x: 320, y: 180, width: 960, height: 540 }, ...SHOT })).toString('base64'))
    }
    const sheets = Math.ceil(ids.length / (COLS * ROWS))
    const compose = CI ? null : await page.context().newPage()
    for (let sheet = 0; sheet < (CI ? 0 : sheets); sheet++) {
      const from = sheet * COLS * ROWS
      const data = await compose.evaluate(async ({ part, pictures, COLS, ROWS, CELL }) => {
        const canvas = document.createElement('canvas')
        canvas.width = COLS * CELL.w
        canvas.height = ROWS * CELL.h
        const c = canvas.getContext('2d')
        c.fillStyle = '#000'
        c.fillRect(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < part.length; i++) {
          const img = new Image()
          await new Promise((done) => {
            img.onload = done
            img.src = `data:image/png;base64,${pictures[i]}`
          })
          const x = (i % COLS) * CELL.w
          const y = Math.floor(i / COLS) * CELL.h
          c.drawImage(img, x, y, CELL.w, CELL.h)
          c.font = 'bold 16px sans-serif'
          c.fillStyle = 'rgba(0,0,0,0.65)'
          c.fillRect(x, y, c.measureText(part[i]).width + 12, 22)
          c.fillStyle = '#fff'
          c.fillText(part[i], x + 6, y + 17)
          c.strokeStyle = '#222'
          c.strokeRect(x, y, CELL.w, CELL.h)
        }
        return canvas.toDataURL('image/png')
      }, { part: ids.slice(from, from + COLS * ROWS), pictures: images.slice(from, from + COLS * ROWS), COLS, ROWS, CELL })
      writeFileSync(join(shotsDir, `fp-all-weapons-${sheet + 1}.png`), Buffer.from(data.split(',')[1], 'base64'))
    }
    await compose?.close()
    const sheetsOk = ids.length >= 100
    console.log(`${sheetsOk ? 'PASS' : 'FAIL'}  first person: ${ids.length} weapons with a model held, ${sheets} contact sheets (fp-all-weapons-N.png)`)
    if (!sheetsOk) report.failed++
  }

  lap('contact sheets done')
}

await browser.close()
let bad = report.failed > 0 || !bodyOk
if (external.length) {
  console.log('external requests:', external)
  bad = true
}
if (consoleErrors.length) {
  console.log('console errors:', consoleErrors)
  bad = true
}
console.log(bad ? 'FAILED' : 'OK')
process.exit(bad ? 1 : 0)
