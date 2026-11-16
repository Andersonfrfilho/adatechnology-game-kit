// @ts-check
// The `room-explosion` scenario of tools/gpu/perf-gate.mjs (spec 008, B6): does the house explosion fit the physics budget, on this machine and on a slower one?
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/gpu/perf-gate.mjs room-explosion
// Opens the built room (examples/test-room/dist/test-room.html) in a fresh page per round, builds the same house as specs/008-motor-fisico-jolt/decision/probes/room.js, fires
// a blast (C4 at the wall) or a hammer (12 blunt hits, one per frame), and times, frame by frame, only the physics of the update: the Jolt loop step (`window.__roomPhysics`),
// the kit's piece system (`pieceSys.update`: the own solver, or the glue that reads Jolt's poses and applies the kit's rules) and the renderer's wake queue (`advanceWakes`,
// the D4 policy). Rendering is not in it: the page's own frame loop is stopped, so nothing draws. Frame 0 (the one that applies the explosion, the wake frame) is reported
// apart and left out of the gate, as spec 008 section 11 words B6 ("fora do quadro de despertar"); `maxWithWake` keeps it in view.
//
// THROTTLING IS A PROXY, NOT AMD HARDWARE. `Emulation.setCPUThrottlingRate` makes the page's main thread N times slower by stealing its time. It scales the whole thread
// evenly: it does not reproduce a Ryzen's IPC, cache sizes, memory latency or wasm tier-up, so "6x" is "a CPU six times slower than this Core Ultra 9 275HX", not "an AMD
// laptop". Treat a pass at 4x as strong evidence and a fail as a real warning, but only a run on an AMD machine closes the question (memory gpu-vendor-agnostic-perf).
//
// Environment (all optional):
//   ROOM_EXPLOSION_THROTTLES=1,2,4,6       the CPU slow-down levels measured
//   ROOM_EXPLOSION_GATE_THROTTLES=1        the levels that block (exit 1); the others are reported with their verdict
//   ROOM_EXPLOSION_VARIANTS=jolt-d4        jolt-d4 (Jolt, owner's D4 blast policy: the gated one), jolt (Jolt, no D4), own (the kit's own solver); only jolt-d4 is gated
//   ROOM_EXPLOSION_KINDS=blast,hammer      ROOM_EXPLOSION_ROUNDS=5      ROOM_EXPLOSION_FRAMES=660 (frames of 1/60 s after the explosion, 11 s)
//   ROOM_EXPLOSION_P99_MS=4  ROOM_EXPLOSION_MAX_MS=5   the B6 thresholds
//   ROOM_EXPLOSION_OUT=<file.json>         the full report
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, loadavg } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const FRAME_SECONDS = 1 / 60
const QUIET_LOAD = 4
/** The stages of the worst-frames table (ROOM_EXPLOSION_STAGE_*): each is the time spent in the method itself, without the stages it calls (`other` is the rest of the update). */
export const STAGE_LABELS = ['splitLoose', 'adoptSplit', 'fitBoxes', 'rebuildHost', 'createBody', 'layGround', 'layTile', 'joltStep', 'bridgeReads', 'readBack']
export const VARIANTS = /** @type {const} */ ({ 'jolt-d4': '&solver=jolt&blastDebris=1', jolt: '&solver=jolt', own: '' })
export const PROXY_NOTE = 'CPU throttling (CDP Emulation.setCPUThrottlingRate) is a proxy for a weaker or AMD machine, not real AMD hardware: it slows the main thread evenly and reproduces no AMD IPC, cache or memory behaviour.'

/**
 * @typedef {{ frames: number, p50: number, p99: number, max: number, over4: number, over5: number, wakeFrame: number, maxWithWake: number, loopMs: number, pieceMs: number, wakeMs: number, updateMs: number, load: number }} Round
 * @typedef {{ variant: string, throttle: number, kind: string, rounds: Round[], p50: number, p99: number, max: number, over4: number, over5: number, wakeFrame: number }} Cell
 * @typedef {{ variant: string, throttle: number, kind: string, round: number, frame: number, updateMs: number, physicsMs: number, stages: Record<string, number> }} StageFrame
 */

/**
 * Runs inside the page. Stage `prepare` builds the house and settles it (at full speed: the build is not the measurement); stage `run` fires the explosion and times the physics of each frame.
 * @param {{ stage: 'prepare' } | { stage: 'run', kind: string, frames: number, frameSeconds: number, stageLabels?: string[] }} job
 * @returns {Promise<number[][] | undefined>} per frame: [physics ms, loop step, piece update, wake queue, whole update, ...one column per `stageLabels`]
 */
