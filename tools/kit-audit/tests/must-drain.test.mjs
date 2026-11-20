import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('positive: a literal that does not name its queue cannot be allowed', () => {
  assert.deepEqual(scan(OWNER, 'const options = { mustDrain: true }'), [1])
})

test('positive: examples, apps and .tsx files are read too', () => {
  const text = "defer(q, { id: 'x.y', mustDrain: true })"
  assert.deepEqual(scan('examples/test-room/src/room.ts', text), [1])
  assert.deepEqual(scan('apps/desktop/src/main.tsx', text), [1])
  assert.deepEqual(scan('packages/game-ui/src/panel.tsx', text), [1])
})

test('negative: the allowed queue in its own package is fine, in another package it is not', () => {
  assert.deepEqual(scan(OWNER, '{ queue: this.eventQueue, options: { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS], mustDrain: true } }'), [])
  assert.deepEqual(scan(OWNER, "host.defer(q, { id: 'destruction.events', mustDrain: true })"), [])
  assert.deepEqual(scan('packages/game-audio/src/x.ts', 'DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS, mustDrain: true'), [1])
})

test('exact match: a longer constant or a string with the allowed one inside is not the allowed queue', () => {
  assert.deepEqual(scan(OWNER, '{ DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS_EXTRA, mustDrain: true }'), [1])
  assert.deepEqual(scan(OWNER, "{ id: 'destruction.events.extra', mustDrain: true }"), [1])
  assert.deepEqual(scan(OWNER, "{ id: 'xdestruction.events', mustDrain: true }"), [1])
})

test('the object around decides, also when the pair is on another line', () => {
  assert.deepEqual(scan(OWNER, '{\n  ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS],\n  mustDrain: true,\n}'), [])
  assert.deepEqual(scan(OWNER, '[{ id: DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS }, { id: DEFERRED_QUEUE_ID.BREACH_PAINT, mustDrain: true }]'), [1])
})

test('any value that is not the literal false is flagged: variable, ternary, shorthand, quoted and computed keys, value on the next line', () => {
  assert.deepEqual(scan(OWNER, 'opts = { mustDrain: flag }'), [1])
  assert.deepEqual(scan(OWNER, 'opts = { mustDrain: isBlast ? true : false }'), [1])
  assert.deepEqual(scan(OWNER, 'opts = { priority: 1, mustDrain }'), [1])
  assert.deepEqual(scan(OWNER, "opts = { 'mustDrain': true }"), [1])
  assert.deepEqual(scan(OWNER, 'opts = { "mustDrain": value }'), [1])
  assert.deepEqual(scan(OWNER, "opts = { ['mustDrain']: value }"), [1])
  assert.deepEqual(scan(OWNER, 'opts = {\n  mustDrain:\n    compute(),\n}'), [2])
  assert.deepEqual(scan(OWNER, 'opts = {\n  mustDrain:\n    true,\n}'), [2])
  assert.deepEqual(scan(OWNER, 'options.mustDrain = enabled'), [1])
})

test('negative: false, the type, the plumbing of game-runtime and a property read are fine', () => {
  assert.deepEqual(scan(OWNER, 'opts = { mustDrain: false }\nreadonly mustDrain?: boolean\nreadonly mustDrain: boolean'), [])
  assert.deepEqual(scan('packages/game-runtime/src/budget-entry.ts', 'mustDrain: options.mustDrain === true,'), [])
  assert.deepEqual(scan(OWNER, 'if (entry.mustDrain) drain()\nconst a = entry.mustDrain === true'), [])
})

test('negative: comments never match, a block comment of many lines included', () => {
  assert.deepEqual(scan(OWNER, '// registered with mustDrain: true\n/** `mustDrain: true` drains whole */\nconst x = 1 // mustDrain: true'), [])
  assert.deepEqual(scan(OWNER, '/*\n * the queue has\n * mustDrain: true\n * and more\n */\nconst x = 1'), [])
  assert.deepEqual(scan(OWNER, '/* a */ const y = { mustDrain: true } /* b */'), [1])
})

test('positive: mustDrainIds outside game-runtime is a violation, in game-runtime it is the mechanism', () => {
  assert.deepEqual(scan(OWNER, "createFrameBudget({ mustDrainIds: new Set(['fluids.film']) })"), [1])
  assert.deepEqual(scan('examples/test-room/src/room.ts', 'const a = 1\ncreateScheduler({ mustDrainIds })'), [2])
  assert.deepEqual(scan('packages/game-runtime/src/scheduler.ts', 'mustDrainIds: options.mustDrainIds'), [])
  assert.deepEqual(scan(OWNER, '// mustDrainIds is documented here'), [])
})

test('the runtime list MUST_DRAIN_QUEUE_IDS and must-drain-allowed.json name the same queues', () => {
  // read as text: the audit tests must not depend on the Node version stripping types
  const frame = readFileSync(new URL('../../../packages/game-contracts/src/frame.ts', import.meta.url), 'utf8')
  const ids = Object.fromEntries([...frame.matchAll(/^\s+([A-Z_]+): '([\w.-]+)',$/gm)].map((match) => [match[1], match[2]]))
  const listed = /MUST_DRAIN_QUEUE_IDS[^=]*=\s*new Set\(\[([^\]]*)\]\)/.exec(frame)
  assert.ok(listed, 'MUST_DRAIN_QUEUE_IDS not found in frame.ts')
  const runtime = [...listed[1].matchAll(/DEFERRED_QUEUE_ID\.([A-Z_]+)/g)].map((match) => ids[match[1]])
  /** @type {{ allowed: { queue: string, constant: string }[] }} */
  const { allowed } = JSON.parse(readFileSync(new URL('../must-drain-allowed.json', import.meta.url), 'utf8'))
  assert.ok(runtime.length > 0 && runtime.every(Boolean))
  assert.deepEqual([...runtime].sort(), allowed.map((entry) => entry.queue).sort())
  for (const entry of allowed) assert.equal(ids[entry.constant], entry.queue)
})

test('the message cites section 15', () => {
  assert.match(mustDrainMessage({ file: 'packages/a/src/b.ts', line: 3, code: '', reason: 'r' }), /§15/)
})

test('the repository today has no mustDrain queue outside the allowlist', () => {
  assert.deepEqual(mustDrainViolations(), [])
})
