// End-to-end test of dist/showroom.html with Playwright (Chromium, software GL): opens it via file:// with the network blocked,
// drives the world through window.__showroom and the keyboard, and saves screenshots to shots/.
// Run: node build.mjs && node test.mjs   (Chromium is expected at $PLAYWRIGHT_BROWSERS_PATH, e.g. /opt/pw-browsers)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, statSync, unlinkSync, readdirSync } from 'node:fs'
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

/** Draw-call budget in game quality, worst view with the sun's shadow map redrawn and a mirror in sight (measured, see README). */
const GAME_CALLS_MAX = Number(process.env.GAME_CALLS_MAX || 400)

const dist = join(here, 'dist/showroom.html')
if (!existsSync(dist)) execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' })
const shotsDir = join(here, 'shots')
mkdirSync(shotsDir, { recursive: true })

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const external = []
const consoleErrors = []
async function openPage(viewport, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra })
  // block (and record) everything that is not the file itself
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (/^(file|data|blob|about):/.test(url)) return route.continue()
    external.push(url)
    return route.abort()
  })
  const page = await context.newPage()
  page.on('request', (r) => {
    if (!/^(file|data|blob|about):/.test(r.url())) external.push(r.url())
  })
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  await page.goto(pathToFileURL(dist).href)
  await page.waitForFunction(() => window.__showroom && window.__showroom.world, null, { timeout: 90000 })
  await page.evaluate(() => window.__showroom.pause(true))
  return { context, page }
}

const { page } = await openPage({ width: 1100, height: 620 })
const E = (fn, arg) => page.evaluate(fn, arg)

// ------------------------------------------------------------------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------------------------------------------------------------------
const boot = await E(() => {
  const s = window.__showroom
  return { objects: s.world.objects().length, types: new Set(s.hh.types.map((t) => t.id)).size, placed: new Set([...s.entries.values()].filter((e) => e.hh).map((e) => e.type)).size, quality: s.state.quality, locale: s.world.t('prompt.open') }
})
check('boots with every household type placed', boot.placed === boot.types, boot)
check('world speaks pt-BR', /abrir/i.test(boot.locale), boot.locale)

// ------------------------------------------------------------------------------------------------------------------------------
// Fridge: open the door, the container becomes accessible, take an item with F, the backpack grows
// ------------------------------------------------------------------------------------------------------------------------------
await E(() => window.__showroom.teleport('fridge'))
const fr = await E(() => {
  const s = window.__showroom
  const w = s.world
  const closed = w.accessible('fridge', 'fridge')
  w.act('fridge:toggle_door_fridge')
  s.step(1.5)
  const stacks = w.contents('fridge', 'fridge')
  const slot = stacks.findIndex((x) => x)
  const p = w.slotPosition('fridge', 'fridge', slot)
  s.lookAt(p[0], p[1] + 0.05, p[2])
  s.hud()
  return { closed, open: w.accessible('fridge', 'fridge'), slot, type: stacks[slot] && stacks[slot].type, packBefore: s.pack.length, prompt: document.querySelector('#prompt').textContent, sweep: s.sweeps['fridge:door_fridge'] }
})
check('fridge closed: container not accessible', fr.closed === false)
check('fridge door opens: container accessible', fr.open === true, { sweepLimit: fr.sweep })
check('HUD prompt is localized while aiming at an item', /Pegar/.test(fr.prompt) && !/prompt\./.test(fr.prompt), fr.prompt)
await page.keyboard.press('KeyF')
const fr2 = await E((a) => {
  const s = window.__showroom
  return { pack: s.pack.map((p) => `${p.type}x${p.qty}`), slotEmpty: s.world.contents('fridge', 'fridge')[a.slot] === null, count: document.querySelector('#packCount').textContent }
}, fr)
check('F takes the item: backpack grows, slot emptied', fr2.pack.length === fr.packBefore + 1 && fr2.slotEmpty && fr2.count !== '0', fr2)

