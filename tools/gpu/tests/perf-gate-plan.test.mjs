// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  againReportPath,
  DEFAULT_STEP_MS,
  estimateMs,
  fitsBudget,
  formatSteps,
  needsBuild,
  parseHistory,
  parseMaxMinutes,
  plannedSteps,
  PROBE_MAX_AGE_MS,
  probeUsable,
  QUIET_POLL_MS,
  repetitionSteps,
  shouldKeepWaiting,
  stepEstimateMs,
  sumSteps,
  timesRecord,
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

test('the renderer probe is reused when recent, from the same Chrome and not forced', () => {
  const entry = { renderer: 'NVIDIA', chromeVersion: 'Chrome 140', at: 1000 }
  const fresh = { entry, now: 1000 + 60000, chromeVersion: 'Chrome 140', force: false }
  assert.equal(probeUsable(fresh), true)
  assert.equal(probeUsable({ ...fresh, force: true }), false)
  assert.equal(probeUsable({ ...fresh, chromeVersion: 'Chrome 141' }), false)
  assert.equal(probeUsable({ ...fresh, chromeVersion: '' }), false)
  assert.equal(probeUsable({ ...fresh, now: 1000 + PROBE_MAX_AGE_MS }), false)
  assert.equal(probeUsable({ ...fresh, entry: undefined }), false)
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

test('the history is read back from times.ndjson, a damaged line skipped', () => {
  const record = timesRecord({ at: 0, renderer: 'GPU', outcome: 'pass', steps: [{ name: 'probe', ms: 15 }] })
  const history = parseHistory(`${JSON.stringify(record)}\nnot json\n\n${JSON.stringify({ steps: { probe: 20 } })}\n`)
  assert.deepEqual(history, [{ probe: 15 }, { probe: 20 }])
})

test('the estimate is the median of the last runs, the default for a step never seen', () => {
  assert.equal(stepEstimateMs([], 'measure-branch'), DEFAULT_STEP_MS['measure-branch'])
  assert.equal(stepEstimateMs([], 'unknown-step'), 0)
  assert.equal(stepEstimateMs([{ 'measure-branch': 100 }, { 'measure-branch': 300 }, { 'measure-branch': 200 }], 'measure-branch'), 200)
  assert.equal(estimateMs([{ a: 10, b: 5 }], ['a', 'b']), 15)
})

test('what a round plans before and after the first comparison', () => {
  assert.deepEqual(plannedSteps({ needsBaseRun: false, needsBaseBuild: false }), ['build-branch', 'measure-branch'])
  assert.deepEqual(plannedSteps({ needsBaseRun: true, needsBaseBuild: true }), ['build-branch', 'measure-branch', 'build-base', 'measure-base'])
  assert.deepEqual(repetitionSteps({ needsBaseBuild: true, hasSavedAgain: false }), ['measure-branch-again', 'build-base', 'measure-base-again'])
  assert.deepEqual(repetitionSteps({ needsBaseBuild: true, hasSavedAgain: true }), ['measure-branch-again'])
})

test('PERF_GATE_MAX_MIN: unset or invalid means no limit, a round that does not fit is refused', () => {
  assert.equal(parseMaxMinutes(undefined), undefined)
  assert.equal(parseMaxMinutes(''), undefined)
  assert.equal(parseMaxMinutes('abc'), undefined)
  assert.equal(parseMaxMinutes('-5'), undefined)
  assert.equal(parseMaxMinutes('30'), 30)
  assert.equal(fitsBudget({ budgetMs: undefined, elapsedMs: 1e9, remainingMs: 1e9 }), true)
  assert.equal(fitsBudget({ budgetMs: 100, elapsedMs: 40, remainingMs: 60 }), true)
  assert.equal(fitsBudget({ budgetMs: 100, elapsedMs: 40, remainingMs: 61 }), false)
})

