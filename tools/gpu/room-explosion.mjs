// @ts-check
// The `room-explosion` scenario of tools/gpu/perf-gate.mjs (spec 008, B6): does the house explosion fit the physics budget, on this machine and on a slower one?
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/gpu/perf-gate.mjs room-explosion
// Opens the built room (examples/test-room/dist/test-room.html) in a fresh page per round, builds the same house as specs/008-motor-fisico-jolt/decision/probes/room.js, fires
// a blast (C4 at the wall), a hammer (12 blunt hits, one per frame) or a crater (the same C4 on loose ground beside the house), and times, frame by frame, only the physics of the update: the Jolt loop step (`window.__roomPhysics`),
// the kit's piece system (`pieceSys.update`: the own solver, or the glue that reads Jolt's poses and applies the kit's rules) and the renderer's wake queue (`advanceWakes`,
// the D4 policy). Rendering is not in it: the page's own frame loop is stopped, so nothing draws. Frame 0 (the one that applies the explosion, the wake frame) is reported
// apart and left out of the gate, as spec 008 section 11 words B6 ("fora do quadro de despertar"); `maxWithWake` keeps it in view.
//
// THROTTLING IS A PROXY, NOT AMD HARDWARE. `Emulation.setCPUThrottlingRate` makes the page's main thread N times slower by stealing its time. It scales the whole thread
// evenly: it does not reproduce a Ryzen's IPC, cache sizes, memory latency or wasm tier-up, so "6x" is "a CPU six times slower than this Core Ultra 9 275HX", not "an AMD
// laptop". Treat a pass at 4x as strong evidence and a fail as a real warning, but only a run on an AMD machine closes the question (memory gpu-vendor-agnostic-perf).
//
// The kinds. `blast`: C4 on the lot's flat slab at the wall (the terrain does not dig: a slab is not loose ground). `hammer`: 12 blunt hits on the wall. `crater`: the same C4,
// fired on the loose ground (soil, turf: `reposeDegrees` set, the very test the room's `cratersAt` uses) nearest to that wall spot, 0.1 m over the ground, so the terrain digs
// its bowl (`terrain.strike('explosive')`), `terrain.onDeform` wakes the region, and the engine lays the changed ground again (`pieceSys.layGroundAt` -> `groundChanged`, the
// crater's solid tiles: `layGround` and `layTile` in the stage table). The terrain bowl has the volume the charge's energy digs out of that material; the slab and house pieces
// near it take the blast as in `blast`. Frame 0 applies the blast and the dig; the re-laying of the tiles falls in the frames after it.
//
// `water`: the same C4 on the bank of a pond (the lot's own water within 6 m of the spot, else a `pond` ground zone 1.2 m wide laid 1 m east of the spot, between it and the wall,
// through `terrain.setLayout`), so wreckage and the blast's wave meet water. The room's per-piece float step (`floatPiece`, buoyancy and wave push) is a closure of the room update
// that the probe cannot wrap: it is inside the whole-update column, not inside the physics one. Its terrain lookups are timed as the stages `waterAt` and `ripple`.
// Weather: the room's `weather_area` module (attached at load) is set through its bench (`transition` instant, `state` storm or fog) and run 180 frames before the blast.
// Rain and fog cost outside physics, and the page's loop is stopped, so with weather each frame also draws once (the room's render phase minus its pacer) and a second table gives update + render.
//
// Environment (all optional):
//   ROOM_EXPLOSION_THROTTLES=1,2,4,6       the CPU slow-down levels measured
//   ROOM_EXPLOSION_GATE_THROTTLES=1        the levels that block (exit 1); the others are reported with their verdict
//   ROOM_EXPLOSION_VARIANTS=jolt-d4        jolt-d4 (Jolt, owner's D4 blast policy: the gated one), jolt-d4-cold (the same with the JIT warm-up off: `wakeMed` and `1st 1s` show what it saves), jolt-d4-worker (the same with the engine's ground tiles made in a worker, `?groundWorker=1`), jolt (Jolt, no D4), own (the kit's own solver); only jolt-d4 is gated
//   ROOM_EXPLOSION_KINDS=blast,hammer      blast, hammer and crater are the kinds; `crater` is opt-in (a third kind is a third more nightly minutes, and main has no base cell for it yet), see below
//   ROOM_EXPLOSION_ROUNDS=5      ROOM_EXPLOSION_FRAMES=660 (frames of 1/60 s after the explosion, 11 s)
//   ROOM_EXPLOSION_WEATHER=none            none, storm (60 mm/h rain, wind) and/or fog (60 m): comma list; each kind then runs once per weather as `blast+storm`. Weather or ROOM_EXPLOSION_RENDER=1 also times one render per frame
//   ROOM_EXPLOSION_P99_MS=4  ROOM_EXPLOSION_MAX_MS=5   the B6 goal (a warning, not a block)
//   ROOM_EXPLOSION_BASE=<file.json>        main's last passing report (ROOM_EXPLOSION_OUT of that run): the gated cells block only when worse than it (REGRESSION)
//   ROOM_EXPLOSION_OUT=<file.json>         the full report
//   ROOM_EXPLOSION_STAGE_VARIANT=          the variant of the stage pass (default jolt-d4 when measured, else the first engine variant): jolt-d4-worker times the ground worker's stages
//   ROOM_EXPLOSION_PACE=                   frames paced at 1/60 s of wall time (the worker's answers are delivered between frames, as under requestAnimationFrame): on by default for
//                                          the variants with `groundWorker=1` (back to back, a worker could never answer and every tile would be made on the main thread), `1` for all, `0` for none
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, loadavg } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const FRAME_SECONDS = 1 / 60
const QUIET_LOAD = 4
/** The stages of the worst-frames table (ROOM_EXPLOSION_STAGE_*): each is the time spent in the method itself, without the stages it calls (`other` is the rest of the update). */
export const STAGE_LABELS = ['splitLoose', 'adoptSplit', 'fitBoxes', 'rebuildHost', 'groundBody', 'pieceBodies', 'layGround', 'layTile', 'groundAsk', 'groundApply', 'groundFallback', 'groundShape', 'groundRelease', 'waterAt', 'ripple', 'joltStep', 'bridgeReads', 'readBack']
export const VARIANTS = /** @type {const} */ ({ 'jolt-d4': '&solver=jolt&blastDebris=1', 'jolt-d4-cold': '&solver=jolt&blastDebris=1&warmup=0', 'jolt-d4-worker': '&solver=jolt&blastDebris=1&groundWorker=1', jolt: '&solver=jolt', own: '' })
export const PROXY_NOTE = 'CPU throttling (CDP Emulation.setCPUThrottlingRate) is a proxy for a weaker or AMD machine, not real AMD hardware: it slows the main thread evenly and reproduces no AMD IPC, cache or memory behaviour.'

