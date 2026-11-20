// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatSteps,
  needsBuild,
  sumSteps,
  timesRecord,
} from '../perf-gate-plan.mjs'

test('the base worktree builds unless it was built at the expected sha and its page is there', () => {
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: true }), false)
  // a cache hit on the first pass left an older commit built: the repetition must build
  assert.equal(needsBuild({ builtSha: 'old', expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: undefined, expectedSha: 'aaa', hasOutput: true }), true)
  assert.equal(needsBuild({ builtSha: 'aaa', expectedSha: 'aaa', hasOutput: false }), true)
})

test('steps of one name are summed and printed with a total', () => {
  const steps = [{ name: 'measure-branch', ms: 60000 }, { name: 'wait-quiet', ms: 30000 }, { name: 'wait-quiet', ms: 30000 }]
  assert.deepEqual(sumSteps(steps), [{ name: 'measure-branch', ms: 60000 }, { name: 'wait-quiet', ms: 60000 }])
  const lines = formatSteps(steps)
  assert.equal(lines.length, 3)
  assert.match(lines[1] ?? '', /wait-quiet\s+1\.0 min/)
  assert.match(lines[2] ?? '', /total\s+2\.0 min/)
})

test('the times.ndjson record', () => {
  const record = timesRecord({ at: 0, renderer: 'GPU', outcome: 'pass', steps: [{ name: 'probe', ms: 10 }, { name: 'probe', ms: 5 }] })
  assert.deepEqual(record, { at: '1970-01-01T00:00:00.000Z', renderer: 'GPU', outcome: 'pass', totalMs: 15, steps: { probe: 15 } })
})
