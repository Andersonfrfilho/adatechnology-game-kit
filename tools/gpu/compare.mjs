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

/** One refresh of a 60 Hz display (ms): a windowed run is held to it by the compositor, so a frame time under it says nothing about the code. */
export const REFRESH_MS = 16.7

/**
 * What a phase metric may grow besides the share: a floor under which a difference is the noise of two runs of one build on one machine
 * (RTX 5070 laptop, 1600x900, quiet: two runs of main differ by up to ~1 ms of p99, one 60 Hz frame at the worst frame and the worst long task,
 * a frame or two over 33 ms in the horde phases, a few draws while debris settles). `refresh`: the frame times are read from one refresh up
 * (two runs of main on 2026-11-03 gave cold_dynamite p99 9.5 and 17.6 ms: the window was held to the display in one and not the other).
 * The GPU buffers created in play are not compared: batching a hit vehicle again makes a few hundred once to save hundreds of draws every
 * frame, and an upload that costs a frame shows in the frame times, which are compared; they stay in the report as a target.
 * @type {readonly { key: 'p99' | 'max' | 'worstLongTask' | 'hitches' | 'drawsPerFrame', floor: number, refresh?: boolean }[]}
 */
export const PHASE_METRICS = [
  { key: 'p99', floor: 1.5, refresh: true },
  { key: 'max', floor: 16.7, refresh: true },
  { key: 'worstLongTask', floor: 16.7 },
  { key: 'hitches', floor: 2 },
  { key: 'drawsPerFrame', floor: 4 },
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
  /** @param {string} phase @param {string} metric @param {number | undefined} was @param {number | undefined} now @param {number} floor @param {boolean} [refresh] */
  const check = (phase, metric, was, now, floor, refresh = false) => {
    if (typeof was !== 'number' || typeof now !== 'number' || Number.isNaN(was) || Number.isNaN(now)) return
    const [from, to] = refresh ? [Math.max(was, REFRESH_MS), Math.max(now, REFRESH_MS)] : [was, now]
    if (to > from * (1 + tolerance) && to - from > floor) found.push({ phase, metric, base: was, branch: now })
  }
  for (const phase of branch.phases) {
    const before = base.phases.find((candidate) => candidate.name === phase.name)
    if (before) for (const { key, floor, refresh } of PHASE_METRICS) check(phase.name, key, before[key], phase[key], floor, refresh)
  }
  for (const [id, metrics] of Object.entries(branch.horde?.metrics ?? {})) {
    const before = base.horde?.metrics?.[id]
    if (before) for (const { key, floor } of HORDE_METRICS) check(id, key, before[key], metrics[key], floor)
  }
  return found
}

/** @param {(a: number, b: number) => number} pick @returns {(a: number | undefined, b: number | undefined) => number | undefined} */
const either = (pick) => (a, b) => (typeof a === 'number' && typeof b === 'number' ? pick(a, b) : (b ?? a))

/**
 * Two runs of one build joined metric by metric with `pick`. The gate compares the better run of the branch with the worse run of main: it blocks
 * only when every run of the branch is worse than every run of main, so a slow frame one run had and another did not (a clock step, a
 * background task) is read as the machine, not the code.
 * @param {(a: number, b: number) => number} pick @returns {(first: Report, second: Report) => Report}
 */
const joined = (pick) => (first, second) => {
  const lower = either(pick)
  return {
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
  }
}

/** The better of two runs of one build, metric by metric. */
export const bestOf = joined(Math.min)
/** The worse of two runs of one build, metric by metric. */
export const worstOf = joined(Math.max)
