// @ts-check
// How tools/gpu/perf-gate.mjs reads two reports of examples/test-room/perf.mjs (the branch and main, measured on one machine): which metrics may grow,
// by how much, and how two runs of one build are joined.

/**
 * @typedef {{ name: string, p99: number, max: number, worstLongTask: number, hitches: number, drawsPerFrame: number, buffers: number, programs: number }} Phase
 * @typedef {{ crowd_ms_p99?: number, draw_calls?: number }} HordeMetrics
 * @typedef {{ text: string, kind: 'hard' | 'target' }} Failure
 * @typedef {{ gpu: string, viewport?: string, phases: Phase[], horde: { metrics: Record<string, HordeMetrics> }, failures: (Failure | string)[] }} Report
 * @typedef {{ phase: string, metric: string, base: number, branch: number }} Regression
 */

/**
 * What a phase metric may grow besides the share: a floor under which a difference is the noise of two runs of one build on one machine
 * (RTX 5070 laptop, 1600x900, quiet: two runs of main differ by up to ~1 ms of p99, one 60 Hz frame at the worst frame and the worst long task,
 * a frame or two over 33 ms in the horde phases, a few draws while debris settles, a dozen buffers where a blast throws a different count of shards).
 * @type {readonly { key: 'p99' | 'max' | 'worstLongTask' | 'hitches' | 'drawsPerFrame' | 'buffers', floor: number }[]}
 */
export const PHASE_METRICS = [
  { key: 'p99', floor: 1.5 },
  { key: 'max', floor: 16.7 },
  { key: 'worstLongTask', floor: 16.7 },
  { key: 'hitches', floor: 2 },
  { key: 'drawsPerFrame', floor: 4 },
  { key: 'buffers', floor: 16 },
]
/** @type {readonly { key: 'crowd_ms_p99' | 'draw_calls', floor: number }[]} */
export const HORDE_METRICS = [
  { key: 'crowd_ms_p99', floor: 0.5 },
  { key: 'draw_calls', floor: 4 },
]

/** Reports written before the kinds existed list plain texts: those were all blocking budgets, read as targets. @param {(Failure | string)[]} failures @returns {Failure[]} */
export const failuresOf = (failures) => failures.map((failure) => (typeof failure === 'string' ? { text: failure, kind: 'target' } : failure))

/**
 * The metrics of `branch` more than `tolerance` worse than `base` (and worse by more than the metric's floor), phase by phase; a phase only one side has is not compared.
 * @param {Report} base @param {Report} branch @param {number} tolerance @returns {Regression[]}
 */
export const compare = (base, branch, tolerance) => {
  /** @type {Regression[]} */
  const found = []
  /** @param {string} phase @param {string} metric @param {number | undefined} was @param {number | undefined} now @param {number} floor */
  const check = (phase, metric, was, now, floor) => {
    if (typeof was !== 'number' || typeof now !== 'number' || Number.isNaN(was) || Number.isNaN(now)) return
    if (now > was * (1 + tolerance) && now - was > floor) found.push({ phase, metric, base: was, branch: now })
  }
  for (const phase of branch.phases) {
    const before = base.phases.find((candidate) => candidate.name === phase.name)
    if (before) for (const { key, floor } of PHASE_METRICS) check(phase.name, key, before[key], phase[key], floor)
  }
  for (const [id, metrics] of Object.entries(branch.horde?.metrics ?? {})) {
    const before = base.horde?.metrics?.[id]
    if (before) for (const { key, floor } of HORDE_METRICS) check(id, key, before[key], metrics[key], floor)
  }
  return found
}

/** @param {number | undefined} a @param {number | undefined} b @returns {number | undefined} */
const lower = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.min(a, b) : (b ?? a))

/**
 * The better of two runs of one build, metric by metric: a slow frame one run had and the other did not is the machine (a clock step, a background task), not the code.
 * @param {Report} first @param {Report} second @returns {Report}
 */
export const bestOf = (first, second) => ({
  ...second,
  phases: second.phases.map((phase) => {
    const other = first.phases.find((candidate) => candidate.name === phase.name)
    if (!other) return phase
    /** @type {Phase} */
    const best = { ...phase }
    for (const { key } of PHASE_METRICS) best[key] = lower(other[key], phase[key]) ?? phase[key]
    return best
  }),
  horde: {
    ...second.horde,
    metrics: Object.fromEntries(Object.entries(second.horde?.metrics ?? {}).map(([id, metrics]) => {
      const other = first.horde?.metrics?.[id]
      /** @type {HordeMetrics} */
      const best = { ...metrics }
      if (other) for (const { key } of HORDE_METRICS) best[key] = lower(other[key], metrics[key])
      return [id, best]
    })),
  },
})