/** The kinds of explosion one round fires. */
export const ROOM_EXPLOSION_KINDS = /** @type {const} */ (['blast', 'hammer', 'crater', 'water'])
/** The weather the room can be in while a kind fires (ROOM_EXPLOSION_WEATHER): the `weather_area` module's `storm` (60 mm/h rain, wind) and `fog` (60 m) states. */
export const WEATHERS = /** @type {const} */ (['none', 'storm', 'fog'])

/**
 * @typedef {{ frames: number, p50: number, p99: number, max: number, over4: number, over5: number, wakeFrame: number, firstSecond: number, maxWithWake: number, loopMs: number, pieceMs: number, wakeMs: number, updateMs: number, renderMs: number, framep50: number, framep99: number, framemax: number, load: number }} Round
 * @typedef {{ variant: string, throttle: number, kind: string, rounds: Round[], p50: number, p99: number, max: number, over4: number, over5: number, wakeFrame: number, wakeMedian: number, firstSecond: number, framep50: number, framep99: number, framemax: number }} Cell
 * @typedef {{ variant: string, throttle: number, kind: string, round: number, frame: number, updateMs: number, physicsMs: number, stages: Record<string, number> }} StageFrame
 */

/**
 * Runs inside the page. Stage `prepare` builds the house and settles it (at full speed: the build is not the measurement); stage `run` fires the explosion and times the physics of each frame.
 * @param {{ stage: 'prepare', weather: string } | { stage: 'run', kind: string, frames: number, frameSeconds: number, stageLabels?: string[], isRendered?: boolean, paceMs?: number }} job
 * @returns {Promise<number[][] | undefined>} per frame: [physics ms, loop step, piece update, wake queue, whole update, render, ...one column per `stageLabels`]
 */