async function inPage(job) {
  /** @typedef {{ objectId: string }} Piece */
  /** @typedef {{ openArea(id: string): void, bench(id: string): { set(key: string, value: unknown): void, act(name: string): void }, camera: { position: object }, world: { serialize(): { objects: { id: string, state: { position: number[] } }[] }, hit(id: string, hit: Record<string, unknown>): void }, renderer: { pieces(): Piece[], pieceSys: { update(dt: number): void }, advanceWakes?: (dt: number) => void }, blastAt(weapon: string, point: number[]): void, update(dt: number): void }} Room */
  const host = /** @type {{ __testRoom: Room, __roomPhysics?: { step(dt: number): void }, __roomExplosion?: { spot: number[] } }} */ (/** @type {unknown} */ (window))
  const room = host.__testRoom
  const wait = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms))
  if (job.stage === 'prepare') {
    room.openArea('floorplan_area')
    const bench = room.bench('floorplan_area')
    bench.set('package', 'residential')
    bench.set('template', 'single_storey_a')
    bench.set('seed', 1)
    bench.act('build')
    await wait(8000)
    // the page's own loop would call update again between ours: stopped, the probe is the only caller
    window.requestAnimationFrame = () => 0
    await wait(300)
    const house = room.world.serialize().objects.find((object) => object.id === 'house3d:1')
    if (!house) throw new Error('room-explosion: house3d:1 is not in the world after the build')
    const [x = 0, , z = 0] = house.state.position
    host.__roomExplosion = { spot: [x - 2.5, 0.6, z] }
    return undefined
  }
  const spot = host.__roomExplosion?.spot
  if (!spot) throw new Error('room-explosion: run before prepare')
  const acc = { loop: 0, piece: 0, wake: 0 }
  /** @param {'loop' | 'piece' | 'wake'} key @param {object} owner @param {string} name */
  const timed = (key, owner, name) => {
    const target = /** @type {Record<string, (...args: number[]) => void>} */ (owner)
    const original = target[name]
    if (typeof original !== 'function') return
    target[name] = (...args) => {
      const started = performance.now()
      original.apply(owner, args)
      acc[key] += performance.now() - started
    }
  }
  if (host.__roomPhysics) timed('loop', host.__roomPhysics, 'step')
  timed('piece', room.renderer.pieceSys, 'update')
  timed('wake', room.renderer, 'advanceWakes')
  // stage timing (a separate pass: a timer around a call made hundreds of times per frame is not free): exclusive times, a stage's callees subtracted
  const labels = job.stageLabels ?? []
  /** @type {Record<string, number>} */
  const stageMs = {}
  /** @type {{ child: number }[]} */
  const open = []
  /** @param {string} label @param {object | undefined} owner @param {string} name */
  const stage = (label, owner, name) => {
    const target = /** @type {Record<string, (...args: unknown[]) => unknown> | undefined} */ (owner)
    const original = target?.[name]
    if (!target || typeof original !== 'function') return
    target[name] = function (...args) {
      const entry = { child: 0 }
      open.push(entry)
      const started = performance.now()
      try {
        return original.apply(this, args)
      } finally {
        const spent = performance.now() - started
        open.pop()
        stageMs[label] = (stageMs[label] ?? 0) + spent - entry.child
        const parent = open[open.length - 1]
        if (parent) parent.child += spent
      }
    }
  }
  if (labels.length > 0) {
    const renderer = /** @type {Record<string, object | undefined>} */ (/** @type {unknown} */ (room.renderer))
    const glue = /** @type {{ engine?: object }} */ (room.renderer.pieceSys).engine
    const world = /** @type {{ world?: object } | undefined} */ (glue)?.world
    stage('splitLoose', renderer, 'splitLoose')
    stage('adoptSplit', renderer, 'adoptSplit')
    stage('fitBoxes', renderer, 'partBoxesOf')
    stage('rebuildHost', renderer.visuals, 'rebuildHost')
    stage('createBody', world, 'createBody')
    stage('layGround', glue, 'layGround')
    stage('layTile', glue, 'layTile')
    stage('joltStep', world, 'stepFixed')
    stage('bridgeReads', world, 'readPose')
    stage('bridgeReads', world, 'readVelocity')
    stage('readBack', glue, 'readBack')
  }
  /** @returns {number[]} */
  const frame = () => {
    acc.loop = acc.piece = acc.wake = 0
    for (const label of labels) stageMs[label] = 0
    const started = performance.now()
    room.update(job.frameSeconds)
    const whole = performance.now() - started
    return [acc.loop + acc.piece + acc.wake, acc.loop, acc.piece, acc.wake, whole, ...labels.map((label) => stageMs[label] ?? 0)]
  }
  const frames = []
  if (job.kind === 'blast') {
    room.blastAt('c4', spot)
    frames.push(frame())
  } else {
    for (let hit = 0; hit < 12; hit++) {
      const point = [spot[0] ?? 0, 0.5 + 0.5 * (hit % 4), (spot[2] ?? 0) + ((hit % 3) - 1) * 0.6]
      room.world.hit('house3d:1', { type: 'blunt', point, direction: [1, 0, 0], energy: 8000, radius: 0.5, source: 'player' })
      frames.push(frame())
    }
  }
  while (frames.length < job.frames) frames.push(frame())
  return frames
}

