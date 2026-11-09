// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judgePushes, parseProcesses } from '../push-guard.mjs'

/** @param {number} pid @param {number} ppid @param {number} etimes @param {string} args @returns {import('../push-guard.mjs').Proc} */
const proc = (pid, ppid, etimes, args) => ({ pid, ppid, etimes, args })
const judge = (/** @type {import('../push-guard.mjs').Proc[]} */ procs, gpuLockFree = false) => judgePushes({ procs, staleMinutes: 90, gpuLockFree })

test('parses ps output', () => {
  const parsed = parseProcesses('  10     1   300 git push -u origin x\n 11 10 5 sh .githooks/pre-push\n')
  assert.deepEqual(parsed[0], { pid: 10, ppid: 1, etimes: 300, args: 'git push -u origin x' })
  assert.equal(parsed.length, 2)
})

test('a young push using the GPU blocks', () => {
  const { blocking } = judge([proc(10, 1, 600, 'git push origin x'), proc(11, 10, 590, 'flock /c/gpu.lock node run.mjs'), proc(12, 11, 580, 'node run.mjs')])
  assert.deepEqual(blocking.map((push) => push.pid), [10])
})

test('a stale push is ignored', () => {
  const { blocking, ignored } = judge([proc(10, 1, 91 * 60, 'git push origin x')])
  assert.equal(blocking.length, 0)
  assert.match(ignored[0]?.reason ?? '', /^stale/)
})

test('a push only waiting on a lock is ignored, but one holding it is not', () => {
  const waiting = [proc(10, 1, 60, 'git push'), proc(11, 10, 60, 'sh .githooks/pre-push'), proc(12, 11, 60, '/usr/bin/flock /c/cpu.lock sh -c echo')]
  assert.equal(judge(waiting).blocking.length, 0)
  assert.equal(judge(waiting).ignored[0]?.reason, 'only waiting on a lock')
  const holding = [...waiting, proc(13, 12, 5, 'node tools/pre-push/checks.mjs')]
  assert.equal(judge(holding).blocking.length, 1)
})

test('a push is ignored when nobody holds gpu.lock', () => {
  const { blocking, ignored } = judge([proc(10, 1, 60, 'git push')], true)
  assert.equal(blocking.length, 0)
  assert.match(ignored[0]?.reason ?? '', /gpu\.lock/)
})

test('wrappers and look-alikes are not pushes', () => {
  const procs = [proc(1, 0, 9000, 'timeout 1500 git push origin x'), proc(2, 0, 10, 'pgrep -f git push'), proc(3, 0, 10, 'git status'), proc(4, 0, 10, 'zsh -c git push')]
  const { blocking, ignored } = judge(procs)
  assert.equal(blocking.length + ignored.length, 0)
})
