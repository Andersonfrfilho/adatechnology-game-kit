// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): one sheet (or a few, ten to a sheet) per family of the arsenal in side view at one camera distance per sheet, then one weapon per family of the rule 5 (pistol, shotgun, rifle, launcher, blade, throwable) in the hand, first and third person, still with the aim high, level and low and walking.
// Prints and shots/index.json go to examples/weapons-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PHOTO_EMPTY_SHARE, captionInPage, chunks, createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'
import { FIXED_STEP, differenceShare, frameBodyInPage, gameCameraPoseInPage, writeStrip } from '../../tools/check-area/phase-zero.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/weapons-area.js')
const page = join(here, 'dist/sala-armas.html')
if (!existsSync(bundle)) throw new Error('dist/weapons-area.js missing: run node build.mjs')
if (!readFileSync(bundle, 'utf8').includes('weapons_area')) throw new Error('the bundle does not carry the weapons_area module')
for (const id of ['toggle_light', 'toggle_laser', 'toggle_stock', 'switch_underbarrel']) {
  if (!readFileSync(bundle, 'utf8').includes(id)) throw new Error(`the bundle does not carry the accessory bench control "${id}"`)
}
if (!readFileSync(bundle, 'utf8').includes('../weapon-svg/')) throw new Error('the bundle does not point the weapon thumbnails to ../weapon-svg/')
if (existsSync(page) && !readFileSync(page, 'utf8').includes('WeaponsArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-armas.html does not boot the area')
if (!existsSync(page)) {
  console.log('ok: bundle (no room page: build examples/test-room first)')
  process.exit(0)
}
console.log('ok: bundle and room page')

const require = createRequire(import.meta.url)
const { chromium } = /** @type {Partial<typeof import('playwright')>} */ (['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean) ?? {})
if (!chromium) {
  console.log('ok: bundle and room page (playwright not found: contact sheets skipped)')
  process.exit(0)
}

const SHEET_SIZE = 10
/** The named time of every hand picture: 40 steps of the fixed clock after the room is cleared. */
const CLOCK_FRAMES = 40
/** Third person: from his right side, 3.4 m away, 38 degrees of field of view, looking at the middle of the body: the whole body and the weapon. */
const THIRD_FRAME = { azimuthDeg: 90, distance: 3.4, fovDeg: 38, lookHeight: 1.0 }

/**
 * Runs in the page: the player holds the weapon (or the fists, for the reference) in the chosen camera, looks level or ten metres ahead with the aim risen or lowered by `rise` metres, optionally walks,
 * then the room is paused. Answers what the room says about the hand and the camera (the numbers rule 5 asks for).
 * @param {{ weaponId: string, mode: string, rise: number, walking: boolean, withSubject: boolean, frames: number }} args
 */
async function holdInPage({ weaponId, mode, rise, walking, withSubject, frames }) {
  const room = /** @type {any} */ (window).__testRoom
  room.setDebugCamera(null)
  if (room.paused) room.resume()
  room.environment.set({ nightFactor: 0, rain: 0, windX: 0, windZ: 0, windSpeed: 0, gust: 0, wetness: 0 })
  room.clear()
  room.setCameraMode(mode)
  if (withSubject) room.equip(weaponId)
  else room.setTool('fists')
  room.waitUntilReady()
  room.look([0, 1.7, 6], [0, 1.7 + rise, -4])
  if (walking) room.walk([0, 0, -3], 1.5)
  // the clock is the room's own: `frames` exact steps after the clear (which restarts it), all in this one synchronous call, so no live frame lands in between
  for (let frame = 0; frame < frames; frame++) room.update(1 / 60)
  const hand = room.handState()
  const round = (/** @type {number[]} */ list) => list.map((value) => +value.toFixed(3))
  const camera = room.camera.position
  const player = room.playerPosition
  room.pause()
  return { mode: room.cameraMode, stance: hand.stance, triggerFinger: hand.triggerFinger, handR: hand.targets?.R?.position ? round(hand.targets.R.position) : null, handL: hand.targets?.L?.position ? round(hand.targets.L.position) : null, camera: round([camera.x, camera.y, camera.z]), player: round(Array.isArray(player) ? player : [player.x, player.y, player.z]) }
}

/**
 * Runs in the page: the weapon in the hand, the use started (a tap, or held `hold` seconds), then `steps` exact steps of the fixed clock and the room paused: the swing or the throw at that time.
 * @param {{ weaponId: string, mode: string, steps: number, hold: number, settle: number, warmup: number }} args
 */
async function strikeInPage({ weaponId, mode, steps, hold, settle, warmup }) {
  const room = /** @type {any} */ (window).__testRoom
  room.setDebugCamera(null)
  if (room.paused) room.resume()
  room.environment.set({ nightFactor: 0, rain: 0, windX: 0, windZ: 0, windSpeed: 0, gust: 0, wetness: 0 })
  // room.clear() keeps the previous sample's blow in flight and its weapon state (cooldown, spent ammunition): let the blow end first and refill the weapon, so the use below is judged on a fresh one
  for (let frame = 0; frame < settle; frame++) room.update(1 / 60)
  room.clear()
  room.setCameraMode(mode)
  room.equip(weaponId)
  // refill restarts the weapon's own clock, and the draw it still owes ends within these steps
  room.tool.refill()
  for (let frame = 0; frame < settle; frame++) room.update(1 / 60)
  room.waitUntilReady()
  room.look([0, 1.7, 6], [0, 1.7, -4])
  // look() moves the player, but the hand targets and the frame only follow on an update: without these steps sample 0 would still carry the previous scene
  for (let frame = 0; frame < warmup; frame++) room.update(1 / 60)
  const round = (/** @type {number[] | undefined} */ list) => (list ? list.map((value) => +value.toFixed(3)) : null)
  const handBeforeUse = round(room.handState().targets?.R?.position)
  const used = room.use(hold)
  for (let frame = 0; frame < steps; frame++) room.update(1 / 60)
  const phase = room.tool.phase ?? null
  const hand = room.handState()
  room.pause()
  return { used: String(used), handBeforeUse, phase: typeof phase === 'string' ? phase : phase === null ? null : 'object', handR: round(hand.targets?.R?.position), handL: round(hand.targets?.L?.position) }
}

/** Steps of the fixed clock a sample waits before it starts, for the previous blow to land and the cooldowns to run out (4 s), before and after the weapon is put in hand. */
const BLOW_SETTLE_STEPS = 240

/** Steps of the fixed clock after the look and before the use, for the hand targets and the frame to follow the player: in the probe the targets equal the ones after 12 steps to 0.1 mm from the first step on, in both cameras. */
const WARMUP_STEPS = 1

/** How far (m) the hand target before the use may differ between the samples of a strip for the warm-up to count as settled. */
const WARMUP_AGREE_M = 0.002

/** The farthest any sample's hand target before the use is from the first sample's, or null when a sample has none. @param {any[]} states */
function warmupDisagreement(states) {
  const first = states[0]?.handBeforeUse
  if (!first || states.some((state) => !state.handBeforeUse)) return null
  return +Math.max(...states.map((state) => Math.hypot(...state.handBeforeUse.map((/** @type {number} */ value, /** @type {number} */ at) => value - first[at])))).toFixed(4)
}

const opened = await openRoomPage({ chromium, pageFile: page })
try {
  const arsenal = await opened.page.evaluate(() => {
    const room = /** @type {any} */ (window).__testRoom
    return [...room.arsenal.weapons.values()].map((/** @type {{ id: string, category: string }} */ weapon) => ({ id: weapon.id, family: weapon.category, item: `weapon_${weapon.id}`, drawn: room.measure(`weapon_${weapon.id}`) !== null }))
  })
  const drawn = arsenal.filter((/** @type {{ drawn: boolean }} */ weapon) => weapon.drawn)
  const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), knownDefectsFile: join(here, 'known-defects.json'), area: 'weapons', seed: 'none (the models are drawn without random draws; condition and ammunition at the area defaults)', catalogue: { count: arsenal.length, source: 'packages/game-weapons/src/data (the arsenal: room.arsenal.weapons); an entry is covered when the catalogue has the item weapon_<id>' } })
  const families = [...new Set(drawn.map((/** @type {{ family: string }} */ weapon) => weapon.family))]
  let number = 0
  for (const family of families) {
    const members = drawn.filter((/** @type {{ family: string }} */ weapon) => weapon.family === family)
    for (const [at, run] of chunks(members, SHEET_SIZE).entries()) {
      number += 1
      const suffix = members.length > SHEET_SIZE ? `-${at + 1}` : ''
      await recorder.sheet({ file: `${String(number).padStart(2, '0')}-${family}-side${suffix}`, family, entries: run.map((/** @type {{ item: string, id: string }} */ weapon) => ({ id: weapon.item, label: weapon.id })), view: { kind: 'side', fov: 22, elevationDeg: 3 }, yaw: 'long-axis-x', gap: 0.12 })
    }
  }

  // rule 5: one weapon per family in the hand, in both cameras, still with the aim high, level and low, and walking; each picture is compared with the same view holding the fists
  const HAND_FAMILIES = ['pistol', 'shotgun', 'rifle', 'launcher', 'melee_blade', 'throwable']
  const POSES = [['still-high', 5, false], ['still-level', 0, false], ['still-low', -5, false], ['walk-level', 0, true]]
  for (const family of HAND_FAMILIES) {
    const weapon = drawn.find((/** @type {{ family: string }} */ candidate) => candidate.family === family)
    if (!weapon) {
      recorder.observe(`hand-${family}`, 'strip-family-missing', `no drawn weapon of the family ${family}`)
      continue
    }
    for (const mode of ['first', 'third']) {
      for (const [pose, rise, walking] of POSES) {
        number += 1
        const file = `${String(number).padStart(2, '0')}-hand-${family}-${mode}-${pose}`
        await recorder.photo({
          file,
          family: `hand-${family}`,
          view: `${mode}-person`,
          subject: weapon.item,
        detail: String(pose),
          prepare: async (withSubject) => {
            const measured = await opened.page.evaluate(holdInPage, { weaponId: weapon.id, mode, rise, walking, withSubject, frames: CLOCK_FRAMES })
            // third person: the camera the game puts there (read through applyCamera) and the one the print uses, an explicit pose that frames the body and the weapon from his right side
            const gameCamera = await opened.page.evaluate(gameCameraPoseInPage)
            const printCamera = mode === 'third' ? { kind: 'explicit', ...(await opened.page.evaluate(frameBodyInPage, THIRD_FRAME)) } : { kind: 'game', ...gameCamera }
            await opened.page.evaluate(captionInPage, `${file}  ${weapon.id}  ${mode} person  ${pose}  seed none`)
            return { fixed: { pose, aimRise: rise, walking, clock: { stepS: +FIXED_STEP.toFixed(5), stepsAfterClear: CLOCK_FRAMES }, camera: walking ? { kind: printCamera.kind } : printCamera }, measured: { hand: measured, gameCamera, ...(walking ? { printCamera } : {}) } }
          },
        })
      }
    }
  }
  // phase 0 of spec 015: the strike of one weapon per melee class and the throw, as a strip of the use at five times after it starts (explicit side camera in third person, the game camera in first)
  const STRIKE_STEPS = [0, 6, 12, 18, 30]
  /** @type {Record<string, unknown>[]} */
  const strips = []
  /** @type {Record<string, unknown>[]} */
  const stripNumbers = []
  const STRIKES = [['melee_blade', 0], ['melee_blunt', 0], ['throwable', 0.5]]
  for (const [family, hold] of /** @type {[string, number][]} */ (STRIKES)) {
    const weapon = drawn.find((/** @type {{ family: string, id: string }} */ candidate) => candidate.family === family && candidate.id !== 'kick' && candidate.id !== 'shove')
    if (!weapon) {
      recorder.observe(`strike-${family}`, 'strip-family-missing', `no drawn weapon of the family ${family}`)
      continue
    }
    for (const mode of ['first', 'third']) {
      number += 1
      const file = `${String(number).padStart(2, '0')}-strike-${family}-${mode}`
      /** @type {{ png: Buffer, label: string }[]} */
      const frames = []
      /** @type {unknown[]} */
      const states = []
      for (const steps of STRIKE_STEPS) {
        states.push(await opened.page.evaluate(strikeInPage, { weaponId: weapon.id, mode, steps, hold, settle: BLOW_SETTLE_STEPS, warmup: WARMUP_STEPS }))
        if (mode === 'third') await opened.page.evaluate(frameBodyInPage, THIRD_FRAME)
        await opened.page.evaluate(captionInPage, `${file}  ${weapon.id}  ${mode} person  ${steps} steps after the use`)
        await opened.page.waitForTimeout(500)
        frames.push({ png: await opened.page.screenshot(), label: `${weapon.id}  +${steps} steps` })
      }
      const written = await writeStrip({ context: opened.context, frames, file: join(here, 'shots', `${file}.png`) })
      const differences = []
      for (let at = 1; at < frames.length; at++) differences.push(+(await differenceShare(opened.context, /** @type {any} */ (frames[0]).png, /** @type {any} */ (frames[at]).png)).toFixed(4))
      const statuses = states.map((state) => /** @type {any} */ (state).used)
      const warmupGapM = warmupDisagreement(/** @type {any[]} */ (states))
      strips.push({ id: `${weapon.item}/strike-${mode}`, file: `${file}.png`, family: `strike-${family}`, subject: weapon.item, mode, hold, stepsAfterUse: STRIKE_STEPS, warmupSteps: WARMUP_STEPS, stepS: +FIXED_STEP.toFixed(5), camera: mode === 'third' ? { kind: 'explicit', ...THIRD_FRAME } : { kind: 'game' }, useStatusPerStep: statuses, ...(family === 'throwable' ? { ...(mode === 'first' ? { animated: Math.max(...differences) >= PHOTO_EMPTY_SHARE } : {}), notes: ['not byte-stable between runs; see the gaps'] } : { differenceFromFirstFrame: differences }) })
      stripNumbers.push({ file: `${file}.png`, bytes: written.bytes, differenceFromFirstFrame: differences, handTargetSpreadM: warmupGapM, states })
      const spread = Math.max(...differences)
      const refused = [...new Set(statuses.filter((status) => status !== 'ok'))]
      const id = `${weapon.item}/strike-${mode}`
      if (warmupGapM === null) recorder.observe(id, 'hand-state-missing', 'room.handState gave no right-hand target in at least one sample')
      else if (warmupGapM > WARMUP_AGREE_M) recorder.observe(id, 'strip-warmup-unsettled', { gapM: warmupGapM })
      // judged only when the use was accepted: a refused use (cooldown, drawing, empty) draws nothing for a reason that is not the animation
      if (refused.length) recorder.observe(id, 'use-refused', { statuses: refused })
      else if (mode === 'third') continue
      else if (family === 'throwable') {
        // the positive control: the throw is known to move pixels, so a static reading here means the measure (or the strip) cannot see motion, and no "not animated" verdict of this run can be trusted
        if (spread < PHOTO_EMPTY_SHARE) recorder.observe(id, 'strip-control-static', { pixelShare: spread })
      } else if (spread < PHOTO_EMPTY_SHARE) recorder.observe(id, 'use-not-animated', { pixelShare: +spread.toFixed(3) })
    }
  }
  writeFileSync(join(here, 'shots/phase0-sanity.json'), JSON.stringify({ strips: stripNumbers }, null, 2) + '\n')

  const missing = arsenal.filter((/** @type {{ drawn: boolean }} */ weapon) => !weapon.drawn).map((/** @type {{ id: string }} */ weapon) => weapon.id)
  for (const id of missing) recorder.observe(id, 'no-catalogue-item', `no item weapon_${id}`)
  const summary = recorder.finish({ notInCatalogue: missing, families, strips, gaps: ['the throwable strike strips (weapon_molotov) are not byte-stable between runs. The unseeded Math.random of packages/game-test-room/src/explosives.ts:157 (context.random ?? Math.random) is read only by smoke (smoke sources, puffs), which a molotov never makes, so it is not the cause here; the molotov bursts on impact into fire, and the source of the variation is not identified (not confirmed). The melee strips are byte-stable.', 'the first-person walking shots (41-hand-shotgun-first-walk-level and 73-hand-throwable-first-walk-level) read one of two camera poses from run to run, never in between (position z 2.085 or 1.891; x 0, 0.004 or -0.006; y 1.7 or 1.707), while the other walking shots read the same on three runs: the walk is judged from the room at a fixed number of steps, and the source of the variation was not identified.', 'the third-person camera is too far to judge a swing by pixels: its strike strips carry no use-not-animated verdict, and its throw strip records no animated flag'] })
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
