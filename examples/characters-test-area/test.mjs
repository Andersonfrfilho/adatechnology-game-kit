// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): the 13 undead types and the professions of the area, front and side, one row per sheet at one camera distance (same scale), with a height ruler (1.80 m declared, 2.10 m door) at the left of each row.
// Prints and shots/index.json go to examples/characters-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'
import { FIXED_STEP } from '../../tools/check-area/phase-zero.mjs'
import { recordPlayerLocomotion } from './locomotion.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, 'dist/characters-area.js')
const page = join(here, 'dist/sala-personagens.html')
if (!existsSync(bundle)) throw new Error('dist/characters-area.js missing: run node build.mjs')
const code = readFileSync(bundle, 'utf8')
if (!code.includes('characters_area')) throw new Error('the bundle does not carry the characters_area module')
for (const id of ['hit_preset', 'death_rule', 'region_x_caliber', 'benchmark_1000', 'zombie_', 'person_']) {
  if (!code.includes(id)) throw new Error(`the bundle does not carry "${id}"`)
}
if (existsSync(page) && !readFileSync(page, 'utf8').includes('CharactersArea.loadInto(window.__testRoom)')) throw new Error('dist/sala-personagens.html does not boot the area')
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

const opened = await openRoomPage({ chromium, pageFile: page })
try {
  const catalogue = await opened.page.evaluate(() => /** @type {any} */ (window).CharactersArea.createModule().items('en').map((/** @type {{ id: string }} */ item) => item.id))
  const undead = catalogue.filter((/** @type {string} */ id) => id.startsWith('zombie_'))
  const people = catalogue.filter((/** @type {string} */ id) => id.startsWith('person_'))
  const declaredBody = JSON.parse(readFileSync(join(here, '../../packages/game-characters/src/data/body.json'), 'utf8'))
  const DECLARED_HEIGHT_M = declaredBody.guide.heightMetres
  const HEIGHT_TOLERANCE = 1.05
  /** @type {Map<string, { s?: number, drop?: number }>} */
  const undeadPosture = new Map(JSON.parse(readFileSync(join(here, '../../packages/game-characters-undead/src/data/types.json'), 'utf8')).map((/** @type {{ id: string, posture: { s?: number, drop?: number } }} */ type) => [type.id, type.posture]))
  // `drop` lowers the hip of the pose (best-builder.ts: "drop desce o quadril"; the knees bend to keep the feet on the floor), times the type's scale; the professions dip 0.043 m by themselves.
  // A lowest point inside that allowance plus 2 cm is the posture as declared; deeper is beyond it
  const GAIT_DIP_M = 0.043
  const SINK_TOLERANCE_M = 0.02
  /** @param {string} id @param {number} lowestPointM */
  const classifySink = (id, lowestPointM) => {
    const posture = undeadPosture.get(id.slice('zombie_'.length))
    if (!posture) return null
    const declaredDropM = +(Math.abs(posture.drop ?? 0) * (posture.s ?? 1)).toFixed(3)
    const allowanceM = +(declaredDropM + GAIT_DIP_M + SINK_TOLERANCE_M).toFixed(3)
    return { what: -lowestPointM <= allowanceM ? 'sinks-as-declared' : 'sinks', extra: { declaredDropM, allowanceM, note: 'whether a declared drop that buries the feet is intended is a review question' } }
  }
  const recorder = createSheetRecorder({ page: opened.page, context: opened.context, outDir: join(here, 'shots'), knownDefectsFile: join(here, 'known-defects.json'), classifySink, area: 'characters', seed: 'none (the bodies are drawn without random draws; ages and wounds at the area defaults)', catalogue: { count: catalogue.length, source: 'packages/game-characters-undead/src/data (UNDEAD_TYPES) and packages/game-characters-people/src/data (PROFESSIONS), the items of the area' } })
  // the bodies of the area face the camera at yaw PI (examples/characters-test-area placements), so a profile is a quarter turn
  const FRONT = Math.PI
  const SIDE = -Math.PI / 2
  const view = { kind: 'front', fov: 22, elevationDeg: 2 }
  let number = 0
  for (const [family, ids] of [['undead', undead], ['professions', people]]) {
    for (const [name, yaw] of /** @type {[string, number][]} */ ([['front', FRONT], ['side', SIDE]])) {
      number += 1
      const laid = await recorder.sheet({ file: `${String(number).padStart(2, '0')}-${family}-${name}`, family, entries: ids.map((/** @type {string} */ id) => ({ id })), view, yaw, gap: 0.45, ruler: true })
      // every entry against its declared height (body.json guide.heightMetres, times the type's posture scale `s` for an undead type), to the top of the skull (the way tools/measure-body-and-cabin.mjs does,
      // so hair, a raised hand or a leap are not in it); the highest vertex and what holds it go along; tolerance 5%
      for (const cell of laid.cells) {
        const declared = +(DECLARED_HEIGHT_M * (cell.id.startsWith('zombie_') ? (undeadPosture.get(cell.id.slice('zombie_'.length))?.s ?? 1) : 1)).toFixed(3)
        const headTop = cell.headTopM ?? cell.topM
        if (headTop !== null && headTop > declared * HEIGHT_TOLERANCE) recorder.observe(cell.id, 'height-over-declared', { declaredM: declared, headTopM: cell.headTopM, highestVertexM: cell.topM, highestVertexHeldBy: cell.topAt })
      }
      // every profession's lowest point is the same: said once, for the reviewer
      if (family === 'professions' && name === 'front') {
        const lows = laid.cells.map((/** @type {{ lowestOverCycleM: number }} */ cell) => cell.lowestOverCycleM)
        if (lows.length > 0 && Math.max(...lows) - Math.min(...lows) < 0.005) recorder.observe('professions', 'observation-lowest-point-offset', { lowestPointM: lows[0], heldBy: laid.cells[0].lowestAt, note: 'not a failure; for the reviewer: every profession stands this far below the floor origin, under the 0.05 m limit' })
      }
    }
  }

  // phase 0 of spec 013: the locomotion of the undead types (walk, run, sprint: the moments wander, chase, sprint) at four times of the clock, front and side, on the sheets' own camera (a fixed time after the freeze:
  // the module walks the bodies in place on its own clock, restarted by every sheet, so a time is the same frame on every run); the cycle of each type differs, so the four times are not the same fraction of every cycle
  const LOCOMOTION_STEPS = [0, 8, 16, 24]
  /** @type {Record<string, unknown>[]} */
  const locomotion = []
  for (const moment of ['wander', 'chase', 'sprint']) {
    await opened.page.evaluate((/** @type {string} */ value) => /** @type {any} */ (window).__testRoom.bench().set('moment', value), moment)
    for (const [name, yaw] of /** @type {[string, number][]} */ ([['side', SIDE], ['front', FRONT]])) {
      for (const extraFrames of LOCOMOTION_STEPS) {
        number += 1
        const file = `${String(number).padStart(2, '0')}-undead-${moment}-${name}-t${String(extraFrames).padStart(2, '0')}`
        await recorder.sheet({ file, family: `undead-${moment}`, entries: undead.map((/** @type {string} */ id) => ({ id })), view, yaw, gap: 0.45, ruler: true, extraFrames })
        locomotion.push({ file: `${file}.png`, moment, view: name, stepsAfterFreeze: extraFrames, stepS: +FIXED_STEP.toFixed(5) })
      }
    }
  }
  await opened.page.evaluate(() => /** @type {any} */ (window).__testRoom.bench().set('moment', 'wander'))
  // the professions walk at 1.4 m/s in place: one pair of rows at the same times
  for (const [name, yaw] of /** @type {[string, number][]} */ ([['side', SIDE], ['front', FRONT]])) {
    for (const extraFrames of LOCOMOTION_STEPS) {
      number += 1
      const file = `${String(number).padStart(2, '0')}-professions-walk-${name}-t${String(extraFrames).padStart(2, '0')}`
      await recorder.sheet({ file, family: 'professions-walk', entries: people.map((/** @type {string} */ id) => ({ id })), view, yaw, gap: 0.45, ruler: true, extraFrames })
      locomotion.push({ file: `${file}.png`, moment: 'walk-pose', view: name, stepsAfterFreeze: extraFrames, stepS: +FIXED_STEP.toFixed(5) })
    }
  }
  // the player body: walk, run, crouch strips and the foot numbers at 0 to 7 m/s (T0.1 and T0.2)
  const player = await recordPlayerLocomotion({ opened, outDir: join(here, 'shots'), firstNumber: number, recorder })
  const summary = recorder.finish({ locomotion, playerStrips: player.strips, gaps: ['undead and professions are walked in place by the module: no ground speed, so no stance slide can be measured for them (only the player body moves)', 'no crouch or aim-walk clip is exposed for the undead types'] })
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