async function inPage(job) {
  /** @typedef {{ objectId: string }} Piece */
  /** @typedef {{ openArea(id: string): void, bench(id: string): { set(key: string, value: unknown): void, act(name: string): void }, camera: { position: object }, world: { serialize(): { objects: { id: string, state: { position: number[] } }[] }, hit(id: string, hit: Record<string, unknown>): void }, renderer: { pieces(): Piece[], pieceSys: { update(dt: number): void }, advanceWakes?: (dt: number) => void }, blastAt(weapon: string, point: number[]): void, terrain: { bounds: number[], columnAt(x: number, z: number): { material: string }, material(id: string): { reposeDegrees?: number }, heightAt(x: number, z: number): number, waterAt(x: number, z: number): object | null, layout(): { zones?: object[] }, setLayout(layout: object): void }, webgl: { render(scene: object, camera: object): void, getContext(): { finish?: () => void } }, scene: object, applyCamera?: () => () => void, update(dt: number): void }} Room */
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
    if (job.weather !== 'none') {
      // the weather module is attached at load: its bench takes the state at once, and its frame callback runs inside room.update
      const weather = room.bench('weather_area')
      weather.set('transition', 'instant')
      weather.set('state', job.weather === 'storm' ? 'storm' : 'fog')
      for (let frame = 0; frame < 180; frame++) room.update(1 / 60)
    }
    return undefined
  }
  const spot = host.__roomExplosion?.spot
  if (!spot) throw new Error('room-explosion: run before prepare')
  /** The nearest point to the blast spot where the ground is loose over a metre around it, at the height of the ground: where a crater can open. */
  const craterSpot = () => {
    const [minX = 0, minZ = 0, maxX = 0, maxZ = 0] = room.terrain.bounds
    const isLoose = (/** @type {number} */ x, /** @type {number} */ z) => x > minX && x < maxX && z > minZ && z < maxZ && room.terrain.material(room.terrain.columnAt(x, z).material).reposeDegrees !== undefined
    const roomy = (/** @type {number} */ x, /** @type {number} */ z) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx = 0, dz = 0]) => isLoose(x + dx, z + dz))
    /** @type {{ point: number[], distance: number } | undefined} */
    let best
    for (let dx = -16; dx <= 16; dx += 0.5) for (let dz = -16; dz <= 16; dz += 0.5) {
      const x = (spot[0] ?? 0) + dx, z = (spot[2] ?? 0) + dz
      const distance = Math.hypot(dx, dz)
      if ((!best || distance < best.distance) && roomy(x, z)) best = { point: [x, room.terrain.heightAt(x, z) + 0.1, z], distance }
    }
    if (!best) throw new Error('room-explosion: no loose ground within 16 m of the blast spot, so no crater can open')
    return best.point
  }
  const [kindName = 'blast'] = job.kind.split('+')
  /** The charge on the dry bank of water: where the lot already has water within 6 m of the blast spot, else a pond (the `pond` ground, 1.4 m deep) laid 1 m east of the spot, between the charge and the wall. */
  const waterSpot = () => {
    const [x = 0, , z = 0] = spot
    let hasWater = false
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) hasWater ||= room.terrain.waterAt(x + dx, z + dz) !== null
    if (!hasWater) {
      const layout = room.terrain.layout()
      room.terrain.setLayout({ ...layout, zones: [...(layout.zones ?? []), { rect: [x + 1, z - 3.5, x + 2.2, z + 3.5], surface: 'pond' }] })
      for (let frame = 0; frame < 60; frame++) room.update(job.frameSeconds)
    }
    return [x, room.terrain.heightAt(x, z) + 0.1, z]
  }
  const chargeAt = kindName === 'crater' ? craterSpot() : kindName === 'water' ? waterSpot() : spot
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
    // one body at a time: in the room only the ground tiles under the pieces call it (height field or slab, step boxes, the solid net under the field); never a piece
    stage('groundBody', world, 'createBody')
    // a batch: the new pieces of a frame (`EnginePieces.makeBodies`), and the house's fixed colliders when they are laid again
    stage('pieceBodies', world, 'createBodies')
    stage('layGround', glue, 'layGround')
    stage('layTile', glue, 'layTile')
    // the ground worker (`?groundWorker=1`): the samples and band read at the ask, the due tiles applied (their bodies are groundBody and groundShape), the tile made here when
    // the worker had not answered by its update, and the held pieces let go
    const schedule = /** @type {{ schedule?: object | null } | undefined} */ (glue)?.schedule ?? undefined
    stage('groundAsk', glue, 'askTile')
    stage('groundApply', glue, 'applyDueGround')
    stage('groundFallback', schedule, 'computeHere')
    stage('groundShape', world, 'setShape')
    stage('groundRelease', glue, 'hold')
    stage('waterAt', room.terrain, 'waterAt')
    stage('ripple', room.terrain, 'ripple')
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
    let render = 0
    if (job.isRendered) {
      // the page's own loop is stopped, so nothing draws: draw once per frame as the room's render phase does (camera shake applied), and wait for the GPU to finish it
      const renderStarted = performance.now()
      const restoreCamera = room.applyCamera?.()
      room.webgl.render(room.scene, room.camera)
      restoreCamera?.()
      room.webgl.getContext().finish?.()
      render = performance.now() - renderStarted
    }
    return [acc.loop + acc.piece + acc.wake, acc.loop, acc.piece, acc.wake, whole, render, ...labels.map((label) => stageMs[label] ?? 0)]
  }
  const frames = []
  const paceMs = job.paceMs ?? 0
  // one frame, then (paced) the rest of its 1/60 s idle, so the worker's answers reach the page between frames as they would under requestAnimationFrame
  const step = async () => {
    const started = performance.now()
    frames.push(frame())
    if (paceMs > 0) await wait(Math.max(0, paceMs - (performance.now() - started)))
  }
  if (kindName !== 'hammer') {
    room.blastAt('c4', chargeAt)
    await step()
  } else {
    for (let hit = 0; hit < 12; hit++) {
      const point = [spot[0] ?? 0, 0.5 + 0.5 * (hit % 4), (spot[2] ?? 0) + ((hit % 3) - 1) * 0.6]
      room.world.hit('house3d:1', { type: 'blunt', point, direction: [1, 0, 0], energy: 8000, radius: 0.5, source: 'player' })
      await step()
    }
  }
  while (frames.length < job.frames) await step()
  // what the ground worker did (`GroundSchedule.stats`): tiles answered in time, made here at their update, answers that came too late
  const groundSchedule = /** @type {{ schedule?: { stats: object } | null } | undefined} */ (/** @type {{ engine?: object }} */ (room.renderer.pieceSys).engine)?.schedule
  const statsHost = /** @type {{ __groundWorkerStats?: object }} */ (/** @type {unknown} */ (window))
  statsHost.__groundWorkerStats = groundSchedule ? { ...groundSchedule.stats } : undefined
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
  // the whole frame: the room's update plus the render timed after it (zero when the render is not timed)
  const whole = frames.slice(1).map((frame) => (frame[4] ?? 0) + (frame[5] ?? 0)).sort((a, b) => a - b)
  return {
    frames: rest.length,
    p50: round2(percentile(rest, 0.5)),
    p99: round2(percentile(rest, 0.99)),
    max: round2(rest[rest.length - 1] ?? 0),
    over4: rest.filter((ms) => ms > 4).length,
    over5: rest.filter((ms) => ms > 5).length,
    wakeFrame: round2(wakeFrame),
    firstSecond: round2(frames.slice(0, 60).reduce((total, frame) => total + (frame[0] ?? 0), 0)),
    maxWithWake: round2(Math.max(wakeFrame, rest[rest.length - 1] ?? 0)),
    loopMs: sum(1),
    pieceMs: sum(2),
    wakeMs: sum(3),
    updateMs: sum(4),
    renderMs: sum(5),
    framep50: round2(percentile(whole, 0.5)),
    framep99: round2(percentile(whole, 0.99)),
    framemax: round2(whole[whole.length - 1] ?? 0),
    load: round2(load),
  }
}