// ------------------------------------------------------------------------------------------------------------------------------
// Gas: valve closed, the burner cannot light; open it, the burner lights and the flame emitter is active
// ------------------------------------------------------------------------------------------------------------------------------
const gas = await E(() => {
  const s = window.__showroom
  const w = s.world
  const out = { valveClosedAtStart: w.partT('gas_bottle', 'valve') < 0.5 }
  w.act('stove:use_burner_2')
  s.step(1.5)
  out.litWithValveClosed = w.isLit('stove', 'burner_2')
  out.flameWithValveClosed = w.emitters().some((e) => e.kind === 'flame' && e.object === 'stove')
  w.act('gas_bottle:use_gas')
  s.step(1.5)
  out.relightsWhenValveOpens = w.isLit('stove', 'burner_2')
  if (!out.relightsWhenValveOpens) {
    w.act('stove:use_burner_2')
    w.act('stove:use_burner_2')
    s.step(1.5)
  }
  out.lit = w.isLit('stove', 'burner_2')
  out.flame = w.emitters().some((e) => e.kind === 'flame' && e.id === 'stove:burner_2_flame' && e.intensity > 0)
  w.act('gas_bottle:use_gas') // close again
  s.step(1.5)
  out.litAfterClosing = w.isLit('stove', 'burner_2')
  w.act('gas_bottle:use_gas') // open again for the screenshots
  s.step(1.5)
  return out
})
check('gas valve starts closed', gas.valveClosedAtStart)
check('valve closed: burner cannot light, no flame', !gas.litWithValveClosed && !gas.flameWithValveClosed)
check('valve open: burner lit and a flame emitter is active', gas.lit && gas.flame, { relightsWhenValveOpens: gas.relightsWhenValveOpens })
check('closing the valve puts the flame out', !gas.litAfterClosing)

// ------------------------------------------------------------------------------------------------------------------------------
// Barbecue: ignite -> fire and smoke emitters
// ------------------------------------------------------------------------------------------------------------------------------
const bbq = await E(() => {
  const s = window.__showroom
  const w = s.world
  w.act('bbq:ignite_coal')
  s.step(2)
  const kinds = w.emitters().filter((e) => e.object === 'bbq').map((e) => e.kind)
  return { kinds, lit: w.isLit('bbq', 'coal'), alive: s.effects.stats() }
})
check('barbecue: fire and smoke emitters while lit', bbq.lit && bbq.kinds.includes('fire') && bbq.kinds.includes('smoke'), bbq.kinds)
check('particles are alive for the effects', bbq.alive.alive > 0, bbq.alive.byKind)

// ------------------------------------------------------------------------------------------------------------------------------
// Power: TV powered by a socket, grid off -> unpowered; switch toggles a lamp; breaker
// ------------------------------------------------------------------------------------------------------------------------------
const pw = await E(() => {
  const s = window.__showroom
  const w = s.world
  const o = { plugged: w.power.pluggedInto('tv', 'tv') }
  w.act('tv:use_tv')
  s.step(0.5)
  o.on = w.power.isOn('tv', 'tv')
  o.powered = w.power.isPowered('tv', 'tv')
  o.screenOn = s.screens.get('tv').on
  w.power.setGrid(false)
  s.step(0.5)
  o.gridOffPowered = w.power.isPowered('tv', 'tv')
  o.gridOffScreen = s.screens.get('tv').on
  w.power.setGrid(true)
  s.step(0.5)
  o.backPowered = w.power.isPowered('tv', 'tv')
  return o
})
check('TV is plugged into a wall socket (socket: auto)', /^socket_tv_/.test(pw.plugged || ''), pw.plugged)
check('TV on and powered, screen lit', pw.on && pw.powered && pw.screenOn)
check('grid off: TV unpowered and its screen goes dark', !pw.gridOffPowered && !pw.gridOffScreen)
check('grid back: TV powered again', pw.backPowered)

