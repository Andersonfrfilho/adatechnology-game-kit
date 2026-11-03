// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bestOf, compare, failuresOf, worstOf } from '../compare.mjs'

/** @param {Partial<import('../compare.mjs').Phase>} values @returns {import('../compare.mjs').Phase} */
const phase = (values) => ({ name: 'idle', p99: 8, max: 12, worstLongTask: 0, hitches: 0, drawsPerFrame: 113, buffers: 0, programs: 0, ...values })
/** @param {import('../compare.mjs').Phase[]} phases @param {Record<string, import('../compare.mjs').HordeMetrics>} [horde] @returns {import('../compare.mjs').Report} */
const report = (phases, horde = {}) => ({ gpu: 'RTX', phases, horde: { metrics: horde }, failures: [] })

test('a phase within 10% of main passes, over 10% and over the floor blocks', () => {
  const base = report([phase({ name: 'chain_horde', p99: 30, max: 100 })])
  assert.deepEqual(compare(base, report([phase({ name: 'chain_horde', p99: 32.9, max: 109 })]), 0.1), [])
  assert.deepEqual(compare(base, report([phase({ name: 'chain_horde', p99: 34, max: 100 })]), 0.1), [{ phase: 'chain_horde', metric: 'p99', base: 30, branch: 34 }])
})

test('a small number does not block on noise under the floor (one more draw on 4 is 25%)', () => {
  const base = report([phase({ drawsPerFrame: 4, hitches: 0, max: 8 })])
  assert.deepEqual(compare(base, report([phase({ drawsPerFrame: 6, hitches: 1, max: 30 })]), 0.1), [])
  assert.deepEqual(compare(base, report([phase({ drawsPerFrame: 9, hitches: 3 })]), 0.1).map((r) => r.metric), ['hitches', 'drawsPerFrame'])
})

test('better than main never blocks, and a phase only the branch has is not compared', () => {
  const base = report([phase({ name: 'after_storm', drawsPerFrame: 555 })])
  assert.deepEqual(compare(base, report([phase({ name: 'after_storm', drawsPerFrame: 150 }), phase({ name: 'new_phase', p99: 99 })]), 0.1), [])
})

test('the horde metrics are compared by phase id', () => {
  const base = report([], { dense_horde: { crowd_ms_p99: 3, draw_calls: 100 } })
  assert.deepEqual(compare(base, report([], { dense_horde: { crowd_ms_p99: 4, draw_calls: 105 } }), 0.1), [{ phase: 'dense_horde', metric: 'crowd_ms_p99', base: 3, branch: 4 }])
})

test('two runs of one build keep the lower value of every metric', () => {
  const joined = bestOf(report([phase({ p99: 9, max: 80 })], { chain_horde: { crowd_ms_p99: 2 } }), report([phase({ p99: 12, max: 40 })], { chain_horde: { crowd_ms_p99: 1.5 } }))
  assert.equal(joined.phases[0]?.p99, 9)
  assert.equal(joined.phases[0]?.max, 40)
  assert.equal(joined.horde.metrics.chain_horde?.crowd_ms_p99, 1.5)
})

test('a report from before the kinds reads its failures as targets', () => {
  assert.deepEqual(failuresOf(['idle: p99 30 ms', { text: 'page errors', kind: 'hard' }]), [{ text: 'idle: p99 30 ms', kind: 'target' }, { text: 'page errors', kind: 'hard' }])
})

test('a frame time under one 60 Hz refresh is read as the refresh: a window held to the display is not a slower build', () => {
  const base = report([phase({ name: 'cold_dynamite', p99: 9.5, max: 14 })])
  assert.deepEqual(compare(base, report([phase({ name: 'cold_dynamite', p99: 17.6, max: 17.9 })]), 0.1), [])
  assert.deepEqual(compare(base, report([phase({ name: 'cold_dynamite', p99: 23.3 })]), 0.1).map((r) => r.metric), ['p99'])
})

test('the buffers made in play are not compared (batching again trades them once for draws every frame)', () => {
  assert.deepEqual(compare(report([phase({ buffers: 878 })]), report([phase({ buffers: 1094 })]), 0.1), [])
})

test('the worse of two runs keeps the higher value of every metric', () => {
  const joined = worstOf(report([phase({ p99: 9, max: 80 })]), report([phase({ p99: 12, max: 40 })]))
  assert.equal(joined.phases[0]?.p99, 12)
  assert.equal(joined.phases[0]?.max, 80)
})
