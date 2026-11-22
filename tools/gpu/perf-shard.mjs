// @ts-check
// How examples/test-room/perf.mjs reads PERF_SHARD. Pure, so tests/perf-shard.test.mjs can hold it.

/** The share that fires every explosive three times over and 20 grenades more, 47 blasts in a few seconds: the `burst` and `after_burst` phases. */
export const BURST_SHARD = 'burst'
/** What `burst` was called before: it read as weather (`ROOM_EXPLOSION_WEATHER=storm` is the rain), so it is still taken, with a warning. */
export const LEGACY_BURST_SHARD = 'storm'

/**
 * The share and slice PERF_SHARD asks for (`cold:2/3` is the share `cold`, slice `2/3`); unset runs everything. The old name of the burst is answered as
 * the burst, with the warning to print.
 * @param {string | undefined} text
 * @returns {{ shard: string, slice: string | undefined, warning: string | undefined }}
 */
export const shardOf = (text) => {
  const [asked, slice] = (text === undefined || text === '' ? 'all' : text).split(':')
  if (asked !== LEGACY_BURST_SHARD) return { shard: asked ?? 'all', slice, warning: undefined }
  return { shard: BURST_SHARD, slice, warning: `PERF_SHARD=${LEGACY_BURST_SHARD} is the old name of PERF_SHARD=${BURST_SHARD} (the burst of 47 explosions, not weather): running ${BURST_SHARD}; use the new name` }
}
