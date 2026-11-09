// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseSummaryLines, runSteps, summaryLine } from '../suite-runner.mjs'

/** @param {Record<string, number>} codes @returns {{ exec: (step: import('../suite-runner.mjs').Step) => number, ran: string[] }} */
const fake = (codes) => {
  /** @type {string[]} */
  const ran = []
  return { ran, exec: (step) => (ran.push(step.label), codes[step.label] ?? 0) }
}
const steps = ['a', 'b', 'c', 'd'].map((label) => ({ label, args: [] }))

test('keep-going runs every step, lists every failure and exits non-zero', () => {
  const { exec, ran } = fake({ b: 1, d: 3 })
  const result = runSteps({ steps, exec })
  assert.deepEqual(ran, ['a', 'b', 'c', 'd'])
  assert.deepEqual(result.failed.map((outcome) => [outcome.label, outcome.code]), [['b', 1], ['d', 3]])
  assert.equal(result.exitCode, 1)
})

test('all passing exits zero', () => {
  assert.equal(runSteps({ steps, exec: fake({}).exec }).exitCode, 0)
})

test('failFast stops at the first failure', () => {
  const { exec, ran } = fake({ b: 2 })
  const result = runSteps({ steps, exec, failFast: true })
  assert.deepEqual(ran, ['a', 'b'])
  assert.equal(result.exitCode, 2)
})

test('a fatal step stops the run, and a step that needs a failed one is skipped', () => {
  const fatal = fake({ a: 1 })
  assert.deepEqual(runSteps({ steps: [{ label: 'a', args: [], fatal: true }, ...steps.slice(1)], exec: fatal.exec }).outcomes.length, 1)
  const { exec, ran } = fake({ build: 1 })
  const result = runSteps({ steps: [{ label: 'build', args: [] }, { label: 'open', args: [], needs: 'build' }, { label: 'other', args: [] }], exec })
  assert.deepEqual(ran, ['build', 'other'])
  assert.equal(result.outcomes[1]?.status, 'skipped')
})

test('summary lines round-trip through the parser', () => {
  const outcomes = /** @type {import('../suite-runner.mjs').StepOutcome[]} */ ([
    { label: 'open test-room', status: 'failed', code: 1 },
    { label: 'open flora', status: 'ok', code: 0 },
  ])
  const parsed = parseSummaryLines(`noise\n${outcomes.map(summaryLine).join('\n')}\n`)
  assert.deepEqual(parsed, [{ label: 'open test-room', result: 'FAILED (exit 1)' }, { label: 'open flora', result: 'ok' }])
})