/** @param {number[]} sorted ascending @param {number} share */
const percentile = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0
/** @param {number[]} values */
const median = (values) => percentile([...values].sort((a, b) => a - b), 0.5)
/** @param {number} value */
const round2 = (value) => Math.round(value * 100) / 100

/** @param {number[][]} frames @param {number} load @returns {Round} */
function summarise(frames, load) {
  // frame 0 is the wake frame: reported apart, out of the percentiles (B6 of spec 008)
  const rest = frames.slice(1).map((frame) => frame[0] ?? 0).sort((a, b) => a - b)
  const sum = (/** @type {number} */ column) => round2(frames.reduce((total, frame) => total + (frame[column] ?? 0), 0))
  const wakeFrame = frames[0]?.[0] ?? 0
  return {
    frames: rest.length,
    p50: round2(percentile(rest, 0.5)),
    p99: round2(percentile(rest, 0.99)),
    max: round2(rest[rest.length - 1] ?? 0),
    over4: rest.filter((ms) => ms > 4).length,
    over5: rest.filter((ms) => ms > 5).length,
    wakeFrame: round2(wakeFrame),
    maxWithWake: round2(Math.max(wakeFrame, rest[rest.length - 1] ?? 0)),
    loopMs: sum(1),
    pieceMs: sum(2),
    wakeMs: sum(3),
    updateMs: sum(4),
    load: round2(load),
  }
}

/**
 * The gate: spec 008 B6 reads "median of the rounds <= 4 ms and no round over 5 ms", so the p99 of a cell is the median of its rounds' p99 and the max the worst round's.
 * @param {Cell} cell @param {{ p99: number, max: number }} budget
 */
export const cellFails = (cell, budget) => cell.p99 > budget.p99 || cell.max > budget.max

/** The 10 slowest frames (whole update) of each variant, throttle and kind, pooled over the rounds. @param {StageFrame[]} all @returns {StageFrame[]} */
const worstFrames = (all) => {
  /** @type {Map<string, StageFrame[]>} */
  const groups = new Map()
  for (const entry of all) groups.set(`${entry.variant}|${entry.throttle}|${entry.kind}`, [...(groups.get(`${entry.variant}|${entry.throttle}|${entry.kind}`) ?? []), entry])
  return [...groups.values()].flatMap((group) => group.sort((a, b) => b.updateMs - a.updateMs).slice(0, 10))
}

/** @param {string | undefined} text @param {number[]} fallback */
const numbers = (text, fallback) => (text ? text.split(',').map(Number).filter((value) => Number.isFinite(value) && value >= 1) : fallback)

/**
 * @param {{ playwright: typeof import('playwright'), chrome?: string, root: string }} context
 * @returns {Promise<number>} the exit code
 */
