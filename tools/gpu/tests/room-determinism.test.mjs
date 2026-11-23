// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { firstDivergence } from '../room-determinism.mjs'

/** @param {number} frame @param {number} stateHash @param {Record<string, number>} objects */
const row = (frame, stateHash, objects) => ({ frame, stateHash, eventCount: 3, eventHash: 7, objectCount: Object.keys(objects).length, objects, kinds: {} })

test('two runs with the same hash at every tick have no divergence', () => {
  const run = [row(-1, 1, { a: 1 }), row(0, 2, { a: 2 })]
  assert.equal(firstDivergence(run, structuredClone(run)), undefined)
})

test('the first tick whose hash differs is reported, with the objects that differ', () => {
  const left = [row(-1, 1, { a: 1, b: 1 }), row(0, 2, { a: 2, b: 1 }), row(1, 3, { a: 3, b: 1 })]
  const right = [row(-1, 1, { a: 1, b: 1 }), row(0, 2, { a: 2, b: 1 }), row(1, 9, { a: 3, b: 5 })]
  const found = firstDivergence(left, right)
  assert.equal(found?.frame, 1)
  assert.deepEqual(found?.differingObjects, ['b'])
})

test('a difference before the explosion (tick -1) is found there, not later', () => {
  const left = [row(-1, 1, { house: 1 }), row(0, 2, { house: 2 })]
  const right = [row(-1, 8, { house: 4 }), row(0, 9, { house: 5 })]
  assert.equal(firstDivergence(left, right)?.frame, -1)
})
