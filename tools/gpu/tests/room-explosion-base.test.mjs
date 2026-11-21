// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mergeBase as mergeBaseOrNothing, saveBase } from '../room-explosion-base.mjs'
import { frameGate, isFrameWorse } from '../room-explosion-frame.mjs'

/** The merge of a report that always gives one (c4 or no explosive). @template {import('../room-explosion-base.mjs').BaseReport} TReport @param {import('../room-explosion-base.mjs').BaseReport | undefined} base @param {TReport} report @returns {TReport} */
const mergeBase = (base, report) => {
  const merged = mergeBaseOrNothing(base, report)
  assert.ok(merged)
  return merged
}

const VARIANT = 'jolt-d4-worker'
const metric = (/** @type {number} */ f0Ms, /** @type {number} */ afterMs, kind = 'blast') => ({ variant: VARIANT, throttle: 1, kind, f0Ms, afterMs })
const cell = (/** @type {number} */ p99, /** @type {number} */ max, kind = 'blast') => ({ variant: VARIANT, throttle: 1, kind, p99, max })
const night = (/** @type {number} */ f0Ms, mode = 'deadline') => ({ budgetMode: mode, cells: [cell(5, 20)], frameMetrics: [metric(f0Ms, 25)] })
const blocks = (/** @type {number} */ f0Ms, /** @type {ReturnType<typeof night>} */ base) => frameGate({ measure: { metrics: [metric(f0Ms, 25)], problems: [] }, base, mode: 'deadline', variant: VARIANT, gated: new Set([1]) }).regressions.length > 0

test('the base only improves: a worse night leaves it where it was, a better one lowers it', () => {
  const worse = mergeBase(night(65), night(68))
  assert.equal(worse.frameMetrics?.[0]?.f0Ms, 65)
  assert.equal(mergeBase(night(65), night(60)).frameMetrics?.[0]?.f0Ms, 60)
  const cells = mergeBase({ budgetMode: 'deadline', cells: [cell(5, 20)] }, { budgetMode: 'deadline', cells: [cell(7, 15)] }).cells?.[0]
  assert.deepEqual([cells?.p99, cells?.max], [5, 15])
})

test('a new key enters, a key only the base has stays, and a 0 never lowers the base', () => {
  const merged = mergeBase({ budgetMode: 'deadline', frameMetrics: [metric(65, 25), metric(70, 25, 'hammer')] }, { budgetMode: 'deadline', frameMetrics: [metric(0, 0), metric(80, 30, 'crater')] })
  assert.deepEqual(merged.frameMetrics?.map((entry) => [entry.kind, entry.f0Ms]), [['blast', 65], ['hammer', 70], ['crater', 80]])
})

test('no base, or a base in another mode, makes the night the base', () => {
  assert.deepEqual(mergeBase(undefined, night(68)), night(68))
  assert.deepEqual(mergeBase(night(65, 'quota'), night(68)), night(68))
})

test('a drift of 3 ms a night: the sliding base never blocks, the best-of base blocks once the drift passes the tolerance', () => {
  const nights = [65, 68, 71, 74, 77]
  let sliding = night(nights[0] ?? 0)
  let best = night(nights[0] ?? 0)
  let slidingBlocked = false
  /** @type {number | undefined} */
  let blockedOn
  for (const value of nights.slice(1)) {
    slidingBlocked ||= blocks(value, sliding)
    sliding = night(value)
    if (blockedOn === undefined && blocks(value, best)) blockedOn = value
    if (blockedOn === undefined) best = mergeBase(best, night(value))
  }
  assert.equal(slidingBlocked, false)
  assert.equal(blockedOn, 77)
})

test('with the floor alone (tolerance 3%), 65, 68, 71 blocks on the third night', () => {
  const rule = { tolerance: 0.03, floorMs: 3 }
  let base = night(65)
  assert.equal(isFrameWorse(68, 65, rule), false)
  base = mergeBase(base, night(68))
  assert.equal(base.frameMetrics?.[0]?.f0Ms, 65)
  assert.equal(isFrameWorse(71, base.frameMetrics?.[0]?.f0Ms ?? 0, rule), true)
})

test('a report with another explosive than c4 never becomes the base nor enters it', () => {
  const dynamite = { ...night(10), explosive: 'dynamite' }
  assert.equal(mergeBaseOrNothing(undefined, dynamite), undefined)
  const base = night(65)
  assert.equal(mergeBaseOrNothing(base, dynamite), base)
  assert.deepEqual(mergeBase(base, { ...night(60), explosive: 'c4' }).frameMetrics?.[0]?.f0Ms, 60)
  assert.deepEqual(mergeBase({ ...night(65), explosive: 'dynamite' }, night(68)), night(68))
})

test('saveBase: a non-c4 night leaves the base file as it was, and writes nothing when there is none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'room-explosion-base-'))
  const report = join(dir, 'report.json')
  const baseFile = join(dir, 'base.json')
  writeFileSync(report, JSON.stringify({ ...night(10), explosive: 'dynamite' }))
  saveBase(report, baseFile)
  assert.equal(existsSync(baseFile), false)
  writeFileSync(baseFile, JSON.stringify(night(65)))
  saveBase(report, baseFile)
  assert.deepEqual(JSON.parse(readFileSync(baseFile, 'utf8')), night(65))
  writeFileSync(report, JSON.stringify(night(60)))
  saveBase(report, baseFile)
  assert.equal(JSON.parse(readFileSync(baseFile, 'utf8')).frameMetrics[0].f0Ms, 60)
})

test('the merged base does not carry the last night\'s pageSha256', () => {
  const merged = mergeBase(night(65), { ...night(60), pageSha256: 'abc123' })
  assert.equal('pageSha256' in merged, false)
})