const lamp = await E(() => {
  const s = window.__showroom
  const w = s.world
  const L = s.lamps.find((l) => l.id === 'lamp_bath')
  const o = { off: w.power.isOn('lamp_bath', 'lamp'), light0: L.light.intensity }
  w.act('switch_bath:use_switch')
  s.step(1)
  o.on = w.power.isOn('lamp_bath', 'lamp') && w.power.isPowered('lamp_bath', 'lamp')
  o.light1 = L.light.intensity
  w.power.setBreaker('lights', false)
  s.step(1)
  o.breakerOff = w.power.isPowered('lamp_bath', 'lamp')
  o.light2 = L.light.intensity
  w.power.setBreaker('lights', true)
  w.act('switch_bath:use_switch')
  s.step(1)
  o.offAgain = !w.power.isOn('lamp_bath', 'lamp')
  return o
})
check('switch toggles the lamp and its light', !lamp.off && lamp.on && lamp.light0 === 0 && lamp.light1 > 5, lamp)
check('breaker off: lamp unpowered, light off', !lamp.breakerOff && lamp.light2 === 0)
check('switch turns the lamp off again', lamp.offAgain)

// the breaker panel: every rocker flips its own circuit, only with the door open
const panel = await E(() => {
  const s = window.__showroom
  const w = s.world
  const o = {}
  w.act('switch_bath:use_switch')
  w.act('tv:use_tv')
  s.step(0.5)
  o.lampOn = w.power.isPowered('lamp_bath', 'lamp') && w.power.isOn('lamp_bath', 'lamp')
  o.tvOn = w.power.isPowered('tv', 'tv')
  o.closedAct = w.act('electrical_panel:toggle_breaker_lights')
  o.closedBreaker = w.power.breaker('lights')
  w.setPart('electrical_panel', 'door', 1, true)
  s.step(1)
  o.lightsAct = w.act('electrical_panel:toggle_breaker_lights')
  s.step(1)
  o.lampCut = !w.power.isPowered('lamp_bath', 'lamp')
  o.lampLight = s.lamps.find((l) => l.id === 'lamp_bath').light.intensity
  o.tvStill = w.power.isPowered('tv', 'tv')
  o.rocker = w.partT('electrical_panel', 'breaker_lights')
  o.label = w.interactables().find((i) => i.id === 'electrical_panel:toggle_breaker_lights').label
  w.act('electrical_panel:toggle_breaker_lights')
  w.act('electrical_panel:toggle_breaker_sockets')
  s.step(1)
  o.lampBack = w.power.isPowered('lamp_bath', 'lamp')
  o.tvCut = !w.power.isPowered('tv', 'tv')
  w.act('electrical_panel:toggle_breaker_sockets')
  s.step(1)
  o.tvBack = w.power.isPowered('tv', 'tv')
  w.act('tv:use_tv')
  w.act('switch_bath:use_switch')
  w.setPart('electrical_panel', 'door', 0, true)
  const meter = w.interactables().filter((i) => i.object === 'power_meter').map((i) => i.id)
  o.meter = meter
  return o
})
check('breaker panel: door closed refuses, open lets "Luzes" cut the lamp (light off) but not the TV', panel.lampOn && panel.tvOn && !panel.closedAct && panel.closedBreaker && panel.lightsAct && panel.lampCut && panel.lampLight === 0 && panel.tvStill && panel.rocker < 0.5, panel)
check('breaker panel: prompt names the circuit, "Tomadas" cuts the TV and everything comes back', /Luzes/.test(panel.label) && panel.lampBack && panel.tvCut && panel.tvBack, panel)
check('power meter is in the house with its door interaction', panel.meter.includes('power_meter:toggle_door'), panel.meter)

// ------------------------------------------------------------------------------------------------------------------------------
// Water: shower emits water; empty tank -> not flowing; rain refills
// ------------------------------------------------------------------------------------------------------------------------------
const water = await E(() => {
  const s = window.__showroom
  const w = s.world
  const tank = 'water_tank:main'
  const o = { start: w.water.level(tank) }
  w.act('shower:use_shower')
  s.step(1)
  o.flowing = w.water.isFlowing('shower', 'shower')
  o.emitter = w.emitters().some((e) => e.object === 'shower' && e.kind === 'water')
  o.used = o.start - w.water.level(tank)
  s.drainTank()
  s.step(1)
  o.emptyLevel = w.water.level(tank)
  o.flowingWhenEmpty = w.water.isFlowing('shower', 'shower')
  o.emitterWhenEmpty = w.emitters().some((e) => e.object === 'shower' && e.kind === 'water')
  s.setRain(true)
  s.step(10)
  o.afterRain = w.water.level(tank)
  s.setRain(false)
  w.water.refill(tank, 500)
  s.step(0.5)
  o.flowingAfterRefill = w.water.isFlowing('shower', 'shower')
  return o
})
check('shower on: water emitter active and water flows', water.flowing && water.emitter && water.used > 0, { usedLiters: +water.used.toFixed(3) })
check('tank empty: shower not flowing, no water emitter', water.emptyLevel === 0 && !water.flowingWhenEmpty && !water.emitterWhenEmpty)
check('rain refills the tank', water.afterRain > 1, water.afterRain)
check('refilled tank: shower flows again', water.flowingAfterRefill)

