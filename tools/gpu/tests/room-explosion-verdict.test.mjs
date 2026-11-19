// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cellRegressed, DEFAULT_VARIANT, VARIANTS } from '../room-explosion.mjs'

test('no base report: nothing is a regression, however far over the 5 ms goal', () => {
  assert.equal(cellRegressed({ p99: 53, max: 71 }, undefined), false)
})

test('over the goal but as good as main is not a regression (the nightly used to fail here every day)', () => {
  assert.equal(cellRegressed({ p99: 53.4, max: 71.4 }, { p99: 55.4, max: 71.2 }), false)
})

test('worse than main by over 25% and over the floor blocks, each metric on its own', () => {
  assert.equal(cellRegressed({ p99: 70, max: 71 }, { p99: 53, max: 71 }), true)
  assert.equal(cellRegressed({ p99: 53, max: 95 }, { p99: 53, max: 71 }), true)
})

test('a small cell moving under the floor is noise', () => {
  assert.equal(cellRegressed({ p99: 1.9, max: 7 }, { p99: 1.2, max: 3 }), false)
})

test('the default and gated variant is the page default: jolt-d4-worker, paced (groundWorker=1)', () => {
  assert.equal(DEFAULT_VARIANT, 'jolt-d4-worker')
  assert.ok(VARIANTS[DEFAULT_VARIANT].includes('groundWorker=1'))
  assert.ok('jolt-d4' in VARIANTS)
})
