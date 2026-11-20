// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { frameGate, frameMetricsOf, isBaseComparable, isFrameWorse } from '../room-explosion-frame.mjs'

/** A stage row: update ms and render ms of one frame of one round. @param {number} round @param {number} frame @param {number} updateMs @param {number} renderCpu */
const row = (round, frame, updateMs, renderCpu) => ({ variant: 'jolt-d4-worker', throttle: 1, kind: 'blast', round, frame, updateMs, extras: { renderCpu } })
const metric = (/** @type {number} */ f0Ms, /** @type {number} */ afterMs) => ({ variant: 'jolt-d4-worker', throttle: 1, kind: 'blast', f0Ms, afterMs })

test('f0Ms is the mean of the 3 worst f0 (update + render) and afterMs the worst of the 7 frames after, in those rounds', () => {
  const rows = [
    row(1, 0, 60, 8), row(1, 1, 20, 2), row(1, 7, 25, 1), row(1, 8, 90, 0),
    row(2, 0, 50, 8), row(2, 3, 30, 0),
    row(3, 0, 70, 8), row(3, 2, 10, 0),
    row(4, 0, 10, 1), row(4, 1, 99, 1),
  ]
  const [result] = frameMetricsOf(rows)
  assert.equal(result?.f0Ms, 68)
  assert.equal(result?.afterMs, 22)
})

test('a report without the render time (no frame parts) has no explosion frame numbers', () => {
  assert.deepEqual(frameMetricsOf([{ variant: 'v', throttle: 1, kind: 'blast', round: 1, frame: 0, updateMs: 60 }]), [])
})

test('within the tolerance or under the floor is not worse; over both is', () => {
  assert.equal(isFrameWorse(72, 65), false)
  assert.equal(isFrameWorse(77, 65), true)
  assert.equal(isFrameWorse(7, 5), false)
})

test('the gate blocks f0Ms and afterMs separately, only in the same mode', () => {
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }
  assert.deepEqual(frameGate({ now: [metric(68, 26)], base, mode: 'deadline' }), { status: 'compared', regressions: [] })
  const worse = frameGate({ now: [metric(80, 26)], base, mode: 'deadline' })
  assert.deepEqual(worse.regressions.map((entry) => entry.field), ['f0Ms'])
  assert.deepEqual(frameGate({ now: [metric(66, 33)], base, mode: 'deadline' }).regressions.map((entry) => entry.field), ['afterMs'])
})

test('a base in another mode, or without one, is not compared', () => {
  const now = [metric(200, 90)]
  assert.equal(isBaseComparable({ budgetMode: 'quota' }, 'deadline'), false)
  assert.equal(isBaseComparable({}, 'deadline'), false)
  assert.deepEqual(frameGate({ now, base: { budgetMode: 'quota', frameMetrics: [metric(65, 25)] }, mode: 'deadline' }), { status: 'other-mode', regressions: [] })
  assert.equal(frameGate({ now, base: { frameMetrics: [metric(65, 25)] }, mode: 'deadline' }).status, 'other-mode')
  assert.equal(frameGate({ now, base: undefined, mode: 'deadline' }).status, 'no-base')
})

test('a base without the field, or a run without frame parts, does not block', () => {
  assert.equal(frameGate({ now: [metric(200, 90)], base: { budgetMode: 'deadline' }, mode: 'deadline' }).status, 'base-without-metrics')
  assert.deepEqual(frameGate({ now: [], base: { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }, mode: 'deadline' }), { status: 'no-frame-parts', regressions: [] })
})

test('a kind the base does not have is not compared', () => {
  const base = { budgetMode: 'deadline', frameMetrics: [metric(65, 25)] }
  const crater = { ...metric(300, 90), kind: 'crater' }
  assert.deepEqual(frameGate({ now: [crater], base, mode: 'deadline' }).regressions, [])
})