// ------------------------------------------------------------------------------------------------------------------------------
// Seat: sit on the sofa -> camera at the seat eye; Space stands up
// ------------------------------------------------------------------------------------------------------------------------------
const sit = await E(() => {
  const s = window.__showroom
  const w = s.world
  s.teleport('sofa')
  w.act('sofa:sit_seat_1')
  s.step(0.2)
  const eye = s.seatEye('sofa', 'seat_1').eye
  const c = s.camera.position
  return { seat: w.seatOf(), d: Math.hypot(c.x - eye[0], c.y - eye[1], c.z - eye[2]), eyeY: eye[1] }
})
check('sit on the sofa: camera at the seat eye', sit.seat && sit.seat.object === 'sofa' && sit.d < 1e-3, { seat: sit.seat, eyeY: +sit.eyeY.toFixed(2) })
await page.keyboard.press('Space')
const stand = await E(() => {
  const s = window.__showroom
  s.step(0.2)
  const p = s.player
  return { seat: s.world.seatOf(), seated: !!p.seat, eye: s.camera.position.y, blocked: s.collides(p.x, p.z) }
})
check('Space stands up: free, standing eye height', !stand.seat && !stand.seated && Math.abs(stand.eye - 1.6) < 1e-6 && !stand.blocked, stand)

// ------------------------------------------------------------------------------------------------------------------------------
// Soft volumes: walk through the clothes of the clothesline: never blocked, they sway
// ------------------------------------------------------------------------------------------------------------------------------
const cl = await E(() => {
  const s = window.__showroom
  const w = s.world
  const softs = (w.get('clothesline').spec.soft || []).map((x) => x.id)
  s.setView({ x: 4.0, z: 12.7, eye: 1.6, yaw: 0, pitch: 0 })
  s.step(0.5)
  const o = { clothes: softs.length, colliders: w.colliders().filter((c) => c.object === 'clothesline').map((c) => c.id), maxSway: 0, blocked: false }
  for (let i = 0; i < 40; i++) {
    s.walk(0, -1, 0.1)
    for (const id of softs) {
      const sw = w.sway('clothesline', id)
      o.maxSway = Math.max(o.maxSway, Math.abs(sw.ax) + Math.abs(sw.az))
    }
  }
  o.z = s.player.z
  o.x = s.player.x
  return o
})
check('clothes are never colliders (only the poles)', cl.colliders.every((id) => /pole/.test(id)) && cl.colliders.length >= 1, cl.colliders)
check('walking through the clothes: passed through, no collision', cl.z < 10.4, { z: +cl.z.toFixed(2) })
check('clothes sway when pushed', cl.maxSway > 0.02, { maxSway: +cl.maxSway.toFixed(3) })

// ------------------------------------------------------------------------------------------------------------------------------
// Mailbox, trash bin
// ------------------------------------------------------------------------------------------------------------------------------
const mail = await E(() => {
  const s = window.__showroom
  const w = s.world
  const o = { closed: w.accessible('mailbox', 'letters') }
  w.act('mailbox:toggle_flap')
  s.step(1.5)
  o.open = w.accessible('mailbox', 'letters')
  s.events.length = 0
  for (let k = 1; k <= 4 && !o.text; k++) {
    w.act(`mailbox:read_${k}`)
    const m = s.events.find((e) => e.type === 'message')
    if (m) o.text = m.text
  }
  return o
})
check('mailbox flap opens: letters accessible', !mail.closed && mail.open)
check('letters are readable (localized text)', mail.text && mail.text.length > 15 && !/^letter\./.test(mail.text), mail.text)
const bin = await E(() => {
  const s = window.__showroom
  const w = s.world
  const o = { closed: w.accessible('trash_bin', 'bin') }
  w.act('trash_bin:toggle_lid')
  s.step(1.5)
  o.open = w.accessible('trash_bin', 'bin')
  return o
})
check('trash bin lid opens: container accessible', !bin.closed && bin.open)

