// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lockDecision, MEASURE_LOCKED_ENV, QUIET_LOAD, QUIET_POLL_MS, waitForQuietMachine } from '../measure-lock.mjs'

test('a measure takes the lock, unless the caller holds it or there is no flock', () => {
  assert.equal(lockDecision({ env: {}, hasFlock: true }), 'reexec')
  assert.equal(lockDecision({ env: { [MEASURE_LOCKED_ENV]: '1' }, hasFlock: true }), 'run')
  assert.equal(lockDecision({ env: {}, hasFlock: false }), 'run')
})

/** @param {number[]} loads a load per read, the last one repeating */
const clockWith = (loads) => {
  let at = 0
  let time = 0
  /** @type {string[]} */
  const lines = []
  return {
    lines,
    load: () => loads[Math.min(at, loads.length - 1)] ?? 0,
    now: () => time,
    sleep: async (/** @type {number} */ ms) => {
      time += ms
      at += 1
    },
    log: (/** @type {string} */ line) => lines.push(line),
  }
}

test('a quiet machine starts at once and records its load', async () => {
  const clock = clockWith([1.5])
  assert.deepEqual(await waitForQuietMachine({ label: 'perf', ...clock }), { loadAtStart: 1.5, busy: false })
  assert.deepEqual(clock.lines, [])
})

test('a busy machine is waited for until the load falls', async () => {
  const clock = clockWith([9, 9, 6, 3])
  const answer = await waitForQuietMachine({ label: 'perf', ...clock })
  assert.deepEqual(answer, { loadAtStart: 9, busy: false })
  assert.equal(clock.lines.length, 3)
  assert.match(clock.lines[0] ?? '', new RegExp(`under ${QUIET_LOAD} wanted`))
})

test('a machine that never calms down is measured after the longest wait, with the warning', async () => {
  const clock = clockWith([12])
  const answer = await waitForQuietMachine({ label: 'perf', ...clock, maxMs: QUIET_POLL_MS * 2 })
  assert.deepEqual(answer, { loadAtStart: 12, busy: true })
  assert.match(clock.lines.at(-1) ?? '', /still busy/)
  assert.equal(clock.now(), QUIET_POLL_MS * 2)
})
