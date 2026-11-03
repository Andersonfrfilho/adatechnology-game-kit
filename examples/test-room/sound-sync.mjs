// Sound check of the player's body in the real test room (dist/test-room.html): what the room plays when the player walks and runs over each floor,
// jumps, lands, punches, kicks, shoves and swings a knife, a bat or an axe, and when, in both cameras. It drives the page like a player (keys held, real
// frames) and records:
//   - every `audio.play` (id asked, take played, volume) with its wall clock,
//   - every source node the engine actually starts (`AudioScheduledSourceNode.start`), with how far ahead it was scheduled, so the delay to the sound is measured,
//   - every footfall the room sends (the body's heel strikes) and every behaviour-log line (strike, melee, landing).
// It scores the criteria of the sound checklist a machine can measure (sons/checklist-sons.md, section 2):
//   C1 sync: footstep within 20 ms of its footfall; the hit within 20 ms of the blow's contact; the swing peaks before the contact,
//   C2 right sound: the footstep of the floor walked on and of the gait, the swing and hit of the tool used,
//   C5 variation: at least 4 takes in 10 of the same action and never the same take twice in a row,
//   C9 rapid repeat: running and a fast series of punches keep every sound (nothing dropped by the voice limiter).
// Writes shots/sound-sync.json and a screenshot per camera; exits 1 when a criterion fails (BASELINE=1 only records).
// Run: node build.mjs && node sound-sync.mjs
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = (() => {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* next */
    }
  }
  throw new Error('playwright not found')
})()

const dist = join(here, 'dist/test-room.html')
if (!existsSync(dist)) throw new Error('build first: node build.mjs')
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })
const BASELINE = process.env.BASELINE === '1'
const SYNC_MS = 20

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await context.route('**/*', (route) => (/^(file|data|blob|about):/.test(route.request().url()) ? route.continue() : route.abort()))
// the probe: every node start the engine makes, with how far ahead of the audio clock it is scheduled
await context.addInitScript(() => {
  const starts = []
  window.__soundStarts = starts
  for (const Node of [window.AudioBufferSourceNode, window.OscillatorNode]) {
    const start = Node.prototype.start
    Node.prototype.start = function (when = 0, ...rest) {
      const ctx = this.context
      starts.push({ at: performance.now(), lead: Math.max(0, when - ctx.currentTime) * 1000 })
      return start.call(this, when, ...rest)
    }
  }
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${pathToFileURL(dist).href}?table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 300000 })

await page.evaluate(() => {
  const room = window.__testRoom
  const plays = []
  const lines = []
  const feet = []
  Object.assign(window, { __plays: plays, __lines: lines, __feet: feet })
  const play = room.audio.play.bind(room.audio)
  const add = room.log.add.bind(room.log)
  // the room's clock (simulated seconds) of each play: what the blow's timing is measured in, whatever the frame rate
  const simNow = () => room.log.add({ channel: 'probe', type: 'probe', text: '' }).t
  room.audio.play = (id, options = {}) => {
    const at = performance.now()
    const startsBefore = window.__soundStarts.length
    const handle = play(id, options)
    plays.push({ at, t: simNow(), id, take: handle?.plan.id ?? null, delay: (options.delay ?? 0) * 1000, volume: options.volume ?? 1, startsBefore })
    return handle
  }
  room.log.add = (e) => {
    const entry = add(e)
    if (e.channel !== 'probe') lines.push({ at: performance.now(), t: entry.t, type: e.type, data: e.data ?? null })
    return entry
  }
  room.on('footfall', (e) => feet.push({ at: performance.now(), ...e }))
  room.audio.unlock()
  room.audio.warmUp()
})