// ------------------------------------------------------------------------------------------------------------------------------
// Walls: doors never open through them (fitSweep with the real walls)
// ------------------------------------------------------------------------------------------------------------------------------
const sw = await E(() => {
  const s = window.__showroom
  return { fridge: s.sweeps['fridge:door_fridge'], wardrobeCorner: s.sweeps['wardrobe:door_3'], all: Object.values(s.sweeps).filter((v) => v < 1).length }
})
check('fitSweep keeps the corner wardrobe door out of the wall', sw.wardrobeCorner < 1, sw)

// ------------------------------------------------------------------------------------------------------------------------------
// Mirror: the nearest mirror in sight gets a real Reflector
// ------------------------------------------------------------------------------------------------------------------------------
const mir = await E(() => {
  const s = window.__showroom
  s.teleport('wardrobe')
  s.step(0.5)
  return { active: s.mirrors.active(), candidates: s.world.mirrors([s.camera.position.x, s.camera.position.y, s.camera.position.z], 7, 3).map((m) => m.id) }
})
check('nearest mirror gets a real reflector', mir.active.length === 1 && /mirror/.test(mir.active[0]), mir)

// ------------------------------------------------------------------------------------------------------------------------------
// Draw calls in game quality (renderer.info.render.calls, both passes of the mirror and the shadow pass included)
// ------------------------------------------------------------------------------------------------------------------------------
await E(() => window.__showroom.setQuality('game'))
const views = {
  overview: { x: 6, z: 21, eye: 15, yaw: 0, pitch: -0.78 },
  kitchen: { x: 3.2, z: 2.9, look: [1.6, 0.9, 0.3] },
  bathroom: { x: 10.0, z: 3.2, look: [10, 1.3, 0.3] },
  bedroom: { x: 9.7, z: 5.9, look: [11.5, 1.2, 7.0] },
  living: { x: 3.0, z: 4.0, look: [3.0, 0.9, 7.8] },
  yard: { x: 7.4, z: 9.0, look: [7.4, 1.2, 13] },
}
const calls = await E((v) => {
  const s = window.__showroom
  const out = {}
  for (const [name, p] of Object.entries(v)) {
    s.setView({ x: p.x, z: p.z, eye: p.eye || 1.6, yaw: p.yaw, pitch: p.pitch })
    if (p.look) s.lookAt(p.look[0], p.look[1], p.look[2])
    s.step(0.3)
    s.renderer.shadowMap.needsUpdate = true
    s.render()
    const withShadow = s.drawCalls()
    s.render()
    out[name] = { withShadowPass: withShadow, steady: s.drawCalls() }
  }
  return out
}, views)
const worst = Math.max(...Object.values(calls).map((c) => c.withShadowPass))
check(`game quality: draw calls below ${GAME_CALLS_MAX}`, worst < GAME_CALLS_MAX, { worst, calls })
await E(() => window.__showroom.setQuality('high'))

