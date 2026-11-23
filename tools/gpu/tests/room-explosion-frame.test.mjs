// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AFTER_FRAMES, afterLastFrameOf, frameGate, frameMetricsOf, heldFramesOf, isBaseComparable, isFrameWorse } from '../room-explosion-frame.mjs'

const VARIANT = 'jolt-d4-worker'
const GATED = new Set([1])
/** A stage row. @param {number} round @param {number} frame @param {number} updateMs @param {number | undefined} renderCpu @param {string} [kind] */
const row = (round, frame, updateMs, renderCpu, kind = 'blast') => ({ variant: VARIANT, throttle: 1, kind, round, frame, updateMs, ...(renderCpu === undefined ? {} : { extras: { renderCpu } }) })
const metric = (/** @type {number} */ f0Ms, /** @type {number} */ afterMs, /** @type {string} */ kind = 'blast', /** @type {number} */ throttle = 1) => ({ variant: VARIANT, throttle, kind, f0Ms, afterMs })
/** A realistic round: frame 0 and 660 frames, the 7 after it with `after` ms at the worst. @param {number} round @param {number} f0 @param {number} after @param {string} [kind] */
const roundOf = (round, f0, after, kind = 'blast') => Array.from({ length: 661 }, (_, frame) => row(round, frame, frame === 0 ? f0 - 8 : frame === 4 ? after - 1 : 3, frame === 0 ? 8 : 1, kind))
/** @typedef {import('../room-explosion-frame.mjs').FrameProblem} FrameProblem */
const measureOf = (/** @type {ReturnType<typeof metric>[]} */ metrics, /** @type {FrameProblem[]} */ problems = []) => ({ metrics, problems })
const gate = (/** @type {ReturnType<typeof metric>[]} */ now, /** @type {object | undefined} */ base, mode = 'deadline') => frameGate({ measure: measureOf(now), base, mode, variant: VARIANT, gated: GATED })

test('f0Ms is the mean of the 3 worst f0 (update + render) and afterMs the worst of the 7 frames after, in those rounds', () => {
  const rows = [roundOf(1, 68, 26), roundOf(2, 58, 30), roundOf(3, 78, 10), roundOf(4, 11, 99)].flat()
  const { metrics, problems } = frameMetricsOf(rows)
  assert.deepEqual(problems, [])
  assert.equal(metrics[0]?.f0Ms, 68)
  assert.equal(metrics[0]?.afterMs, 22)
})

test('a realistic series of 660 frames a round gives the numbers', () => {
  const { metrics, problems } = frameMetricsOf([roundOf(1, 65, 25), roundOf(2, 66, 24), roundOf(3, 64, 26)].flat())
  assert.deepEqual(problems, [])
  assert.deepEqual(metrics.map((entry) => [entry.f0Ms, entry.afterMs]), [[65, 25]])
})

/** A paced round (spec 018 D2): frames 0..held-1 hold the world, frame `held` resumes it at `resume` ms, frame `held + late` reads `lateMs`, the rest 5 ms. @param {number} round @param {number} held @param {number} resume @param {number} [late] @param {number} [lateMs] */
const pacedRoundOf = (round, held, resume, late = 0, lateMs = 0) =>
  Array.from({ length: 40 }, (_, frame) => ({ ...row(round, frame, frame === 0 ? 15 : frame === held ? resume - 1 : late > 0 && frame === held + late ? lateMs - 1 : 4, 1), ...(frame < held ? { held: true } : {}) }))

test('with the world held, afterMs reaches the frame the world resumes in and the 7 after it', () => {
  const { metrics, problems } = frameMetricsOf([pacedRoundOf(1, 8, 30), pacedRoundOf(2, 8, 31), pacedRoundOf(3, 8, 29)].flat())
  assert.deepEqual(problems, [])
  assert.equal(metrics[0]?.afterMs, 30)
  assert.equal(metrics[0]?.afterLastFrame, 8 + AFTER_FRAMES)
})

