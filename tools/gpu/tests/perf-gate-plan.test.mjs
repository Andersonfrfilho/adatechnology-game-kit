// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildSequence,
  describeRound,
  formatSteps,
  needsBuild,
  sumSteps,
  timesRecord,
} from '../perf-gate-plan.mjs'

test('the base worktree builds unless marker, commit, tree and page all agree', () => {
  const ready = { builtSha: 'aaa', expectedSha: 'aaa', headSha: 'aaa', isClean: true, hasOutput: true }
  assert.equal(needsBuild(ready), false)
  // a cache hit on the first pass left an older commit built: the repetition must build
  assert.equal(needsBuild({ ...ready, builtSha: 'old' }), true)
  assert.equal(needsBuild({ ...ready, builtSha: undefined }), true)
  // another session or the nightly moved the worktree after the marker was written
  assert.equal(needsBuild({ ...ready, headSha: 'bbb' }), true)
  assert.equal(needsBuild({ ...ready, isClean: false }), true)
  assert.equal(needsBuild({ ...ready, hasOutput: false }), true)
})

/** @param {string[]} log @param {string} [failAt] */
const stepsThat = (log, failAt) =>
  Object.fromEntries(
    ['clearMarker', 'checkout', 'install', 'build', 'buildRoom', 'writeMarker'].map((name) => [
      name,
      () => {
        log.push(name)
        if (name === failAt) throw new Error(`${name} failed`)
      },
    ]),
  )

test('the marker is cleared first and written last', () => {
  const log = /** @type {string[]} */ ([])
  buildSequence(/** @type {Parameters<typeof buildSequence>[0]} */ (stepsThat(log)))
  assert.deepEqual(log, ['clearMarker', 'checkout', 'install', 'build', 'buildRoom', 'writeMarker'])
})

test('a step that fails leaves no marker', () => {
  for (const failAt of ['checkout', 'install', 'build', 'buildRoom']) {
    const log = /** @type {string[]} */ ([])
    assert.throws(() => buildSequence(/** @type {Parameters<typeof buildSequence>[0]} */ (stepsThat(log, failAt))), new RegExp(`${failAt} failed`))
    assert.equal(log[0], 'clearMarker')
    assert.equal(log.includes('writeMarker'), false)
  }
})

test('the round estimate grows with the runs it needs and warns about the waits', () => {
  const minutesOf = (/** @type {string} */ text) => Number(/about (\d+) min/.exec(text)?.[1])
  const cached = describeRound({ needsBaseRun: false, needsBaseBuild: false })
  const cold = describeRound({ needsBaseRun: true, needsBaseBuild: true })
  assert.ok(minutesOf(cold) > minutesOf(cached))
  assert.match(cached, /if a metric needs the repetition/)
  assert.match(cached, /waiting for a quiet machine/)
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