// ------------------------------------------------------------------------------------------------------------------------------
// Screenshots (high quality, desktop): the scene is set up through the same world calls a player would trigger
// ------------------------------------------------------------------------------------------------------------------------------
async function shot(name, setup, p, ctxPage = page) {
  await ctxPage.evaluate(
    ([code, view]) => {
      const s = window.__showroom
      // eslint-disable-next-line no-new-func
      if (code) new Function('s', code)(s)
      if (view) {
        s.setView({ x: view.x, z: view.z, eye: view.eye || 1.6, yaw: view.yaw, pitch: view.pitch, fov: view.fov })
        if (view.look) s.lookAt(view.look[0], view.look[1], view.look[2])
      }
      s.step(1.2, 60)
      s.hud()
      s.render()
      s.render()
    },
    [setup, p],
  )
  const png = join(shotsDir, `${name}.png`)
  await ctxPage.screenshot({ path: png })
  if (statSync(png).size > 400 * 1024) {
    unlinkSync(png)
    await ctxPage.screenshot({ path: join(shotsDir, `${name}.jpg`), type: 'jpeg', quality: 80 })
    return `${name}.jpg`
  }
  return `${name}.png`
}
for (const f of readdirSync(shotsDir)) unlinkSync(join(shotsDir, f))
const saved = []
// every setup is "make sure X is on": the earlier checks left some things toggled
const PRE = 'const w = s.world, st = () => w.serialize().objects, ensure = (id, isOn) => { if (!isOn) w.act(id) };'
await E(() => window.__showroom.setWind(true))
saved.push(await shot('01-overview', `${PRE} ensure("shower:use_shower", st().shower.fixtures.shower); ensure("tv:use_tv", w.power.isOn("tv","tv")); ensure("bbq:ignite_coal", w.isLit("bbq","coal"))`, views.overview))
saved.push(
  await shot(
    '02-kitchen',
    `${PRE} ensure("switch_kitchen:use_switch", w.power.isOn("lamp_kitchen","lamp")); ensure("fridge:toggle_door_fridge", w.partT("fridge","door_fridge") > 0.5); ensure("gas_bottle:use_gas", w.partT("gas_bottle","valve") > 0.5); ensure("stove:use_burner_1", st().stove.burners.burner_1.on); ensure("stove:use_burner_3", st().stove.burners.burner_3.on); ensure("stove:use_burner_4", st().stove.burners.burner_4.on); ensure("sink_kitchen:use_tap", st().sink_kitchen.fixtures.tap); ensure("microwave:use_microwave", w.power.isOn("microwave","microwave"))`,
    { x: 3.4, z: 2.2, look: [2.8, 0.95, 0.3], fov: 72 },
  ),
)
saved.push(await shot('03-bathroom', `${PRE} ensure("shower:use_shower", st().shower.fixtures.shower); ensure("switch_bath:use_switch", w.power.isOn("lamp_bath","lamp")); w.setPart("shower","glass_door",1)`, { x: 10.0, z: 3.2, look: [9.8, 1.25, 0.3] }))
saved.push(
  await shot(
    '04-bedroom-wardrobe',
    `${PRE} ensure("switch_bedroom:use_switch", w.power.isOn("lamp_bedroom","lamp")); ensure("wardrobe:toggle_door_1", w.partT("wardrobe","door_1") > 0.5); ensure("wardrobe:toggle_door_2", w.partT("wardrobe","door_2") > 0.5); ensure("wardrobe:toggle_drawer_2", w.partT("wardrobe","drawer_2") > 0.5)`,
    { x: 9.7, z: 5.9, look: [11.5, 1.25, 7.0] },
  ),
)
saved.push(await shot('05-yard-bbq-clothesline', `${PRE} ensure("bbq:ignite_coal", w.isLit("bbq","coal")); ensure("trash_bin:toggle_lid", w.partT("trash_bin","lid") > 0.5); s.step(3)`, { x: 6.9, z: 8.4, look: [6.6, 1.2, 12.6], fov: 94 }))
saved.push(await shot('05b-clothesline', `s.step(1)`, { x: 4.2, z: 8.6, look: [4.2, 1.2, 11.0], fov: 62 }))
saved.push(await shot('06-living-night', `${PRE} s.setNight(true); ensure("switch_living:use_switch", w.power.isOn("lamp_living","lamp")); ensure("switch_kitchen:use_switch", w.power.isOn("lamp_kitchen","lamp")); ensure("tv:use_tv", w.power.isOn("tv","tv"))`, { x: 6.6, z: 6.6, look: [2.5, 1.2, 3.0] }))
await E(() => window.__showroom.setNight(false))