test('the window ends 7 frames after the resume: a frame past it is not read, the 7th after it is', () => {
  assert.equal(frameMetricsOf([1, 2, 3].flatMap((round) => pacedRoundOf(round, 8, 12, AFTER_FRAMES, 40))).metrics[0]?.afterMs, 40)
  assert.equal(frameMetricsOf([1, 2, 3].flatMap((round) => pacedRoundOf(round, 8, 12, AFTER_FRAMES + 1, 40))).metrics[0]?.afterMs, 12)
})

test('the held frames count from frame 0, one after the other; a report without the field holds none, so its window is the old 1..7', () => {
  assert.equal(heldFramesOf([row(1, 0, 1, 1), row(1, 1, 1, 1)]), 0)
  assert.equal(afterLastFrameOf([row(1, 0, 1, 1)]), AFTER_FRAMES)
  const gap = [{ ...row(1, 0, 1, 1), held: true }, { ...row(1, 1, 1, 1), held: true }, row(1, 2, 1, 1), { ...row(1, 3, 1, 1), held: true }]
  assert.equal(heldFramesOf(gap), 2)
  assert.equal(heldFramesOf([row(1, 0, 1, 1), { ...row(1, 1, 1, 1), held: true }]), 0)
  assert.equal(frameMetricsOf([roundOf(1, 65, 25), roundOf(2, 66, 24), roundOf(3, 64, 26)].flat()).metrics[0]?.afterLastFrame, undefined)
})

test('a held round whose series ends before the window does is missing-after-frames, never a shorter window', () => {
  const short = [1, 2, 3].flatMap((round) => pacedRoundOf(round, 8, 30).filter((entry) => entry.frame <= 8 + AFTER_FRAMES - 1))
  assert.equal(frameMetricsOf(short).problems[0]?.status, 'missing-after-frames')
})

test('a run without the render time has no numbers and no problems', () => {
  assert.deepEqual(frameMetricsOf([row(1, 0, 60, undefined)]), { metrics: [], problems: [] })
})

test('fewer than 3 rounds is a problem, not a mean of 1 or 2', () => {
  const { metrics, problems } = frameMetricsOf([roundOf(1, 65, 25), roundOf(2, 66, 24)].flat())
  assert.deepEqual(metrics, [])
  assert.equal(problems[0]?.status, 'too-few-rounds')
})

test('a round without frame 0 is a problem, not a silent drop', () => {
  const { metrics, problems } = frameMetricsOf([roundOf(1, 65, 25), roundOf(2, 66, 24), roundOf(3, 64, 26).filter((entry) => entry.frame !== 0)].flat())
  assert.deepEqual(metrics, [])
  assert.equal(problems[0]?.status, 'missing-hit-frame')
})

test('no frames after the strike, or a partial render time, is missing-after-frames and never an afterMs of 0', () => {
  const noAfter = [1, 2, 3].flatMap((round) => roundOf(round, 65, 25).filter((entry) => entry.frame === 0))
  assert.equal(frameMetricsOf(noAfter).problems[0]?.status, 'missing-after-frames')
  const partial = [roundOf(1, 65, 25), roundOf(2, 66, 24), roundOf(3, 64, 26).map((entry) => (entry.frame === 3 ? row(3, 3, 3, undefined) : entry))].flat()
  const result = frameMetricsOf(partial)
  assert.deepEqual(result.metrics, [])
  assert.equal(result.problems[0]?.status, 'missing-after-frames')
})

test('limits are exact: now == was * 1.15 or now - was == 3 does not block, a hair over both does', () => {
  assert.equal(isFrameWorse(115, 100), false)
  assert.equal(isFrameWorse(115.01, 100), true)
  assert.equal(isFrameWorse(23, 20), false)
  assert.equal(isFrameWorse(23.01, 20), true)
  assert.equal(isFrameWorse(13, 10), false)
  assert.equal(isFrameWorse(14, 10), true)
  assert.equal(isFrameWorse(7, 5), false)
})