/** Holds the keys until `done()` (polled in the page) is true or `ms` pass, and answers the wall clock the keys went up. */
const holdUntil = async (keys, done, ms) => {
  for (const k of keys) await page.keyboard.down(k)
  const until = Date.now() + ms
  while (Date.now() < until && !(await page.evaluate(done))) await page.waitForTimeout(150)
  for (const k of [...keys].reverse()) await page.keyboard.up(k)
  return now()
}
const count = (list, test = '') => page.evaluate(([l, s]) => window[l].filter((e) => !s || (e.id ?? e.type ?? '').startsWith(s)).length, [list, test])
const look = (eye, target) => page.evaluate(([e, t]) => window.__testRoom.look(e, t), [eye, target])
const tool = (id) => page.evaluate((i) => window.__testRoom.setTool(i), id)
const now = () => page.evaluate(() => performance.now())

const phases = []
// the CI and this container have no GPU: the room runs at a few frames per second there, so each phase waits for the last blow to land before the next one starts
const phase = async (id, expect, run, settle = 2000) => {
  const from = await now()
  const keysUp = await run()
  await page.waitForTimeout(settle)
  phases.push({ id, expect, from, to: await now(), keysUp: typeof keysUp === 'number' ? keysUp : null })
}

// the floors: strips of the ground profiles across the room, walked one by one from the start (z = 6) toward the wall
const FLOORS = [
  ['concrete', 'concrete_slab'],
  ['grass', 'lawn'],
  ['asphalt', 'road'],
  ['wood', 'wood_floor'],
  ['tile', 'tile_floor'],
  ['dirt', 'dirt'],
  ['sand', 'sand'],
]
await page.evaluate((floors) => {
  const room = window.__testRoom
  room.terrain.setLayout({ surface: 'concrete_slab', zones: floors.map(([, profile], i) => ({ rect: [-13 + i * 3.6, -6, -13 + i * 3.6 + 3, 8], surface: profile })) })
}, FLOORS)

const camerasTested = []
for (const camera of ['first', 'third']) {
  await page.evaluate((c) => window.__testRoom.setCameraMode(c), camera)
  camerasTested.push(camera)
  for (const [surface] of FLOORS) {
    const x = -13 + FLOORS.findIndex(([s]) => s === surface) * 3.6 + 1.5
    for (const gait of ['walk', 'run']) {
      await look([x, 1.7, 7], [x, 1.7, 0])
      // walk until the body has put a foot down five times (the room may run at a few frames per second without a GPU)
      const before = await count('__feet')
      await phase(
        `${camera}:${gait}:${surface}`,
        { footstep: `footstep_${surface}_${gait}` },
        () => holdUntil(gait === 'run' ? ['ShiftLeft', 'KeyW'] : ['KeyW'], `window.__feet.length >= ${before + 5}`, 25000),
        1200,
      )
    }
  }
  await look([-12, 1.7, 7], [-12, 1.7, 0])
  const jumps = await count('__plays', 'jump')
  await phase(`${camera}:jump`, { jump: 'jump', land: 'land_concrete_light' }, () => holdUntil(['Space'], `window.__plays.filter((p) => p.id === 'jump').length > ${jumps}`, 10000), 3000)
  // blows at the bookcase (wood), then into the air
  const BLOWS = { hand: ['punch_swing', 'punch_hit_object'], kick: ['kick_swing', 'kick_hit_object'], shove: [null, 'shove_two_hands'], knife: ['knife_swing', 'knife_hit_object'], baseball_bat: ['blunt_swing', 'blunt_hit_object'], axe: ['axe_swing', 'axe_hit_object'] }
  for (const [id, [swing, hit]] of Object.entries(BLOWS)) {
    // the bookcase back where it stood (the axe and the bat move it)
    await page.evaluate(() => window.__testRoom.resetAll())
    await tool(id)
    await page.waitForTimeout(1500)
    await look([-2.4, 1.5, 0], [-3.5, 1.0, 0])
    await phase(`${camera}:${id}:wood`, { swing, hit }, async () => {
      for (let i = 0; i < 4; i++) {
        if (id === 'kick') await page.evaluate(() => window.__testRoom.kick())
        else await page.evaluate(() => window.__testRoom.use())
        await page.waitForTimeout(1500)
      }
    })
    await look([0, 1.6, 6], [0, 1.6, 14])
    await phase(`${camera}:${id}:air`, { swing, hit: null }, async () => {
      if (id === 'kick') await page.evaluate(() => window.__testRoom.kick())
      else await page.evaluate(() => window.__testRoom.use())
    })
  }
  // ten punches in a row at the bookcase: the takes and the limiter
  await page.evaluate(() => window.__testRoom.resetAll())
  await tool('hand')
  await look([-2.4, 1.5, 0], [-3.5, 1.0, 0])
  await phase(`${camera}:punch-x10`, { swing: 'punch_swing', hit: 'punch_hit_object', series: 10 }, async () => {
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.__testRoom.use())
      await page.waitForTimeout(900)
    }
  })
  await look([-1.8, 1.7, 1.8], [-3.5, 0.9, 0])
  await page.screenshot({ path: join(shots, `sound-sync-${camera}.png`) })
}

