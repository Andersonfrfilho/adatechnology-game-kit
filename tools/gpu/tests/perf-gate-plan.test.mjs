// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { needsBuild } from '../perf-gate-plan.mjs'

test('the base worktree builds unless it was built at the expected sha and its page is there', () => {
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: true }), false)
  // a cache hit on the first pass left an older commit built: the repetition must build
  assert.equal(needsBuild({ builtSha: 'old', expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: undefined, expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: false }), true)
})
