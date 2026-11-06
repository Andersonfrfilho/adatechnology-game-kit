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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** @typedef {import('@adatechnology/game-test-room').TestRoom} TestRoom */
/** @typedef {Parameters<TestRoom['setCameraMode']>[0]} CameraMode */
/** @typedef {Parameters<TestRoom['log']['add']>[0]} NewLogEntry */
/** @typedef {SoundSyncPlay} SyncPlay */
/** @typedef {SoundSyncLine} SyncLine */
/** @typedef {SoundSyncFoot} SyncFoot */
/** @typedef {SoundSyncStart} SyncStart */
/** @typedef {{ plays: SyncPlay[]; lines: SyncLine[]; starts: SyncStart[]; feet: SyncFoot[] }} SyncData */
/** @typedef {{ footstep?: string; jump?: string; land?: string; swing?: string | null; hit?: string | null; series?: number }} SyncExpect */
/** @typedef {{ position: number[]; camera: string }} SyncAt */
/** @typedef {{ id: string; camera: string | null; load: number; expect: SyncExpect; from: number; to: number; keysUp: number | null; at: SyncAt }} SyncPhase */
/** @typedef {{ ok: boolean; label: string }} SyncCheck */
/** @typedef {{ [key: string]: unknown; takes?: (string | null)[]; landDelaysMs?: (number | null)[] }} SyncNumbers */
/** @typedef {{ phase: string; at: SyncAt; ids: string[]; checks: SyncCheck[]; numbers: SyncNumbers }} SyncRow */

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
/** @type {typeof import('playwright')} */
const { chromium } = (() => {
  for (const id of ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright']) {
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

// RESCORE=1 scores the last run again (shots/sound-sync-raw.json) without playing it
const RESCORE = process.env.RESCORE === '1'
const raw = /** @type {{ phases: SyncPhase[]; datasets: SyncData[]; cameras: string[]; errors: string[] } | null} */ (RESCORE ? JSON.parse(readFileSync(join(shots, 'sound-sync-raw.json'), 'utf8')) : null)
const phases = raw?.phases ?? []
const datasets = raw?.datasets ?? []
const camerasTested = raw?.cameras ?? []
const errors = raw?.errors ?? []
if (!RESCORE) {
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await context.route('**/*', (route) => (/^(file|data|blob|about):/.test(route.request().url()) ? route.continue() : route.abort()))
// the probe: every node start the engine makes, with how far ahead of the audio clock it is scheduled
await context.addInitScript(() => {
  /** @type {SyncStart[]} */
  const starts = []
  window.__soundStarts = /** @type {Window['__soundStarts']} */ (/** @type {unknown} */ (starts))
  for (const Node of [window.AudioBufferSourceNode, window.OscillatorNode]) {
    const start = /** @type {(this: AudioScheduledSourceNode, ...args: number[]) => void} */ (Node.prototype.start)
    Node.prototype.start = function (/** @type {number} */ when = 0, /** @type {number[]} */ ...rest) {
      const ctx = this.context
      starts.push({ at: performance.now(), lead: Math.max(0, when - ctx.currentTime) * 1000 })
      return start.call(this, when, ...rest)
    }
  }
})
const page = await context.newPage()

page.on('pageerror', (e) => errors.push(e.message))
// the floors: strips of the ground profiles across the back of the room (z 3 to 13.6), walked one by one from z = 12.5 toward the shelf;
// they stop short of the blow spot so a raised floor (the wooden deck) never lifts the player while striking
const FLOORS = [
  ['concrete', 'concrete_slab'],
  ['grass', 'lawn'],
  ['asphalt', 'road'],
  ['wood', 'wood_floor'],
  ['tile', 'tile_floor'],
  ['dirt', 'dirt'],
  ['sand', 'sand'],
]

// the room is loaded fresh for each camera, so the blows of one camera never leave the other a shelf knocked over or a plank to stand on
const boot = async () => {
await page.goto(`${pathToFileURL(dist).href}?table=0`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 300000 })

await page.evaluate(() => {
  const room = window.__testRoom
  /** @type {SyncPlay[]} */
  const plays = []
  /** @type {SyncLine[]} */
  const lines = []
  /** @type {SyncFoot[]} */
  const feet = []
  Object.assign(window, { __plays: plays, __lines: lines, __feet: feet })
  /** @typedef {NonNullable<TestRoom['audio']>} RoomAudio */
  const play = /** @type {RoomAudio} */ (room.audio).play.bind(room.audio)
  const add = room.log.add.bind(room.log)
  // the room's clock (simulated seconds) of each play: what the blow's timing is measured in, whatever the frame rate
  const simNow = () => room.log.add(/** @type {NewLogEntry} */ (/** @type {unknown} */ ({ channel: 'probe', type: 'probe', text: '' }))).t
  ;/** @type {RoomAudio} */ (room.audio).play = (id, options = {}) => {
    const at = performance.now()
    const startsBefore = window.__soundStarts.length
    const handle = play(id, options)
    plays.push({ at, t: simNow(), id, take: handle?.plan.id ?? null, delay: (options.delay ?? 0) * 1000, volume: options.volume ?? 1, startsBefore })
    return handle
  }
  room.log.add = (e) => {
    const entry = add(e)
    if (/** @type {string} */ (e.channel) !== 'probe') lines.push({ at: performance.now(), t: entry.t, type: e.type, data: e.data ?? null })
    return entry
  }
  room.on('footfall', (e) => feet.push({ at: performance.now(), .../** @type {Omit<SyncFoot, 'at'>} */ (e) }))
  ;/** @type {RoomAudio} */ (room.audio).unlock()
  ;/** @type {RoomAudio} */ (room.audio).warmUp()
})
await page.evaluate((floors) => {
  const room = window.__testRoom
  room.terrain.setLayout({ surface: 'concrete_slab', zones: floors.map(([, profile], i) => ({ rect: [-13 + i * 3.6, 3, -13 + i * 3.6 + 3, 13.6], surface: profile })) })
}, /** @type {[string, string][]} */ (FLOORS))
}

/** Holds the keys until `done()` (polled in the page) is true or `ms` pass, and answers the wall clock the keys went up. */
const holdUntil = async (/** @type {string[]} */ keys, /** @type {string} */ done, /** @type {number} */ ms) => {
  for (const k of keys) await page.keyboard.down(k)
  const until = Date.now() + ms
  while (Date.now() < until && !(await page.evaluate(done))) await page.waitForTimeout(150)
  for (const k of [...keys].reverse()) await page.keyboard.up(k)
  return now()
}
const count = (/** @type {string} */ list, test = '') => page.evaluate(([l, s]) => /** @type {Record<string, { id?: string; type?: string }[]>} */ (/** @type {unknown} */ (window))[l].filter((e) => !s || (e.id ?? e.type ?? '').startsWith(s)).length, [list, test])
const look = (/** @type {number[]} */ eye, /** @type {number[]} */ target) => page.evaluate(([e, t]) => window.__testRoom.look(/** @type {Vec3} */ (e), /** @type {Vec3} */ (t)), [eye, target])
const tool = (/** @type {string} */ id) => page.evaluate((/** @type {string} */ i) => window.__testRoom.setTool(i), id)
const now = () => page.evaluate(() => performance.now())


// 0.26 m from the side of the shelf's upright: inside the reach of every tool (the knife's is 0.4 m)
const AT_SHELF = [-2.62, 1.5, 0]
// the CI and this container have no GPU: the room runs at a few frames per second there, so each phase waits for the last blow to land before the next one starts
/** @type {string | null} */
let camera = null
// each page load records its own clocks (performance.now starts again): a phase is scored against the load it ran in
let load = -1

const collect = async () => {
  datasets[load] = await page.evaluate(() => ({ plays: window.__plays, lines: window.__lines, starts: /** @type {SyncStart[]} */ (/** @type {unknown} */ (window.__soundStarts)), feet: window.__feet }))
}
const fresh = async () => {
  if (load >= 0) await collect()
  load++
  await boot()
  await page.evaluate((/** @type {string | null} */ c) => window.__testRoom.setCameraMode(/** @type {CameraMode} */ (c)), camera)
}
/** One blow: uses the tool (or kicks) and waits for the room to swing it (a `strike` or `melee` line); a tool still drawing or recovering ignores the
 * use, so it tries again, up to three times. Then waits for the blow to land. */
const blow = async (/** @type {boolean} */ kick) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await page.evaluate(() => window.__lines.filter((/** @type {{ type: string; }} */ l) => l.type === 'strike' || l.type === 'melee').length)
    await page.evaluate((k) => (k ? window.__testRoom.kick() : window.__testRoom.use()), kick)
    const until = Date.now() + 4000
    while (Date.now() < until) {
      if (await page.evaluate((/** @type {number} */ n) => window.__lines.filter((/** @type {{ type: string; }} */ l) => l.type === 'strike' || l.type === 'melee').length > n, before)) {
        await page.waitForTimeout(1500)
        return
      }
      await page.waitForTimeout(150)
    }
  }
}
const phase = async (/** @type {string} */ id, /** @type {SyncExpect} */ expect, /** @type {() => Promise<unknown>} */ run, settle = 2000) => {
  const from = await now()
  const keysUp = await run()
  await page.waitForTimeout(settle)
  const at = await page.evaluate(() => ({ position: window.__testRoom.playerPosition.map((/** @type {number} */ v) => Math.round(v * 100) / 100), camera: window.__testRoom.cameraMode }))
  phases.push({ id, camera, load, expect, from, to: await now(), keysUp: typeof keysUp === 'number' ? keysUp : null, at })
}


for (camera of (process.env.CAMERAS ?? 'first,third').split(',')) {
  await fresh()
  camerasTested.push(camera)
  for (const [surface] of process.env.SKIP_WALK ? [] : FLOORS) {
    const x = -13 + FLOORS.findIndex(([s]) => s === surface) * 3.6 + 1.5
    for (const gait of ['walk', 'run']) {
      await look([x, 1.7, 12.5], [x, 1.7, 0])
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
  await look([-12, 1.7, 12.5], [-12, 1.7, 0])
  const jumps = await count('__plays', 'jump')
  const lands = await count('__lines', 'landing_player')
  await phase(`${camera}:jump`, { jump: 'jump', land: 'land_concrete_light' }, async () => {
    const up = await holdUntil(['Space'], `window.__plays.filter((p) => p.id === 'jump').length > ${jumps}`, 10000)
    // the landing: at a few frames per second the jump lasts several seconds of wall time
    const until = Date.now() + 20000
    while (Date.now() < until && (await count('__lines', 'landing_player')) <= lands) await page.waitForTimeout(200)
    return up
  }, 800)
  // blows at the bookcase (wood), then into the air
  // ten punches in a row at the bookcase: the takes and the limiter
  await page.evaluate(() => window.__testRoom.resetAll())
  await tool('hand')
  await look(AT_SHELF, [-3.5, 1.0, 0])
  await phase(`${camera}:punch-x10`, { swing: 'punch_swing', hit: 'punch_hit_object', series: 10 }, async () => {
    // each punch waits for the room to throw it, so all ten land however slow the frames are
    for (let i = 0; i < 10; i++) await blow(false)
  })
  // the bat and the kick last, each on a fresh load: they knock the shelf over, and its planks stay on the floor for the player to stand on
  const BLOWS = { hand: ['punch_swing', 'punch_hit_object'], knife: ['knife_swing', 'knife_hit_object'], axe: ['axe_swing', 'axe_hit_object'], shove: [null, 'shove_two_hands'], baseball_bat: ['blunt_swing', 'blunt_hit_object'], kick: ['kick_swing', 'kick_hit_object'] }
  for (const [id, [swing, hit]] of Object.entries(BLOWS)) {
    if (id === 'baseball_bat' || id === 'kick') await fresh()
    await page.evaluate(() => window.__testRoom.resetAll())
    await tool(id)
    await page.waitForTimeout(1500)
    await look(AT_SHELF, [-3.5, 1.0, 0])
    await phase(`${camera}:${id}:wood`, { swing, hit }, async () => {
      for (let i = 0; i < 4; i++) await blow(id === 'kick')
    })
    await look([12.5, 1.6, -2], [12.5, 1.6, -14])
    await page.waitForTimeout(1500)
    await phase(`${camera}:${id}:air`, { swing, hit: null }, () => blow(id === 'kick'))
  }
  await look([-1.8, 1.7, 1.8], [-3.5, 0.9, 0])
  await page.screenshot({ path: join(shots, `sound-sync-${camera}.png`) })
}
await collect()
await browser.close()
writeFileSync(join(shots, 'sound-sync-raw.json'), JSON.stringify({ phases, datasets, cameras: camerasTested, errors }))
}

// ---- scoring --------------------------------------------------------------------------------------------------------------------------------------
let data = /** @type {SyncData} */ (/** @type {unknown} */ (null))
/** @template {{ at: number }} T */
const within = (/** @type {T[]} */ list, /** @type {SyncPhase} */ p) => list.filter((/** @type {{ at: number; }} */ e) => e.at >= p.from && e.at <= p.to)
/** ms from `at` to the moment the first node of the play after it sounds: the wait to the play call, the deferred start, and how far ahead it is scheduled. */
// The play that answers an event is the one of that id nearest to it in the room's time (the same frame, most of the time: the room may log the
// event before or after it plays the sound); the delay counts from the earlier of the two in wall time.
const soundDelay = (/** @type {{ at: number; t?: number; time?: number }} */ event, /** @type {string} */ id) => {
  const t = /** @type {number} */ (event.t ?? event.time)
  /** @type {SyncPlay | null} */
  let play = null
  for (const x of data.plays) if (x.id === id && Math.abs(x.t - t) <= 0.25 && (!play || Math.abs(x.t - t) < Math.abs(play.t - t))) play = x
  if (!play) return null
  const start = data.starts.find((/** @type {{ at: number; }} */ s, /** @type {number} */ i) => i >= /** @type {SyncPlay} */ (play).startsBefore && s.at >= /** @type {SyncPlay} */ (play).at - 1)
  return start ? Math.round((start.at - Math.min(event.at, play.at) + start.lead) * 10) / 10 : null
}
const takesOf = (/** @type {SyncPlay[]} */ plays, /** @type {string | null | undefined} */ id) => plays.filter((p) => p.id === id).map((p) => p.take)
const repeats = (/** @type {(string | null)[]} */ takes) => takes.filter((t, i) => i > 0 && t === takes[i - 1]).length
/** @type {SyncRow[]} */
const rows = []
/**
 * @type {string[]}
 */
const failures = []
const check = (/** @type {SyncRow} */ row, /** @type {boolean} */ ok, /** @type {string} */ label) => {
  row.checks.push({ ok, label })
  if (!ok) failures.push(`${row.phase}: ${label}`)
}
for (const p of phases) {
  data = datasets[p.load]
  const plays = within(data.plays, p)
  const lines = within(data.lines, p)
  // a foot put down after the keys went up is the body settling: neither it nor its sound is the walk
  const feet = within(data.feet, p).filter((/** @type {{ at: number; }} */ f) => p.keysUp === null || f.at <= p.keysUp)
  /** @type {SyncRow} */
  const row = { phase: p.id, at: p.at, ids: [...new Set(plays.map((x) => x.id))], checks: [], numbers: {} }
  if (p.expect.footstep) {
    // a footstep after the keys went up is the body settling, whatever the gait was
    const steps = plays.filter((/** @type {{ id: string; at: number; }} */ x) => x.id.startsWith('footstep_') && (p.keysUp === null || x.at <= p.keysUp))
    const delays = feet.map((f) => soundDelay(f, /** @type {string} */ (p.expect.footstep))).filter((d) => d !== null)
    row.numbers = { footfalls: feet.length, footsteps: steps.length, delaysMs: delays, takes: takesOf(plays, p.expect.footstep) }
    check(row, feet.length >= 2, `footfalls from the body: ${feet.length}`)
    check(row, steps.length >= feet.length - 1 && steps.length > 0, `a footstep for each footfall: ${steps.length}/${feet.length}`)
    check(row, steps.every((x) => x.id === p.expect.footstep), `C2 footstep ${p.expect.footstep}: ${[...new Set(steps.map((x) => x.id))].join(',')}`)
    check(row, delays.length > 0 && Math.max(...delays) <= SYNC_MS, `C1 footstep ≤ ${SYNC_MS} ms after the heel: ${JSON.stringify(delays)}`)
    check(row, repeats(/** @type {(string | null)[]} */ (row.numbers.takes)) === 0, `C5 no take twice in a row`)
  }
  if (p.expect.jump) {
    check(row, plays.some((x) => x.id === p.expect.jump), `C2 jump sound`)
    const lands = lines.filter((/** @type {{ type: string; }} */ l) => l.type === 'landing_player')
    check(row, lands.length > 0 && plays.some((/** @type {{ id: string; }} */ x) => x.id.startsWith('land_concrete_')), `C2 landing on concrete (${lands.length} landings)`)
    row.numbers = { landings: lands.map((l) => l.data?.speedMs), landDelaysMs: lands.map((l) => soundDelay(l, plays.find((/** @type {{ id: string; }} */ x) => x.id.startsWith('land_'))?.id ?? '')) }
    check(row, /** @type {(number | null)[]} */ (row.numbers.landDelaysMs).every((/** @type {number | null} */ d) => d !== null && d <= SYNC_MS), `C1 landing ≤ ${SYNC_MS} ms: ${JSON.stringify(row.numbers.landDelaysMs)}`)
  }
  if ('hit' in p.expect) {
    // a contact is a `melee` line with the object it hit (a miss logs one too, without)
    const melees = lines.filter((l) => l.type === 'melee' && l.data?.damage !== undefined && l.data?.distanceM !== undefined)
    const strikes = lines.filter((/** @type {{ type: string; }} */ l) => l.type === 'strike')
    const swings = plays.filter((x) => x.id === p.expect.swing)
    const hits = plays.filter((x) => p.expect.hit && x.id === p.expect.hit)
    const hitDelays = p.expect.hit ? melees.map((l) => soundDelay(l, /** @type {string} */ (p.expect.hit))) : []
    // the swing starts in the room's time a little before the contact (its loudest point is SWING_LEAD later): ms of room time from the swing to the contact
    // for each contact, the last swing that started before it
    const peaks = melees.map((/** @type {{ t: number; }} */ l) => {
      const swing = swings.filter((/** @type {{ t: number; }} */ s) => s.t <= l.t + 0.001).at(-1) ?? null
      return swing ? Math.round((l.t - swing.t) * 1000) : null
    })
    row.numbers = { strikes: strikes.length, contacts: melees.length, swings: swings.length, hits: hits.length, hitDelaysMs: hitDelays, swingStartBeforeContactMs: peaks, takes: takesOf(plays, p.expect.hit ?? p.expect.swing) }
    if (p.expect.swing) check(row, swings.length >= Math.max(1, strikes.length, p.expect.hit === null ? 1 : 0), `C2 a swing (${p.expect.swing}) per blow: ${swings.length}`)
    if (p.expect.hit) {
      check(row, hits.length === melees.length && hits.length > 0, `C2 the hit (${p.expect.hit}) on each contact: ${hits.length}/${melees.length}`)
      check(row, hitDelays.every((/** @type {number | null} */ d) => d !== null && d <= SYNC_MS), `C1 hit ≤ ${SYNC_MS} ms after the contact: ${JSON.stringify(hitDelays)}`)
      if (p.expect.swing) check(row, peaks.length > 0 && peaks.every((/** @type {number | null} */ d) => d !== null && d >= 0 && d <= 200), `C1 the swing starts 0-200 ms (room time) before the contact: ${JSON.stringify(peaks)}`)
    } else check(row, !plays.some((/** @type {{ id: string; }} */ x) => /^(punch|kick|knife|blunt|axe)_(hit|stab|slash|chop)|^shove_two/.test(x.id)), 'C2 no hit sound into the air')
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