/**
 * The gate: spec 008 B6 reads "median of the rounds <= 4 ms and no round over 5 ms", so the p99 of a cell is the median of its rounds' p99 and the max the worst round's.
 * @param {Cell} cell @param {{ p99: number, max: number }} budget
 */
export const cellFails = (cell, budget) => cell.p99 > budget.p99 || cell.max > budget.max

/** How much worse than main a cell may read before it blocks, and the floors under which a difference is the noise of two runs (ms; the frame varies 54 to 143 ms between rounds on a busy machine). */
export const REGRESSION = { tolerance: 0.25, p99Floor: 1, maxFloor: 5 }

/**
 * Whether a cell is worse than the same cell of main's last passing report by more than the tolerance and the floor. The absolute budget (4/5 ms) is the goal and only a
 * warning: it blocked every night while main was still over it, which made the daily warning mean nothing; the block is the regression.
 * @param {Pick<Cell, 'p99' | 'max'>} cell @param {Pick<Cell, 'p99' | 'max'> | undefined} base
 */
export const cellRegressed = (cell, base) => {
  if (!base) return false
  const worse = (/** @type {number} */ now, /** @type {number} */ was, /** @type {number} */ floor) => now > was * (1 + REGRESSION.tolerance) && now - was > floor
  return worse(cell.p99, base.p99, REGRESSION.p99Floor) || worse(cell.max, base.max, REGRESSION.maxFloor)
}