test('the gate blocks f0Ms and afterMs separately', () => {
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }
  assert.deepEqual(gate([metric(68, 26)], base).regressions, [])
  assert.deepEqual(gate([metric(80, 26)], base).regressions.map((entry) => entry.field), ['f0Ms'])
  assert.deepEqual(gate([metric(66, 33)], base).regressions.map((entry) => entry.field), ['afterMs'])
})

test('a base in another mode, or without one, or without the field, says why it did not compare', () => {
  const now = [metric(200, 90)]
  assert.equal(isBaseComparable({ budgetMode: 'quota' }, 'deadline'), false)
  assert.equal(isBaseComparable({}, 'deadline'), false)
  const other = gate(now, { budgetMode: 'quota', frameMetrics: [metric(65, 25)] })
  assert.equal(other.status, 'other-mode')
  assert.equal(other.compared, false)
  assert.match(other.reason, /quota/)
  assert.equal(gate(now, { frameMetrics: [metric(65, 25)] }).status, 'other-mode')
  assert.equal(gate(now, undefined).status, 'no-base')
  assert.equal(gate(now, { budgetMode: 'deadline' }).status, 'base-without-metrics')
})

test('no frame parts, only problems, and no blocking level each have their own status and never block', () => {
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }
  assert.equal(frameGate({ measure: measureOf([]), base, mode: 'deadline', variant: VARIANT, gated: GATED }).status, 'no-frame-parts')
  const problem = [{ key: 'k', status: /** @type {const} */ ('too-few-rounds') }]
  assert.equal(frameGate({ measure: measureOf([], problem), base, mode: 'deadline', variant: VARIANT, gated: GATED }).status, 'unmeasurable')
  const only4x = gate([metric(300, 90, 'blast', 4)], base)
  assert.equal(only4x.status, 'no-blocking-level')
  assert.equal(only4x.compared, false)
  assert.deepEqual(only4x.regressions, [])
})

test('a kind only in the base, or only in the run, is listed and not compared', () => {
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25), metric(70, 25, 'hammer')] }
  const result = gate([metric(66, 25), metric(300, 90, 'crater')], base)
  assert.deepEqual(result.regressions, [])
  assert.equal(result.skipped.length, 2)
  assert.ok(result.skipped.some((entry) => entry.includes('hammer') && entry.includes('not in this run')))
  assert.ok(result.skipped.some((entry) => entry.includes('crater') && entry.includes('not in the base')))
})

test('a base with an afterMs of 0 would block everything: the compare still reads it, so the base must never get one (see mergeBase)', () => {
  assert.equal(isFrameWorse(25, 0), true)
})

test('a run with another explosive than c4 is never compared, and a base with another explosive is not comparable', () => {
  const now = [metric(200, 90)]
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }
  const other = frameGate({ measure: measureOf(now), base, mode: 'deadline', variant: VARIANT, gated: GATED, explosive: 'dynamite' })
  assert.equal(other.status, 'other-explosive')
  assert.equal(other.compared, false)
  assert.deepEqual(other.regressions, [])
  assert.equal(frameGate({ measure: measureOf(now), base: undefined, mode: 'deadline', variant: VARIANT, gated: GATED, explosive: 'dynamite' }).status, 'other-explosive')
  assert.equal(isBaseComparable({ budgetMode: 'deadline', explosive: 'dynamite' }, 'deadline'), false)
  assert.equal(isBaseComparable({ budgetMode: 'deadline', explosive: 'dynamite' }, 'deadline', 'dynamite'), false)
  assert.equal(gate(now, { budgetMode: 'deadline', explosive: 'dynamite', frameMetrics: [metric(65, 25)] }).status, 'other-explosive')
})

test('the default explosive is c4: a base without the field, or with it, compares as before', () => {
  const now = [metric(200, 90)]
  assert.equal(isBaseComparable({ budgetMode: 'deadline' }, 'deadline'), true)
  assert.equal(isBaseComparable({ budgetMode: 'deadline', explosive: 'c4' }, 'deadline', 'c4'), true)
  assert.equal(gate(now, { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }).compared, true)
  assert.equal(gate(now, { budgetMode: 'deadline', explosive: 'c4', frameMetrics: [metric(65, 25)] }).regressions.length, 2)
})
