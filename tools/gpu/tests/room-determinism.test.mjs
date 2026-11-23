// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { firstDivergence, judgeRuns, parseRuns, readNonNegativeNumber } from '../room-determinism.mjs'

/** @param {number} frame @param {number} stateHash @param {Record<string, number>} objects @param {Record<string, any>} [extra] */
const row = (frame, stateHash, objects, extra = {}) => ({ frame, time: 10, stateHash, timeHash: 1, rngHash: 2, counterHash: 3, eventCount: 3, eventHash: 7, objectCount: Object.keys(objects).length, objects, kinds: {}, ...extra })

const goodRows = () => [row(-1, 1, { a: 1 }, { eventCount: 0 }), row(0, 2, { a: 2 })]
/** @param {number} run @param {Partial<{ rows: any[], errors: string[], droppedFrames: number }>} [overrides] */
const goodRun = (run, overrides = {}) => ({ run, rows: goodRows(), errors: [], droppedFrames: 4, ...overrides })
const options = { isStubbed: true, expectedPreTime: 10 }

test('two runs with the same hash at every tick have no divergence', () => {
  const run = [row(-1, 1, { a: 1 }), row(0, 2, { a: 2 })]
  assert.equal(firstDivergence(run, structuredClone(run)), undefined)
})

test('the first tick whose hash differs is reported, with the objects that differ', () => {
  const left = [row(-1, 1, { a: 1, b: 1 }), row(0, 2, { a: 2, b: 1 }), row(1, 3, { a: 3, b: 1 })]
  const right = [row(-1, 1, { a: 1, b: 1 }), row(0, 2, { a: 2, b: 1 }), row(1, 9, { a: 3, b: 5 })]
  const found = firstDivergence(left, right)
  assert.equal(found?.frame, 1)
  assert.deepEqual(found?.differingObjects, ['b'])
})

test('a difference before the explosion (tick -1) is found there, not later', () => {
  const left = [row(-1, 1, { house: 1 }), row(0, 2, { house: 2 })]
  const right = [row(-1, 8, { house: 4 }), row(0, 9, { house: 5 })]
  assert.equal(firstDivergence(left, right)?.frame, -1)
})

test('a difference only in rng, time or counter is visible', () => {
  const left = [row(0, 1, { a: 1 })]
  assert.deepEqual(firstDivergence(left, [row(0, 1, { a: 1 }, { rngHash: 9 })])?.differingFields, ['rngHash'])
  assert.deepEqual(firstDivergence(left, [row(0, 1, { a: 1 }, { timeHash: 9 })])?.differingFields, ['timeHash'])
  assert.deepEqual(firstDivergence(left, [row(0, 1, { a: 1 }, { counterHash: 9 })])?.differingFields, ['counterHash'])
})

test('runs with a different number of rows diverge', () => {
  const left = [row(-1, 1, { a: 1 }), row(0, 2, { a: 2 })]
  assert.deepEqual(firstDivergence(left, left.slice(0, 1))?.differingFields, ['rowCount'])
})

test('fewer than 2 runs, or NaN, is refused', () => {
  assert.throws(() => parseRuns('1'))
  assert.throws(() => parseRuns('abc'))
  assert.equal(parseRuns('3'), 3)
  const verdict = judgeRuns({ results: [goodRun(0)], ...options })
  assert.equal(verdict.isDeterministic, false)
  assert.match(verdict.problems.join(), /at least 2/)
})

test('a run where the blast changed nothing is refused', () => {
  // the time moves every tick, so the whole-state hash differs even when no object did
  const noOp = goodRun(1, { rows: [row(-1, 1, { a: 1 }), row(0, 5, { a: 1 }, { time: 11.5 })] })
  const verdict = judgeRuns({ results: [goodRun(0), noOp], ...options })
  assert.equal(verdict.isDeterministic, false)
  assert.match(verdict.problems.join(), /no-op/)
})

test('no event, a wrong settle time or no dropped loop callback is refused', () => {
  const quiet = goodRun(0, { rows: [row(-1, 1, { a: 1 }, { eventCount: 0 }), row(0, 2, { a: 2 }, { eventCount: 0 })] })
  assert.match(judgeRuns({ results: [quiet, goodRun(1)], ...options }).problems.join(), /no event/)
  const late = goodRun(1, { rows: [row(-1, 1, { a: 1 }, { time: 11 }), row(0, 2, { a: 2 })] })
  assert.match(judgeRuns({ results: [goodRun(0), late], ...options }).problems.join(), /pre-blast time/)
  assert.match(judgeRuns({ results: [goodRun(0), goodRun(1, { droppedFrames: 0 })], ...options }).problems.join(), /requestAnimationFrame/)
})

test('page errors fail the verdict', () => {
  const verdict = judgeRuns({ results: [goodRun(0), goodRun(1, { errors: ['boom'] })], ...options })
  assert.equal(verdict.isDeterministic, false)
  assert.match(verdict.problems.join(), /boom/)
})

test('a real divergence fails and a clean pair passes', () => {
  const diverging = goodRun(1, { rows: [row(-1, 1, { a: 1 }, { eventCount: 0 }), row(0, 5, { a: 5 })] })
  const failed = judgeRuns({ results: [goodRun(0), diverging], ...options })
  assert.equal(failed.isDeterministic, false)
  assert.equal(failed.verdicts[0]?.divergence?.frame, 0)
  const passed = judgeRuns({ results: [goodRun(0), goodRun(1), goodRun(2)], ...options })
  assert.equal(passed.isDeterministic, true)
  assert.deepEqual(passed.problems, [])
})

test('the old page-loop path skips the settle-time and dropped-callback checks', () => {
  const late = goodRun(0, { rows: [row(-1, 1, { a: 1 }, { time: 7.3 }), row(0, 2, { a: 2 })], droppedFrames: 0 })
  assert.equal(judgeRuns({ results: [late, { ...late, run: 1 }], isStubbed: false, expectedPreTime: 10 }).isDeterministic, true)
})

test('a non-numeric or negative setting is refused', () => {
  assert.throws(() => readNonNegativeNumber('ROOM_DET_FRAMES', 'abc', 90))
  assert.throws(() => readNonNegativeNumber('ROOM_DET_FRAMES', '-1', 90))
  assert.equal(readNonNegativeNumber('ROOM_DET_FRAMES', undefined, 90), 90)
})
