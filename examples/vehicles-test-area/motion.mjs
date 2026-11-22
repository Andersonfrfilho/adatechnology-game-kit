// @ts-check
// Phase 0 of spec 016 (T0.1 motion prints): the one drive the vehicles area scripts (the lane run of `drive_lane`: a compact hatch that accelerates with a small steering weave and brakes before the wall),
// as a strip of six times of the fixed clock after the action, from the side; per sample the body's pitch and roll (rotation x and z of the car group), its speed and the steering angle of the wheels that turn.
// The area has no named hook to choose the model, a steady curve or a hard brake; the other models are not driven here (see the gaps in index.json).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { captionInPage } from '../../tools/check-area/contact-sheet.mjs'
import { FIXED_STEP, differenceShare, writeStrip } from '../../tools/check-area/phase-zero.mjs'

/**
 * Runs in the page: the lane run started from a clean room and stepped `steps` exact steps; answers the car's pose at the end and, with `record`, every 6th step on the way. Leaves the room paused.
 * @param {{ steps: number, record: boolean, frame: boolean }} args
 */
async function laneInPage({ steps, record, frame }) {
  const room = /** @type {any} */ (window).__testRoom
  room.setDebugCamera(null)
  if (room.paused) room.resume()
  room.environment.set({ nightFactor: 0, rain: 0, windX: 0, windZ: 0, windSpeed: 0, gust: 0, wetness: 0 })
  room.clear()
  const before = new Set(room.scene.children)
  const bench = room.bench()
  if (!bench || !bench.act('drive_lane')) return { error: 'no drive_lane action on the active bench' }
  room.update(1 / 60)
  const car = room.scene.children.find((/** @type {any} */ child) => !before.has(child) && child.isGroup)
  if (!car) return { error: 'the lane car was not found in the scene' }
  const Vector = room.camera.position.constructor
  /** @type {any[]} */
  const wheels = []
  car.traverse((/** @type {any} */ child) => { if (/wheel|tyre|tire/i.test(child.name || '')) wheels.push(child) })
  const poseOf = (/** @type {number} */ step, /** @type {number | null} */ previousX) => {
    const world = new Vector()
    car.getWorldPosition(world)
    return { step, x: +world.x.toFixed(3), z: +world.z.toFixed(3), speed: previousX === null ? 0 : +(((world.x - previousX) * 60)).toFixed(2), pitch: +car.rotation.z.toFixed(4), roll: +car.rotation.x.toFixed(4), yaw: +car.rotation.y.toFixed(4), wheelYaw: wheels.map((/** @type {any} */ wheel) => +wheel.rotation.y.toFixed(3)) }
  }
  const samples = []
  /** @type {number | null} */
  let previousX = null
  for (let step = 1; step <= steps; step++) {
    room.update(1 / 60)
    if (record && step % 6 === 0) {
      const pose = poseOf(step, previousX)
      previousX = pose.x
      // the speed above is over 6 steps, not 1
      samples.push({ ...pose, speed: pose.speed === 0 ? 0 : +(pose.speed / 6).toFixed(2) })
    }
  }
  const last = poseOf(steps, null)
  if (frame) {
    // from the side (+z), the car faces +x, the whole car in the frame; the camera follows it
    room.setDebugCamera({ position: [last.x - 0.5, 1.5, last.z + 7], target: [last.x, 0.6, last.z], fov: 30 })
  }
  room.pause()
  return { last, samples, wheelNames: wheels.map((/** @type {any} */ wheel) => wheel.name), carName: car.name || null }
}

/**
 * @param {{ opened: any, outDir: string, firstNumber: number, recorder: { observe: (id: string, what: string, value: unknown) => void } }} options
 * @returns {Promise<{ strips: Record<string, unknown>[], next: number }>}
 */
export async function recordLaneMotion({ opened, outDir, firstNumber, recorder }) {
  const { page, context } = opened
  const run = await page.evaluate(laneInPage, { steps: 720, record: true, frame: false })
  if (run.error) {
    recorder.observe('lane', 'drive-lane-unavailable', run.error)
    return { strips: [], next: firstNumber }
  }
  const samples = /** @type {any[]} */ (run.samples)
  const topSpeed = Math.max(...samples.map((sample) => sample.speed))
  const atTop = samples.findIndex((sample) => sample.speed >= topSpeed * 0.98)
  const brakingAt = samples.findIndex((sample, at) => at > atTop && sample.speed < topSpeed * 0.9)
  const stopped = samples.findIndex((sample, at) => at > atTop && sample.speed < 0.2)
  const pick = (/** @type {number} */ at, /** @type {number} */ fallback) => (samples[at >= 0 ? at : fallback]?.step ?? samples[fallback]?.step ?? 60)
  const steps = [pick(Math.floor(atTop / 2), 5), pick(atTop, 10), pick(Math.max(atTop, 0) + Math.floor((Math.max(brakingAt, atTop) - atTop) / 2), 20), pick(brakingAt, 30), pick(brakingAt >= 0 ? brakingAt + Math.floor(((stopped >= 0 ? stopped : samples.length - 1) - brakingAt) / 2) : -1, 40), pick(stopped, samples.length - 1)]
  /** @type {{ png: Buffer, label: string }[]} */
  const frames = []
  for (const at of steps) {
    await page.evaluate(laneInPage, { steps: at, record: false, frame: true })
    await page.evaluate(captionInPage, `lane run  step ${at}`)
    await page.waitForTimeout(450)
    frames.push({ png: await page.screenshot(), label: `lane run  step ${at}` })
  }
  const number = firstNumber + 1
  const file = `${String(number).padStart(2, '0')}-lane-run-strip`
  const written = await writeStrip({ context, frames, file: join(outDir, `${file}.png`), columns: 3 })
  const spread = []
  for (let at = 1; at < frames.length; at++) spread.push(+(await differenceShare(context, /** @type {any} */ (frames[0]).png, /** @type {any} */ (frames[at]).png)).toFixed(4))
  const pitches = samples.map((sample) => sample.pitch)
  const rolls = samples.map((sample) => sample.roll)
  const wheelYaws = samples.flatMap((sample) => sample.wheelYaw)
  const range = (/** @type {number[]} */ list) => (list.length ? +(Math.max(...list) - Math.min(...list)).toFixed(4) : null)
  const numbers = { topSpeedMs: topSpeed, pitchRangeRad: range(pitches), rollRangeRad: range(rolls), wheelYawRangeRad: range(wheelYaws), wheelNodes: run.wheelNames, samples }
  // not judged: the lane's pose() writes only position and yaw to the group (packages/game-vehicles-three/src/test-area/module.ts), so pitch and roll are 0 by construction and say nothing about the car
  writeFileSync(join(outDir, 'phase0-sanity.json'), JSON.stringify({ lane: { file: `${file}.png`, bytes: written.bytes, differenceFromFirstFrame: spread, ...numbers } }, null, 2) + '\n')
  return { strips: [{ id: 'compact_hatch/lane-run', file: `${file}.png`, subject: 'compact_hatch lane run (drive_lane)', stepsAfterAction: steps, stepS: +FIXED_STEP.toFixed(5), camera: { kind: 'explicit', follows: 'the car', offsetFromCar: [-0.5, 1.5, 7], targetHeightM: 0.6, fovDeg: 30 } }], next: number }
}
