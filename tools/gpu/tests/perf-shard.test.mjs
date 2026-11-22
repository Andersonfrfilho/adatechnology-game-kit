// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BURST_SHARD, LEGACY_BURST_SHARD, shardOf } from '../perf-shard.mjs'

test('unset or empty runs everything, and a share keeps its slice', () => {
  assert.deepEqual(shardOf(undefined), { shard: 'all', slice: undefined, warning: undefined })
  assert.deepEqual(shardOf(''), { shard: 'all', slice: undefined, warning: undefined })
  assert.deepEqual(shardOf('cold:2/3'), { shard: 'cold', slice: '2/3', warning: undefined })
  for (const shard of ['cold', 'warm', 'horde', BURST_SHARD]) assert.deepEqual(shardOf(shard), { shard, slice: undefined, warning: undefined })
})

test('the old name of the burst still runs the burst, and says so', () => {
  const answer = shardOf(LEGACY_BURST_SHARD)
  assert.equal(answer.shard, BURST_SHARD)
  assert.match(answer.warning ?? '', /PERF_SHARD=storm is the old name of PERF_SHARD=burst/)
  assert.equal(shardOf(BURST_SHARD).warning, undefined)
})

test('a name that only contains the old one is left as it is', () => {
  assert.deepEqual(shardOf('storm_horde'), { shard: 'storm_horde', slice: undefined, warning: undefined })
})
