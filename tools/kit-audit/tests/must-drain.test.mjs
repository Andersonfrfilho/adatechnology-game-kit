import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mustDrainMessage, mustDrainViolations, scanMustDrain } from '../must-drain.mjs'

const ALLOWED = [{ queue: 'destruction.events', constant: 'DESTRUCTION_EVENTS', package: 'game-destruction-three', reason: 'test' }]
const scan = (/** @type {string} */ path, /** @type {string} */ text) => scanMustDrain(path, text, ALLOWED).map((hit) => hit.line)
const OWNER = 'packages/game-destruction-three/src/renderer.ts'

test('positive: a new queue with mustDrain: true is a violation, by constant or by string', () => {
  assert.deepEqual(scan(OWNER, '{ queue: q, options: { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT], mustDrain: true } }'), [1])
  assert.deepEqual(scan(OWNER, "host.defer(queue, { id: 'fluids.film', mustDrain: true })"), [1])
  assert.deepEqual(scan('packages/game-audio/src/voices.ts', 'a\nb\nregister({ priority: 1, mustDrain: true })'), [3])
})

test('positive: a line that does not say which queue it is cannot be allowed', () => {
  assert.deepEqual(scan(OWNER, 'const options = { mustDrain: true }'), [1])
})

test('negative: the allowed queue in its own package is fine, in another package it is not', () => {
  assert.deepEqual(scan(OWNER, '{ queue: this.eventQueue, options: { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS], mustDrain: true } }'), [])
  assert.deepEqual(scan(OWNER, "host.defer(q, { id: 'destruction.events', mustDrain: true })"), [])
  assert.deepEqual(scan('packages/game-audio/src/x.ts', 'DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS, mustDrain: true'), [1])
})

test('negative: the option read, the type, comments and false are not registrations', () => {
  assert.deepEqual(scan(OWNER, 'mustDrain: options.mustDrain === true,\nreadonly mustDrain?: boolean\nmustDrain: false'), [])
  assert.deepEqual(scan(OWNER, '// registered with mustDrain: true\n/** `mustDrain: true` drains whole */\nconst x = 1 // mustDrain: true'), [])
})

test('the message cites section 15', () => {
  assert.match(mustDrainMessage({ file: 'packages/a/src/b.ts', line: 3 }), /§15/)
})

test('the repository today has no mustDrain queue outside the allowlist', () => {
  assert.deepEqual(mustDrainViolations(), [])
})
