// Checks the build output: the bundle exposes the module and the room page carries it with the boot that opens the area.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/player-area.js')
const page = join(here, 'dist/sala-jogador.html')
if (!existsSync(bundle)) throw new Error('dist/player-area.js missing: run node build.mjs')
const text = readFileSync(bundle, 'utf8')
if (!text.includes('player_area')) throw new Error('the bundle does not carry the player_area module')
for (const id of ['grab_break_free', 'normal_world', 'infection_kills', 'Curativo feito']) {
  if (!text.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('PlayerArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-jogador.html does not boot the area')
console.log(`ok: ${existsSync(page) ? 'bundle and room page' : 'bundle (no room page: build examples/test-room first)'}`)

// With Playwright (Chromium, software GL) at hand: the room page loads, the contract report is clean, the six scenarios pass and the bench drives the player.
const require = createRequire(import.meta.url)
const playwright = ['playwright', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright || !existsSync(page)) {
  console.log('skipped the browser check (no playwright or no room page)')
} else {
  const shots = join(here, 'shots')
  mkdirSync(shots, { recursive: true })
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
  const errors = []
  let failed = 0
  const check = (name, ok, detail) => {
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
  for (const lang of ['pt-BR', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 650 } })
    const tab = await context.newPage()
    await tab.route(/^https?:/, (route) => route.abort())
    tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await tab.goto(`${pathToFileURL(page).href}?lang=${lang}`)
    await tab.waitForFunction(() => window.__playerReport, null, { timeout: 90000 })
    await tab.evaluate(() => {
      for (let i = 0; i < 30; i++) window.__testRoom.update(0.02)
    })
    await tab.waitForTimeout(300)
    await tab.screenshot({ path: join(shots, `player-${lang}.png`) })
    const state = await tab.evaluate(async () => {
      const room = window.__testRoom
      const report = window.__playerReport
      const scenarios = room.scenarios.filter((s) => s.id.startsWith('player_'))
      const result = await room.runScenarios(scenarios)
      const bench = room.bench('player_area')
      bench.act('hurt')
      bench.act('bite')
      for (let i = 0; i < 30; i++) room.update(1 / 30)
      const hurt = room.metrics().module
      bench.act('grab')
      for (let i = 0; i < 6; i++) {
        bench.act('push')
        room.update(1 / 30)
        room.update(1 / 30)
      }
      const free = room.metrics().module
      return { ok: report.ok, problems: report.problems, scenarios: scenarios.length, failed: result.failed, bad: result.results.filter((r) => !r.ok).map((r) => r.id), hurt, free }
    })
    // the body: it exists, the area starts in third person and shows it, V toggles the view, the avatar area plays a clip and logs it, a grab plays the Bestiário clip
    const bodyAt = () => tab.evaluate(() => {
      const r = window.__testRoom
      return { has: !!r.avatar, mode: r.cameraMode, visible: r.avatar?.root.visible, parent: !!r.avatar?.root.parent, playing: r.avatar?.avatar.playing ?? null }
    })
    const first = await bodyAt()
    check(`[${lang}] the room has the player body and starts in third person with it shown`, first.has && first.mode === 'third' && first.visible && first.parent, first)
    await tab.keyboard.press('KeyV')
    const toggled = await bodyAt()
    check(`[${lang}] V goes to first person and hides the body`, toggled.mode === 'first' && toggled.visible === false, toggled)
    await tab.keyboard.press('KeyV')
    const back = await bodyAt()
    check(`[${lang}] V again: third person, body shown`, back.mode === 'third' && back.visible === true, back)
    const body = await tab.evaluate(() => {
      const r = window.__testRoom
      r.openArea('avatar_area') // the room reads the counters of the area opened last
      const bench = r.bench('avatar_area')
      bench.act('camera_first')
      const afterFirst = r.cameraMode
      bench.act('camera_third')
      bench.act('crouch')
      bench.act('play_grabbed_bitten_human')
      for (let i = 0; i < 60 * 5; i++) r.update(1 / 60)
      const metrics = r.metrics().module
      const lines = r.log.entries().filter((e) => e.text.startsWith('{"type":"avatar"')).map((e) => JSON.parse(e.text).action)
      bench.act('stop_clip')
      bench.act('stand')
      for (let i = 0; i < 30; i++) r.update(1 / 60)
      r.openArea('player_area')
      // the gameplay link: the player module's grab plays the clip, a push frees it; a knock-down lays the body down
      const player = r.bench('player_area')
      player.act('grab')
      r.update(1 / 30)
      const grabbed = r.avatar.avatar.playing
      for (let i = 0; i < 6; i++) {
        player.act('push')
        r.update(1 / 30)
        r.update(1 / 30)
      }
      for (let i = 0; i < 30; i++) r.update(1 / 30)
      const released = r.avatar.avatar.playing
      player.act('knock')
      for (let i = 0; i < 20; i++) r.update(1 / 30)
      const down = r.avatarState().down
      return { afterFirst, metrics, lines, grabbed, released, down, pending: r.bench('avatar_area').controls().filter((c) => c.id.startsWith('pending_')).map((c) => c.disabled) }
    })
    check(`[${lang}] the avatar area: camera buttons, a clip plays, events and actions are JSON lines in the log`, body.afterFirst === 'first' && body.metrics.clip === 'grabbed_bitten_human' && body.lines.includes('play_clip') && body.lines.includes('clip_event'), { afterFirst: body.afterFirst, clip: body.metrics.clip, last_event: body.metrics.last_event, lines: [...new Set(body.lines)] })
    check(`[${lang}] Soco, Empurrão, Chute and Tiro (corpo) are disabled`, body.pending.length === 4 && body.pending.every(Boolean), body.pending)
    check(`[${lang}] the player's grab plays grabbed_bitten_human, the release stops it, a knock-down lays the body down`, body.grabbed === 'grabbed_bitten_human' && body.released === null && body.down === true, { grabbed: body.grabbed, released: body.released, down: body.down })
    await tab.screenshot({ path: join(shots, `player-third-${lang}.png`) })
    check(`[${lang}] contract report is clean, 6 scenarios pass`, state.ok && state.problems.length === 0 && state.scenarios === 6 && state.failed === 0, state)
    check(`[${lang}] the bench hurts and bites: health drops, the wound bleeds`, state.hurt.health < 70 && state.hurt.wounds === 2, state.hurt)
    check(`[${lang}] six pushes break the grab`, state.free.grab_timer === 0, state.free)
    await context.close()
  }
  check('no console errors', errors.length === 0, errors.slice(0, 3))
  await browser.close()
  if (failed) process.exit(1)
}