// ------------------------------------------------------------------------------------------------------------------------------
// Real input on the desktop page: keyboard walk, drag-look, E on a switch, panel click teleports
// ------------------------------------------------------------------------------------------------------------------------------
await E(() => {
  const s = window.__showroom
  s.setView({ x: 5.5, z: 6.4, yaw: 0, pitch: 0, fov: 72 })
  s.pause(false)
})
await page.locator('#c').click({ position: { x: 300, y: 300 } })
const p0 = await E(() => ({ x: window.__showroom.player.x, z: window.__showroom.player.z, yaw: window.__showroom.player.yaw }))
await page.keyboard.down('KeyW')
// software GL is slow and the frame time is clamped: hold the key until the player has moved (at most 5 s)
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(200)
  const q = await E(() => ({ x: window.__showroom.player.x, z: window.__showroom.player.z }))
  if (Math.hypot(q.x - p0.x, q.z - p0.z) > 0.3) break
}
await page.keyboard.up('KeyW')
await page.mouse.move(300, 300)
await page.mouse.down()
await page.mouse.move(380, 300, { steps: 6 })
await page.mouse.up()
await page.waitForTimeout(200)
const p1 = await E(() => ({ x: window.__showroom.player.x, z: window.__showroom.player.z, yaw: window.__showroom.player.yaw }))
check('W key walks forward (collision-checked)', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.15, { moved: +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2) })
check('mouse drag turns the view', Math.abs(p1.yaw - p0.yaw) > 0.05, { dyaw: +(p1.yaw - p0.yaw).toFixed(3) })
const lampBefore = await E(() => {
  const s = window.__showroom
  document.exitPointerLock()
  s.pause(true)
  s.teleport('switch_bedroom')
  return s.world.power.isOn('lamp_bedroom', 'lamp')
})
await page.keyboard.press('KeyE')
const ke = await E(() => {
  const s = window.__showroom
  s.step(0.5)
  return { on: s.world.power.isOn('lamp_bedroom', 'lamp') }
})
check('E on the bedroom switch toggles the bedroom lamp', ke.on !== lampBefore, { before: lampBefore, after: ke.on })
await page.locator('#objList button[data-id="stove"]').click()
const tp = await E(() => {
  const s = window.__showroom
  s.hud()
  const st = s.entries.get('stove')
  return { dist: Math.hypot(s.player.x - st.x, s.player.z - st.z), prompt: document.querySelector('#prompt').textContent, hidden: document.querySelector('#prompt').hidden }
})
check('object list click teleports in front of the object', tp.dist > 0.8 && tp.dist < 2.5, { dist: +tp.dist.toFixed(2), prompt: tp.prompt })

// mobile: 390 px wide, touch
const mobile = await openPage({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
const mp = mobile.page
const mob = await mp.evaluate(() => {
  const s = window.__showroom
  return { w: innerWidth, scrollW: document.documentElement.scrollWidth, quality: s.state.quality, touch: !document.querySelector('#touch').hidden }
})
check('mobile 390 px: no horizontal scroll, game quality by default, touch controls shown', mob.scrollW <= mob.w && mob.quality === 'game' && mob.touch, mob)
saved.push(await shot('07-mobile-390', 's.world.act("gas_bottle:use_gas"); s.world.act("stove:use_burner_1"); s.world.act("stove:use_burner_4"); s.world.act("stove:use_burner_2")', { x: 3.1, z: 1.55, look: [3.08, 0.9, 0.2] }, mp))
await mp.evaluate(() => window.__showroom.setPanel(true))
await mp.waitForTimeout(400)
const panelBox = await mp.evaluate(() => {
  const r = document.querySelector('#panel').getBoundingClientRect()
  return { left: r.left, right: r.right, width: r.width, vw: innerWidth }
})
check('mobile panel fits the 390 px viewport', panelBox.left >= 0 && panelBox.right <= panelBox.vw + 1, panelBox)
const mpPng = join(shotsDir, '08-mobile-390-panel.png')
await mp.screenshot({ path: mpPng })
if (statSync(mpPng).size > 400 * 1024) {
  unlinkSync(mpPng)
  await mp.screenshot({ path: join(shotsDir, '08-mobile-390-panel.jpg'), type: 'jpeg', quality: 80 })
  saved.push('08-mobile-390-panel.jpg')
} else saved.push('08-mobile-390-panel.png')

// ------------------------------------------------------------------------------------------------------------------------------
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5))
check('zero external requests', external.length === 0, external.slice(0, 5))
console.log('\nshots:', saved.join(', '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