/** The 10 slowest frames (whole update) of each variant, throttle and kind, pooled over the rounds. @param {StageFrame[]} all @returns {StageFrame[]} */
const worstFrames = (all) => {
  /** @type {Map<string, StageFrame[]>} */
  const groups = new Map()
  for (const entry of all) groups.set(`${entry.variant}|${entry.throttle}|${entry.kind}`, [...(groups.get(`${entry.variant}|${entry.throttle}|${entry.kind}`) ?? []), entry])
  return [...groups.values()].flatMap((group) => group.sort((a, b) => b.updateMs - a.updateMs).slice(0, 10))
}

/**
 * The part of Playwright this tool uses (it is loaded by `require` from pnpm's store, so its own types are not in reach).
 * @typedef {{ send: (method: string, params?: object) => Promise<unknown> }} CdpSession
 * @typedef {{
 *   on: (event: 'pageerror', listener: (error: Error) => void) => void,
 *   goto: (url: string, options?: object) => Promise<unknown>,
 *   waitForFunction: (fn: () => unknown, arg: null, options?: object) => Promise<unknown>,
 *   evaluate: <R, A>(fn: (arg: A) => R | Promise<R>, arg: A) => Promise<R>,
 *   context: () => { newCDPSession: (page: Page) => Promise<CdpSession> },
 *   close: () => Promise<void>,
 * }} Page
 * @typedef {{ newPage: (options?: object) => Promise<Page>, version: () => string, close: () => Promise<void> }} Browser
 * @typedef {{ chromium: { launch: (options?: object) => Promise<Browser> } }} Playwright
 */

/** The cells of a saved report (`ROOM_EXPLOSION_OUT`) by variant, throttle and kind; undefined without one or when it cannot be read. @param {string | undefined} file @returns {Map<string, Pick<Cell, 'p99' | 'max'>> | undefined} */
const baseCellsOf = (file) => {
  if (!file) return undefined
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    return new Map(saved.cells.map((/** @type {Cell} */ cell) => [`${cell.variant}|${cell.throttle}|${cell.kind}`, cell]))
  } catch {
    return undefined
  }
}

/** @param {string | undefined} text @param {number[]} fallback */
const numbers = (text, fallback) => (text ? text.split(',').map(Number).filter((value) => Number.isFinite(value) && value >= 1) : fallback)

/**
 * @param {{ playwright: Playwright, chrome?: string, root: string }} context
 * @returns {Promise<number>} the exit code
 */
