// Checks the build output (the bundle exposes the module and the room page carries it with the boot that opens the area), then records the catalogue contact sheets with Playwright
// (Chromium, software GL, file:// with the network blocked): one sheet (or a few, ten to a sheet) per family of the arsenal in side view at one camera distance per sheet, then one weapon per family of the rule 5 (pistol, shotgun, rifle, launcher, blade, throwable) in the hand, first and third person, still with the aim high, level and low and walking.
// Prints and shots/index.json go to examples/weapons-test-area/shots (the PNGs are not tracked, see .gitignore; index.json is). The sheets and what they are for: tools/check-area/contact-sheet.mjs.
// Run: node build.mjs && node test.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { captionInPage, chunks, createSheetRecorder, openRoomPage } from '../../tools/check-area/contact-sheet.mjs'

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

/**
 * Runs in the page: the player holds the weapon (or the fists, for the reference) in the chosen camera, looks level or ten metres ahead with the aim risen or lowered by `rise` metres, optionally walks,
 * then the room is paused. Answers what the room says about the hand and the camera (the numbers rule 5 asks for).
 * @param {{ weaponId: string, mode: string, rise: number, walking: boolean, withSubject: boolean }} args
 */
async function holdInPage({ weaponId, mode, rise, walking, withSubject }) {
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
  for (let frame = 0; frame < 40; frame++) room.update(1 / 60)
  const hand = room.handState()
  const round = (/** @type {number[]} */ list) => list.map((value) => +value.toFixed(3))
  const camera = room.camera.position
  const player = room.playerPosition
  room.pause()
  return { mode: room.cameraMode, stance: hand.stance, triggerFinger: hand.triggerFinger, handR: hand.targets?.R?.position ? round(hand.targets.R.position) : null, handL: hand.targets?.L?.position ? round(hand.targets.L.position) : null, camera: round([camera.x, camera.y, camera.z]), player: round(Array.isArray(player) ? player : [player.x, player.y, player.z]) }
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
    if (!weapon) continue
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
            const measured = await opened.page.evaluate(holdInPage, { weaponId: weapon.id, mode, rise, walking, withSubject })
            await opened.page.evaluate(captionInPage, `${file}  ${weapon.id}  ${mode} person  ${pose}  seed none`)
            return { fixed: { pose, aimRise: rise, walking }, measured: { hand: measured } }
          },
        })
      }
    }
  }
  const missing = arsenal.filter((/** @type {{ drawn: boolean }} */ weapon) => !weapon.drawn).map((/** @type {{ id: string }} */ weapon) => weapon.id)
  for (const id of missing) recorder.observe(id, 'no-catalogue-item', `no item weapon_${id}`)
  const summary = recorder.finish({ notInCatalogue: missing, families })
  if (opened.external.length) throw new Error(`a request left the page: ${opened.external.slice(0, 3).join(', ')}`)
  process.exitCode = summary.exitCode
} finally {
  await opened.browser.close()
}
