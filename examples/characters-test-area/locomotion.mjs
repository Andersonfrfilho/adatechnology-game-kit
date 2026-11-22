// @ts-check
// Phase 0 of spec 013 (T0.1 locomotion prints, T0.2 foot slide and joint jump): the player body walks, runs and crouch-walks in the room, third person, an explicit camera from the side and from the front;
// per frame the lowest point of each foot, where the foot stands on the ground and the hip height are read from the rig (rig.legs[i].g), then the stance slide, the stride and the hip height are summarised.
// The undead types and the professions are recorded by the sheets of test.mjs (the module walks them in place, so no ground speed is known for them: see the finding in index.json).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { captionInPage } from '../../tools/check-area/contact-sheet.mjs'
import { FIXED_STEP, differenceShare, frameBodyInPage, writeStrip } from '../../tools/check-area/phase-zero.mjs'

const FRAME = { distance: 3.6, fovDeg: 34, lookHeight: 0.95 }
/** Metres the body covers in a run (the arena is 14 m wide). */
const PATH_M = 9

/**
 * Runs in the page: the body walks PATH_M metres at `speed` (running or crouching as asked) and, for `steps` exact steps of the fixed clock after the room is cleared, the foot and hip numbers of every step are read.
 * With `record` false it only stops at `steps`. Leaves the room paused.
 * @param {{ speed: number, crouch: boolean, steps: number, record: boolean }} args
 */
async function gaitInPage({ speed, crouch, steps, record }) {
  const room = /** @type {any} */ (window).__testRoom
  room.setDebugCamera(null)
  if (room.paused) room.resume()
  room.environment.set({ nightFactor: 0, rain: 0, windX: 0, windZ: 0, windSpeed: 0, gust: 0, wetness: 0 })
  room.clear()
  room.setCameraMode('third')
  room.setTool('fists')
  room.waitUntilReady()
  room.setAvatarState({ crouch })
  room.look([0, 1.7, 5.5], [0, 1.7, -6])
  room.walk([0, 0, 5.5 - 9], 9 / speed)
  const rig = room.avatar.avatar.rig
  const Vector = room.camera.position.constructor
  const centre = new Vector()
  const corner = new Vector()
  /** the foot of one leg: the mesh under its hip group whose middle is lowest; its lowest corner of the box and the ground position of its middle */
  const footOf = (/** @type {any} */ leg) => {
    /** @type {{ centreY: number, lowest: number, x: number, z: number } | null} */
    let best = null
    leg.g.updateWorldMatrix(true, true)
    leg.g.traverse((/** @type {any} */ child) => {
      if (!child.isMesh || !child.visible) return
      child.geometry.computeBoundingBox()
      const box = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld)
      box.getCenter(centre)
      if (!best || centre.y < best.centreY) best = { centreY: centre.y, lowest: box.min.y, x: centre.x, z: centre.z }
    })
    return best
  }
  const samples = []
  for (let step = 0; step < steps; step++) {
    room.update(1 / 60)
    if (!record) continue
    const feet = rig.legs.map(footOf)
    rig.legs[0].g.getWorldPosition(corner)
    const player = room.playerPosition
    samples.push({ step, feet, hipY: corner.y, player: [player[0] ?? player.x, player[2] ?? player.z], speed: room.avatarState().speed })
  }
  room.pause()
  return samples
}

/** @param {number[]} values */
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)

/**
 * The numbers of T0.2 from the per-step samples of one gait (steady part only: the first half second is the body speeding up).
 * @param {any[]} all @param {number} speed
 */
export function analyseGait(all, speed) {
  const samples = all.filter((sample) => sample.step >= 30)
  const lowestOfAll = Math.min(...samples.flatMap((sample) => sample.feet.map((/** @type {any} */ foot) => foot.lowest)))
  const CONTACT_M = 0.02
  /** @type {{ slideM: number[], strideM: number[], periodS: number[], contactShare: number[], liftM: number[], lowestM: number[] }} */
  const out = { slideM: [], strideM: [], periodS: [], contactShare: [], liftM: [], lowestM: [] }
  /** @type {number[][]} */
  const startsAt = [[], []]
  for (const leg of [0, 1]) {
    const heights = samples.map((sample) => sample.feet[leg].lowest)
    out.lowestM.push(+Math.min(...heights).toFixed(3))
    out.liftM.push(+(Math.max(...heights) - Math.min(...heights)).toFixed(3))
    const down = heights.map((height) => height - lowestOfAll < CONTACT_M)
    out.contactShare.push(+(down.filter(Boolean).length / down.length).toFixed(2))
    let runStart = -1
    for (let at = 0; at <= down.length; at++) {
      if (down[at] && runStart < 0) runStart = at
      if (!down[at] && runStart >= 0) {
        // a stance that begins and ends inside the window: how far the foot's middle moved on the ground while it was down
        if (runStart > 0 && at < down.length) {
          const first = samples[runStart].feet[leg]
          const last = samples[at - 1].feet[leg]
          out.slideM.push(+Math.hypot(last.x - first.x, last.z - first.z).toFixed(3))
          startsAt[leg].push(runStart)
        }
        runStart = -1
      }
    }
    for (let at = 1; at < startsAt[leg].length; at++) {
      const from = samples[/** @type {number} */ (startsAt[leg][at - 1])]
      const to = samples[/** @type {number} */ (startsAt[leg][at])]
      out.strideM.push(+Math.hypot(to.feet[leg].x - from.feet[leg].x, to.feet[leg].z - from.feet[leg].z).toFixed(3))
      out.periodS.push(+(((to.step - from.step) * FIXED_STEP)).toFixed(3))
    }
  }
  const hips = samples.map((sample) => sample.hipY)
  const measuredSpeed = mean(samples.map((sample) => sample.speed))
  return {
    requestedSpeedMs: speed,
    measuredSpeedMs: +measuredSpeed.toFixed(2),
    stanceSlideM: { count: out.slideM.length, mean: +mean(out.slideM).toFixed(3), max: out.slideM.length ? Math.max(...out.slideM) : null },
    strideLengthM: +mean(out.strideM).toFixed(2),
    strideFromSpeedM: +(measuredSpeed * mean(out.periodS)).toFixed(2),
    cyclePeriodS: +mean(out.periodS).toFixed(3),
    footLowestM: out.lowestM,
    footLiftM: out.liftM,
    contactShare: out.contactShare,
    hipHeightM: { min: +Math.min(...hips).toFixed(3), max: +Math.max(...hips).toFixed(3), mean: +mean(hips).toFixed(3) },
    // the largest change of the hip height between two steps: a stand-in for a joint that jumps
    hipStepMaxM: +Math.max(...hips.slice(1).map((height, at) => Math.abs(height - (hips[at] ?? height)))).toFixed(4),
    firstContactStep: startsAt[0][0] ?? null,
  }
}