const data = await page.evaluate(() => ({ plays: window.__plays, lines: window.__lines, starts: window.__soundStarts, feet: window.__feet }))
await browser.close()

// ---- scoring --------------------------------------------------------------------------------------------------------------------------------------
const within = (list, p) => list.filter((e) => e.at >= p.from && e.at <= p.to)
/** ms from `at` to the moment the first node of the play after it sounds: the wait to the play call, the deferred start, and how far ahead it is scheduled. */
const soundDelay = (at, id) => {
  const play = data.plays.find((x) => x.at >= at - 1 && x.id === id)
  if (!play) return null
  const start = data.starts.find((s, i) => i >= play.startsBefore && s.at >= play.at - 1)
  return start ? Math.round((start.at - at + start.lead) * 10) / 10 : null
}
const takesOf = (plays, id) => plays.filter((p) => p.id === id).map((p) => p.take)
const repeats = (takes) => takes.filter((t, i) => i > 0 && t === takes[i - 1]).length
const rows = []
const failures = []
const check = (row, ok, label) => {
  row.checks.push({ ok, label })
  if (!ok) failures.push(`${row.phase}: ${label}`)
}
for (const p of phases) {
  const plays = within(data.plays, p)
  const lines = within(data.lines, p)
  const feet = within(data.feet, p)
  const row = { phase: p.id, ids: [...new Set(plays.map((x) => x.id))], checks: [], numbers: {} }
  if (p.expect.footstep) {
    // a footstep after the keys went up is the body settling, whatever the gait was
    const steps = plays.filter((x) => x.id.startsWith('footstep_') && (p.keysUp === null || x.at <= p.keysUp))
    const delays = feet.map((f) => soundDelay(f.at, p.expect.footstep)).filter((d) => d !== null)
    row.numbers = { footfalls: feet.length, footsteps: steps.length, delaysMs: delays, takes: takesOf(plays, p.expect.footstep) }
    check(row, feet.length >= 2, `footfalls from the body: ${feet.length}`)
    check(row, steps.length >= feet.length - 1 && steps.length > 0, `a footstep for each footfall: ${steps.length}/${feet.length}`)
    check(row, steps.every((x) => x.id === p.expect.footstep), `C2 footstep ${p.expect.footstep}: ${[...new Set(steps.map((x) => x.id))].join(',')}`)
    check(row, delays.length > 0 && Math.max(...delays) <= SYNC_MS, `C1 footstep ≤ ${SYNC_MS} ms after the heel: ${JSON.stringify(delays)}`)
    check(row, repeats(row.numbers.takes) === 0, `C5 no take twice in a row`)
  }
  if (p.expect.jump) {
    check(row, plays.some((x) => x.id === p.expect.jump), `C2 jump sound`)
    const lands = lines.filter((l) => l.type === 'landing_player')
    check(row, lands.length > 0 && plays.some((x) => x.id.startsWith('land_concrete_')), `C2 landing on concrete (${lands.length} landings)`)
    row.numbers = { landings: lands.map((l) => l.data?.speedMs), landDelaysMs: lands.map((l) => soundDelay(l.at, plays.find((x) => x.id.startsWith('land_'))?.id ?? '')) }
    check(row, row.numbers.landDelaysMs.every((d) => d !== null && d <= SYNC_MS), `C1 landing ≤ ${SYNC_MS} ms: ${JSON.stringify(row.numbers.landDelaysMs)}`)
  }
  if ('hit' in p.expect) {
    // a contact is a `melee` line with the object it hit (a miss logs one too, without)
    const melees = lines.filter((l) => l.type === 'melee' && l.data?.damage !== undefined && l.data?.distanceM !== undefined)
    const strikes = lines.filter((l) => l.type === 'strike')
    const swings = plays.filter((x) => x.id === p.expect.swing)
    const hits = plays.filter((x) => p.expect.hit && x.id === p.expect.hit)
    const hitDelays = p.expect.hit ? melees.map((l) => soundDelay(l.at, p.expect.hit)) : []
    // the swing starts in the room's time a little before the contact (its loudest point is SWING_LEAD later): ms of room time from the swing to the contact
    const peaks = swings.map((s) => {
      const contact = melees.find((l) => l.t >= s.t) ?? null
      return contact ? Math.round((contact.t - s.t) * 1000) : null
    })
    row.numbers = { strikes: strikes.length, contacts: melees.length, swings: swings.length, hits: hits.length, hitDelaysMs: hitDelays, swingStartBeforeContactMs: peaks, takes: takesOf(plays, p.expect.hit ?? p.expect.swing) }
    if (p.expect.swing) check(row, swings.length >= Math.max(1, strikes.length, p.expect.hit === null ? 1 : 0), `C2 a swing (${p.expect.swing}) per blow: ${swings.length}`)
    if (p.expect.hit) {
      check(row, hits.length === melees.length && hits.length > 0, `C2 the hit (${p.expect.hit}) on each contact: ${hits.length}/${melees.length}`)
      check(row, hitDelays.every((d) => d !== null && d <= SYNC_MS), `C1 hit ≤ ${SYNC_MS} ms after the contact: ${JSON.stringify(hitDelays)}`)
      if (p.expect.swing) check(row, peaks.length > 0 && peaks.every((d) => d !== null && d >= 0 && d <= 200), `C1 the swing starts 0-200 ms (room time) before the contact: ${JSON.stringify(peaks)}`)
    } else check(row, !plays.some((x) => /_hit|_stab|_chop|shove_two/.test(x.id)), 'C2 no hit sound into the air')
    if (p.expect.series) {
      const takes = takesOf(plays, p.expect.hit)
      check(row, new Set(takes).size >= 4, `C5 ≥ 4 takes in ${takes.length} punches: ${new Set(takes).size}`)
      check(row, repeats(takes) === 0, 'C5 never the same take twice in a row')
      check(row, plays.filter((x) => x.take === null).length === 0, `C9 nothing dropped: ${plays.filter((x) => x.take === null).map((x) => x.id).join(',') || 'none'}`)
    }
  }
  rows.push(row)
}
const report = { when: new Date().toISOString(), cameras: camerasTested, errors, failures, rows }
writeFileSync(join(shots, BASELINE ? 'sound-sync-baseline.json' : 'sound-sync.json'), JSON.stringify(report, null, 2))
for (const r of rows) {
  console.log(`${r.checks.every((c) => c.ok) ? 'PASS' : 'FAIL'}  ${r.phase}`)
  for (const c of r.checks) if (!c.ok) console.log(`   ✗ ${c.label}`)
}
if (errors.length) console.log('page errors:', errors)
console.log(`\n${rows.filter((r) => r.checks.every((c) => c.ok)).length}/${rows.length} phases pass`)
if (!BASELINE && (failures.length || errors.length)) process.exit(1)
