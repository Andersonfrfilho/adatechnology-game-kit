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
await page.goto(`${url}?scenario=all`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const report = await page.evaluate(() => window.__testRoomReport)


console.log(`\nscenarios: ${report.passed} passed, ${report.failed} failed`)
for (const r of report.results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
  for (const c of r.checks) if (!c.ok) console.log(`   ✗ ${c.label}`)
}

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
const bodyOk = before.mode === 'first' && before.visible === false && before.hint && after.mode === 'third' && after.visible === true && /V:/.test(after.help)
console.log(`${bodyOk ? 'PASS' : 'FAIL'}  the player body: hidden in first person, shown after V, hint on the HUD and in the log`, JSON.stringify({ before, after: { mode: after.mode, visible: after.visible } }))


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
// the behaviour log of a full run
await page.goto(`${url}?scenario=all`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoomReport, null, { timeout: 600000 })
const ndjson = await page.evaluate(() => window.__testRoom.log.toNDJSON())
writeFileSync(join(shotsDir, 'log.ndjson'), ndjson)

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