/**
 * Records the player body's locomotion: the strips (4 times of the cycle, side and front) of walk, run and crouch, and the sweep of speeds.
 * @param {{ opened: any, outDir: string, firstNumber: number, recorder: { observe: (id: string, what: string, value: unknown) => void } }} options
 * @returns {Promise<{ strips: Record<string, unknown>[], sweep: unknown[], next: number }>}
 */
export async function recordPlayerLocomotion({ opened, outDir, firstNumber, recorder }) {
  const { page, context } = opened
  let number = firstNumber
  /** @type {Record<string, unknown>[]} */
  const strips = []
  /** @type {unknown[]} */
  const sweep = []
  /** @param {boolean} run */
  const holdRun = async (run) => { if (run) await page.keyboard.down('ShiftLeft'); else await page.keyboard.up('ShiftLeft') }
  const GAITS = [{ name: 'walk', speed: 1.4, run: false, crouch: false }, { name: 'run', speed: 5, run: true, crouch: false }, { name: 'crouch-walk', speed: 0.9, run: false, crouch: true }]
  for (const gait of GAITS) {
    await holdRun(gait.run)
    const samples = await page.evaluate(gaitInPage, { speed: gait.speed, crouch: gait.crouch, steps: 120, record: true })
    const numbers = analyseGait(samples, gait.speed)
    // four times of the cycle: the first steady contact of the left foot and the quarters of its period (rounded to whole steps)
    const period = Math.round(numbers.cyclePeriodS / FIXED_STEP) || 30
    const base = 30 + (numbers.firstContactStep ?? 0)
    const quarters = [0, 1, 2, 3].map((quarter) => base + Math.round((period * quarter) / 4))
    /** @type {{ png: Buffer, label: string }[]} */
    const frames = []
    for (const view of /** @type {[string, number][]} */ ([['side', 90], ['front', 0]])) {
      for (const [at, steps] of quarters.entries()) {
        await page.evaluate(gaitInPage, { speed: gait.speed, crouch: gait.crouch, steps, record: false })
        await page.evaluate(frameBodyInPage, { azimuthDeg: view[1], distance: FRAME.distance, fovDeg: FRAME.fovDeg, lookHeight: FRAME.lookHeight })
        await page.evaluate(captionInPage, `${gait.name}  ${view[0]}  cycle ${at * 25}%  step ${steps}`)
        await page.waitForTimeout(450)
        frames.push({ png: await page.screenshot(), label: `${gait.name} ${view[0]} ${at * 25}%  step ${steps}` })
      }
    }
    await holdRun(false)
    number += 1
    const file = `${String(number).padStart(2, '0')}-player-${gait.name}-strip`
    const written = await writeStrip({ context, frames, file: join(outDir, `${file}.png`), columns: 4 })
    const spread = []
    for (let at = 1; at < 4; at++) spread.push(+(await differenceShare(context, /** @type {any} */ (frames[0]).png, /** @type {any} */ (frames[at]).png)).toFixed(4))
    // the four times of the cycle must be four different poses
    if (Math.min(...spread) < 0.001) recorder.observe(`player/${gait.name}`, 'cycle-frames-equal', spread)
    strips.push({ file: `${file}.png`, subject: `player body, ${gait.name}`, speedMs: gait.speed, views: ['side', 'front'], cyclePhasesPercent: [0, 25, 50, 75], stepsAfterClear: quarters, stepS: +FIXED_STEP.toFixed(5), camera: { kind: 'explicit', azimuthDegSideFront: [90, 0], ...FRAME } })
    sweep.push({ gait: gait.name, file: `${file}.png`, bytes: written.bytes, differenceFromFirstFrame: spread, numbers })
  }
  // T0.2: the foot slide at 0 to 7 m/s, walking pose below 3 m/s and running pose from 2 m/s on (the Shift key), numbers only
  const SWEEP = [[0.6, false], [1.0, false], [1.4, false], [2.0, false], [3.0, false], [2.0, true], [3.0, true], [4.0, true], [5.0, true], [6.0, true], [7.0, true]]
  for (const [speed, run] of /** @type {[number, boolean][]} */ (SWEEP)) {
    await holdRun(run)
    const samples = await page.evaluate(gaitInPage, { speed, crouch: false, steps: Math.min(150, Math.floor((PATH_M / speed) * 60) - 5), record: true })
    await holdRun(false)
    sweep.push({ gait: run ? 'run-pose' : 'walk-pose', ...analyseGait(samples, speed) })
  }
  writeFileSync(join(outDir, 'phase0-sanity.json'), JSON.stringify({ player: sweep }, null, 2) + '\n')
  return { strips, sweep, next: number }
}