export async function runRoomExplosion({ playwright, chrome, root }) {
  const throttles = numbers(process.env.ROOM_EXPLOSION_THROTTLES, [1, 2, 4, 6])
  const gated = new Set(numbers(process.env.ROOM_EXPLOSION_GATE_THROTTLES, [1]))
  const variants = (process.env.ROOM_EXPLOSION_VARIANTS ?? 'jolt-d4').split(',').filter((name) => name in VARIANTS)
  const kinds = (process.env.ROOM_EXPLOSION_KINDS ?? 'blast,hammer').split(',').filter((kind) => kind === 'blast' || kind === 'hammer')
  const rounds = Number(process.env.ROOM_EXPLOSION_ROUNDS ?? 5)
  const frames = Number(process.env.ROOM_EXPLOSION_FRAMES ?? 660)
  const budget = { p99: Number(process.env.ROOM_EXPLOSION_P99_MS ?? 4), max: Number(process.env.ROOM_EXPLOSION_MAX_MS ?? 5) }
  if (variants.length === 0 || kinds.length === 0 || throttles.length === 0) throw new Error('room-explosion: nothing to measure (check the ROOM_EXPLOSION_* variables)')

  execFileSync(process.execPath, [join(root, 'examples/test-room/build.mjs')], { stdio: 'ignore' })
  const pageUrl = pathToFileURL(join(root, 'examples/test-room/dist/test-room.html')).href
  const browser = await playwright.chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'], ...(chrome ? { executablePath: chrome } : {}) })
  const machine = { cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length, node: process.version, chrome: browser.version(), platform: process.platform }
  console.log(`room-explosion: ${machine.cpu} (${machine.cores} threads), node ${machine.node}, chrome ${machine.chrome}`)
  console.log(`room-explosion: ${PROXY_NOTE}`)
  console.log(`room-explosion: budget p99 <= ${budget.p99} ms (median of rounds), max <= ${budget.max} ms (worst round), wake frame apart; ${rounds} rounds x ${frames} frames of 1/60 s`)

  /** @type {Map<string, Round[]>} */
  const collected = new Map()
  const key = (/** @type {string} */ variant, /** @type {number} */ throttle, /** @type {string} */ kind) => `${variant}|${throttle}|${kind}`
  /** @type {string[]} */
  const errors = []
  /** One round in a fresh page: the house built at full speed, then the explosion timed at `throttle`. @param {string} variant @param {number} throttle @param {string} kind @param {string[]} [stageLabels] */
  const measureOne = async (variant, throttle, kind, stageLabels) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    page.on('pageerror', (error) => errors.push(`${variant} ${throttle}x ${kind}: ${error.message}`))
    try {
      await page.goto(`${pageUrl}?area=floorplan${VARIANTS[/** @type {keyof typeof VARIANTS} */ (variant)]}`, { timeout: 180000 })
      await page.waitForFunction(() => /** @type {{ __testRoom?: unknown }} */ (/** @type {unknown} */ (window)).__testRoom, null, { timeout: 600000 })
      await page.evaluate(inPage, { stage: /** @type {const} */ ('prepare') })
      const load = loadavg()[0] ?? 0
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
      const timings = await page.evaluate(inPage, { stage: /** @type {const} */ ('run'), kind, frames, frameSeconds: FRAME_SECONDS, ...(stageLabels ? { stageLabels } : {}) })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      if (!timings) throw new Error('no timings')
      return { timings, load }
    } finally {
      await page.close()
    }
  }
  // rounds outermost: a drift of the machine over the run lands on every cell alike
  for (let round = 1; round <= rounds; round++) {
    for (const variant of variants) for (const throttle of throttles) for (const kind of kinds) {
      try {
        const { timings, load } = await measureOne(variant, throttle, kind)
        const summary = summarise(timings, load)
        collected.set(key(variant, throttle, kind), [...(collected.get(key(variant, throttle, kind)) ?? []), summary])
        console.log(`room-explosion: round ${round} ${variant} ${throttle}x ${kind}: p50 ${summary.p50} p99 ${summary.p99} max ${summary.max} (wake ${summary.wakeFrame}) over5 ${summary.over5} load ${summary.load}`)
        if (summary.load >= QUIET_LOAD) console.log(`room-explosion: load ${summary.load} is over ${QUIET_LOAD}: this round reads slower than a quiet machine`)
      } catch (error) {
        errors.push(`${variant} ${throttle}x ${kind}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // the worst frames by stage: Jolt only, a pass of its own (the timers cost a little, so the percentiles above never come from it)
  /** @type {StageFrame[]} */
  const stageFrames = []
  const stageThrottles = numbers(process.env.ROOM_EXPLOSION_STAGE_THROTTLES, [1, 4])
  const stageRounds = Number(process.env.ROOM_EXPLOSION_STAGE_ROUNDS ?? 3)
  const stageVariant = variants.includes('jolt-d4') ? 'jolt-d4' : variants.find((name) => name !== 'own')
  if (stageVariant && stageRounds > 0) {
    for (let round = 1; round <= stageRounds; round++) for (const throttle of stageThrottles) for (const kind of kinds) {
      try {
        const { timings } = await measureOne(stageVariant, throttle, kind, [...STAGE_LABELS])
        timings.forEach((frame, index) => stageFrames.push({ variant: stageVariant, throttle, kind, round, frame: index, updateMs: round2(frame[4] ?? 0), physicsMs: round2(frame[0] ?? 0), stages: Object.fromEntries(STAGE_LABELS.map((label, column) => [label, round2(frame[5 + column] ?? 0)])) }))
        console.log(`room-explosion: stage round ${round} ${stageVariant} ${throttle}x ${kind} done`)
      } catch (error) {
        errors.push(`stages ${throttle}x ${kind}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  await browser.close()
  const worst = worstFrames(stageFrames)

  /** @type {Cell[]} */
  const cells = []
  for (const variant of variants) for (const throttle of throttles) for (const kind of kinds) {
    const list = collected.get(key(variant, throttle, kind)) ?? []
    cells.push({
      variant, throttle, kind, rounds: list,
      p50: round2(median(list.map((entry) => entry.p50))),
      p99: round2(median(list.map((entry) => entry.p99))),
      max: round2(Math.max(0, ...list.map((entry) => entry.max))),
      over4: list.reduce((total, entry) => total + entry.over4, 0),
      over5: list.reduce((total, entry) => total + entry.over5, 0),
      wakeFrame: round2(Math.max(0, ...list.map((entry) => entry.wakeFrame))),
    })
  }

  console.log('')
  console.log('room-explosion: physics ms per frame (p50 and p99: median of rounds; max and wake: worst round; over4/over5: frames summed over the rounds)')
  console.log(`  ${'variant'.padEnd(8)} ${'cpu'.padEnd(4)} ${'kind'.padEnd(7)} ${'p50'.padStart(6)} ${'p99'.padStart(6)} ${'max'.padStart(6)} ${'wake'.padStart(6)} ${'>4ms'.padStart(5)} ${'>5ms'.padStart(5)}  verdict`)
  let blocked = false
  for (const cell of cells) {
    const fails = cellFails(cell, budget)
    const blocks = fails && cell.variant === 'jolt-d4' && gated.has(cell.throttle)
    blocked ||= blocks
    const verdict = cell.variant !== 'jolt-d4' && cell.variant !== 'jolt' ? 'reference' : fails ? (blocks ? 'FAIL (blocks)' : 'over budget (reported)') : 'within budget'
    console.log(`  ${cell.variant.padEnd(8)} ${`${cell.throttle}x`.padEnd(4)} ${cell.kind.padEnd(7)} ${String(cell.p50).padStart(6)} ${String(cell.p99).padStart(6)} ${String(cell.max).padStart(6)} ${String(cell.wakeFrame).padStart(6)} ${String(cell.over4).padStart(5)} ${String(cell.over5).padStart(5)}  ${verdict}`)
  }
  if (worst.length > 0) {
    console.log('')
    console.log(`room-explosion: the 10 worst frames (whole update) by stage, ms, exclusive of callees; ${stageRounds} rounds pooled; frame 0 is the wake frame; other = update minus the stages`)
    console.log(`  ${'cpu'.padEnd(4)} ${'kind'.padEnd(7)} ${'rnd.fr'.padEnd(7)} ${'update'.padStart(7)} ${'physics'.padStart(7)} ${STAGE_LABELS.map((label) => label.padStart(11)).join(' ')} ${'other'.padStart(7)}`)
    for (const entry of worst) {
      const other = entry.updateMs - STAGE_LABELS.reduce((total, label) => total + (entry.stages[label] ?? 0), 0)
      console.log(`  ${`${entry.throttle}x`.padEnd(4)} ${entry.kind.padEnd(7)} ${`${entry.round}.${entry.frame}`.padEnd(7)} ${String(entry.updateMs).padStart(7)} ${String(entry.physicsMs).padStart(7)} ${STAGE_LABELS.map((label) => String(entry.stages[label] ?? 0).padStart(11)).join(' ')} ${other.toFixed(2).padStart(7)}`)
    }
  }
  for (const error of errors) console.log(`PAGE ERROR  ${error}`)
  console.log(`room-explosion: blocking levels: ${[...gated].map((level) => `${level}x`).join(', ')} on jolt-d4 only; ${PROXY_NOTE}`)

  const out = process.env.ROOM_EXPLOSION_OUT
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), note: PROXY_NOTE, machine, budget, rounds, frames, frameSeconds: FRAME_SECONDS, gatedThrottles: [...gated], errors, cells, stageLabels: STAGE_LABELS, worstFrames: worst }, null, 1))
    console.log(`room-explosion: report written to ${out}`)
  }
  const failed = blocked || errors.length > 0
  console.log(failed ? 'room-explosion: over budget (or a page error): exit 1' : 'room-explosion: within budget at the blocking levels')
  return failed ? 1 : 0
}
