// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  againReportPath,
  needsBuild,
  QUIET_POLL_MS,
  shouldKeepWaiting,
  WAIT_FOR_QUIET_MS,
} from '../perf-gate-plan.mjs'

test('the base worktree builds unless it was built at the expected sha and its page is there', () => {
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: true }), false)
  // a cache hit on the first pass left an older commit built: the repetition must build
  assert.equal(needsBuild({ builtSha: 'old', expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: undefined, expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: false }), true)
})

test('the second run of main is kept under the key of the first', () => {
  assert.equal(againReportPath('/c/abc-1-2.json'), '/c/abc-1-2-again.json')
})

test('waiting for a quiet machine: same threshold, same deadline, a poll every 5 s', () => {
  assert.equal(QUIET_POLL_MS, 5000)
  assert.equal(WAIT_FOR_QUIET_MS, 600000)
  assert.equal(shouldKeepWaiting({ load: 4, now: 0, until: 10 }), true)
  assert.equal(shouldKeepWaiting({ load: 3.9, now: 0, until: 10 }), false)
  assert.equal(shouldKeepWaiting({ load: 8, now: 10, until: 10 }), false)
})