export async function runRoomExplosion({ playwright, chrome, root }) {
  const throttles = numbers(process.env.ROOM_EXPLOSION_THROTTLES, [1, 2, 4, 6])
  const gated = new Set(numbers(process.env.ROOM_EXPLOSION_GATE_THROTTLES, [1]))
  const variants = (process.env.ROOM_EXPLOSION_VARIANTS ?? 'jolt-d4').split(',').filter((name) => name in VARIANTS)
  const baseKinds = (process.env.ROOM_EXPLOSION_KINDS ?? 'blast,hammer').split(',').filter((kind) => /** @type {readonly string[]} */ (ROOM_EXPLOSION_KINDS).includes(kind))
  const weathers = (process.env.ROOM_EXPLOSION_WEATHER ?? 'none').split(',').filter((name) => /** @type {readonly string[]} */ (WEATHERS).includes(name))
  // a kind under weather reads `blast+storm`; without weather it keeps its plain name (and its key in an older report)
  const kinds = baseKinds.flatMap((kind) => weathers.map((weather) => (weather === 'none' ? kind : `${kind}+${weather}`)))
  const isRendered = process.env.ROOM_EXPLOSION_RENDER === '1' || kinds.some((kind) => kind.includes('+'))
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
  if (isRendered) console.log('room-explosion: render timed per frame (weather or ROOM_EXPLOSION_RENDER=1); the physics columns and the gate stay physics only')
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
      await page.evaluate(inPage, { stage: /** @type {const} */ ('prepare'), weather: kind.split('+')[1] ?? 'none' })
      const load = loadavg()[0] ?? 0
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
      const paced = process.env.ROOM_EXPLOSION_PACE === '1' || (process.env.ROOM_EXPLOSION_PACE !== '0' && VARIANTS[/** @type {keyof typeof VARIANTS} */ (variant)].includes('groundWorker=1'))
      const timings = await page.evaluate(inPage, { stage: /** @type {const} */ ('run'), kind, frames, frameSeconds: FRAME_SECONDS, isRendered, ...(stageLabels ? { stageLabels } : {}), ...(paced ? { paceMs: 1000 / 60 } : {}) })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      const groundStats = await page.evaluate(() => /** @type {{ __groundWorkerStats?: object }} */ (/** @type {unknown} */ (window)).__groundWorkerStats)
      if (groundStats) console.log(`room-explosion: ${variant} ${throttle}x ${kind}${stageLabels ? ' (stages)' : ''}${paced ? ' paced' : ''}: ground tiles ${JSON.stringify(groundStats)}`)
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
  const stageVariant = process.env.ROOM_EXPLOSION_STAGE_VARIANT ?? (variants.includes('jolt-d4') ? 'jolt-d4' : variants.find((name) => name !== 'own'))
  if (stageVariant && stageRounds > 0) {
    for (let round = 1; round <= stageRounds; round++) for (const throttle of stageThrottles) for (const kind of kinds) {
      try {
        const { timings } = await measureOne(stageVariant, throttle, kind, [...STAGE_LABELS])
        timings.forEach((frame, index) => stageFrames.push({ variant: stageVariant, throttle, kind, round, frame: index, updateMs: round2(frame[4] ?? 0), physicsMs: round2(frame[0] ?? 0), stages: Object.fromEntries(STAGE_LABELS.map((label, column) => [label, round2(frame[6 + column] ?? 0)])) }))
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
      wakeMedian: round2(median(list.map((entry) => entry.wakeFrame))),
      firstSecond: round2(median(list.map((entry) => entry.firstSecond))),
      framep50: round2(median(list.map((entry) => entry.framep50))),
      framep99: round2(median(list.map((entry) => entry.framep99))),
      framemax: round2(Math.max(0, ...list.map((entry) => entry.framemax))),
    })
  }

  console.log('')
  console.log('room-explosion: physics ms per frame (p50 and p99: median of rounds; max and wake: worst round; over4/over5: frames summed over the rounds)')
  console.log(`  ${'variant'.padEnd(12)} ${'cpu'.padEnd(4)} ${'kind'.padEnd(13)} ${'p50'.padStart(6)} ${'p99'.padStart(6)} ${'max'.padStart(6)} ${'wake'.padStart(6)} ${'wakeMed'.padStart(7)} ${'1st 1s'.padStart(7)} ${'>4ms'.padStart(5)} ${'>5ms'.padStart(5)}  verdict`)
  let blocked = false
  const baseCells = baseCellsOf(process.env.ROOM_EXPLOSION_BASE)
  console.log(baseCells ? `room-explosion: blocks only on a regression over ${Math.round(REGRESSION.tolerance * 100)}% against ${process.env.ROOM_EXPLOSION_BASE}; the absolute budget is a warning` : 'room-explosion: no base report (ROOM_EXPLOSION_BASE): nothing blocks, the absolute budget is a warning')
  for (const cell of cells) {
    const fails = cellFails(cell, budget)
    const regressed = cellRegressed(cell, baseCells?.get(key(cell.variant, cell.throttle, cell.kind)))
    const blocks = regressed && cell.variant === 'jolt-d4' && gated.has(cell.throttle)
    blocked ||= blocks
    const verdict = cell.variant !== 'jolt-d4' && cell.variant !== 'jolt' ? 'reference' : blocks ? 'FAIL: regression (blocks)' : regressed ? 'regression (reported)' : fails ? 'over budget (warning)' : 'within budget'
    console.log(`  ${cell.variant.padEnd(12)} ${`${cell.throttle}x`.padEnd(4)} ${cell.kind.padEnd(13)} ${String(cell.p50).padStart(6)} ${String(cell.p99).padStart(6)} ${String(cell.max).padStart(6)} ${String(cell.wakeFrame).padStart(6)} ${String(cell.wakeMedian).padStart(7)} ${String(cell.firstSecond).padStart(7)} ${String(cell.over4).padStart(5)} ${String(cell.over5).padStart(5)}  ${verdict}`)
  }
  if (isRendered) {
    console.log('')
    console.log('room-explosion: whole frame = room.update + one render of the scene (webgl.render, then GL finish: the CPU wait for the GPU is in it), ms; p50/p99: median of rounds, max: worst round; wake frame left out')
    console.log(`  ${'variant'.padEnd(12)} ${'cpu'.padEnd(4)} ${'kind'.padEnd(13)} ${'p50'.padStart(6)} ${'p99'.padStart(6)} ${'max'.padStart(6)}`)
    for (const cell of cells) console.log(`  ${cell.variant.padEnd(12)} ${`${cell.throttle}x`.padEnd(4)} ${cell.kind.padEnd(13)} ${String(cell.framep50).padStart(6)} ${String(cell.framep99).padStart(6)} ${String(cell.framemax).padStart(6)}`)
  }
  if (worst.length > 0) {
    console.log('')
    console.log(`room-explosion: the 10 worst frames (whole update) by stage, ms, exclusive of callees; ${stageRounds} rounds pooled; frame 0 is the wake frame; other = update minus the stages`)
    console.log(`  ${'cpu'.padEnd(4)} ${'kind'.padEnd(13)} ${'rnd.fr'.padEnd(7)} ${'update'.padStart(7)} ${'physics'.padStart(7)} ${STAGE_LABELS.map((label) => label.padStart(11)).join(' ')} ${'other'.padStart(7)}`)
    for (const entry of worst) {
      const other = entry.updateMs - STAGE_LABELS.reduce((total, label) => total + (entry.stages[label] ?? 0), 0)
      console.log(`  ${`${entry.throttle}x`.padEnd(4)} ${entry.kind.padEnd(13)} ${`${entry.round}.${entry.frame}`.padEnd(7)} ${String(entry.updateMs).padStart(7)} ${String(entry.physicsMs).padStart(7)} ${STAGE_LABELS.map((label) => String(entry.stages[label] ?? 0).padStart(11)).join(' ')} ${other.toFixed(2).padStart(7)}`)
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
  console.log(failed ? 'room-explosion: regression against main (or a page error): exit 1' : 'room-explosion: no regression against main at the blocking levels')
  return failed ? 1 : 0
}
